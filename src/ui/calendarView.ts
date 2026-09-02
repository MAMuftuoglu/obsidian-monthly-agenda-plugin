import { ItemView, WorkspaceLeaf, setIcon } from 'obsidian';
import { getAgendaDataForDate } from '../data/vaultService';
import { AgendaNote, CalendarEvent, MonthlyAgendaSettings } from '../types';
import { MONTH_NAMES, WEEKDAY_NAMES } from '../utils/constants';
import { AddEventModal } from './addEventModal';
import { AddNoteModal } from './addNoteModal';

export const VIEW_TYPE_CALENDAR = 'monthly-agenda-calendar';

export class CalendarView extends ItemView {
	private settings: MonthlyAgendaSettings;
	private currentYear: number;
	private currentMonth: number; // 0-indexed (0 = Jan, 11 = Dec)
	private popoverEl: HTMLElement | null = null;
	private selectedDate: string | null = null;
	private sidePanelEl: HTMLElement | null = null;
	private daysGridEl: HTMLElement | null = null;

	constructor(leaf: WorkspaceLeaf, settings: MonthlyAgendaSettings) {
		super(leaf);
		this.settings = settings;

		const today = new Date();
		this.currentYear = today.getFullYear();
		this.currentMonth = today.getMonth();
	}

	getViewType(): string {
		return VIEW_TYPE_CALENDAR;
	}

	getDisplayText(): string {
		return 'Monthly calendar';
	}

	getIcon(): string {
		return 'calendar';
	}

	async onOpen(): Promise<void> {
		this.createPopoverElement();
		await this.render();
	}

	async onClose(): Promise<void> {
		if (this.popoverEl && this.popoverEl.parentNode) {
			this.popoverEl.parentNode.removeChild(this.popoverEl);
		}
	}

	public updateSettings(settings: MonthlyAgendaSettings): void {
		this.settings = settings;
		void this.render();
	}

	public async refresh(): Promise<void> {
		await this.render();
	}

	private createPopoverElement(): void {
		this.popoverEl = document.body.createDiv({
			cls: 'calendar-day-popover is-hidden',
		});
	}

	private async render(): Promise<void> {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass('calendar-view-container');

		// 1. Header controls
		const headerEl = container.createDiv({ cls: 'calendar-header' });

		const navPrev = headerEl.createEl('button', {
			cls: 'calendar-nav-btn',
			title: 'Previous month',
		});
		setIcon(navPrev, 'chevron-left');
		navPrev.addEventListener('click', () => {
			void this.changeMonth(-1);
		});

		const titleText = `${MONTH_NAMES[this.currentMonth]} ${this.currentYear}`;
		headerEl.createEl('h3', { cls: 'calendar-title', text: titleText });

		const navNext = headerEl.createEl('button', {
			cls: 'calendar-nav-btn',
			title: 'Next month',
		});
		setIcon(navNext, 'chevron-right');
		navNext.addEventListener('click', () => {
			void this.changeMonth(1);
		});

		const todayBtn = headerEl.createEl('button', {
			cls: 'calendar-today-btn',
			text: 'Today',
		});
		todayBtn.addEventListener('click', () => {
			const now = new Date();
			this.currentYear = now.getFullYear();
			this.currentMonth = now.getMonth();
			void this.render();
		});

		const refreshButton = headerEl.createEl('button', {
			cls: 'calendar-refresh-btn',
			title: 'Refresh calendar',
		});
		setIcon(refreshButton, 'refresh-cw');
		refreshButton.addEventListener('click', () => {
			void this.refresh();
		});

		// 2. Calendar Body (Grid + Side Panel)
		const bodyContainer = container.createDiv({ cls: 'calendar-body' });

		// 2a. Grid wrapper (Left side)
		const gridWrapper = bodyContainer.createDiv({
			cls: 'calendar-grid-wrapper',
		});

		// Weekday labels (Mon - Sun)
		const weekdayRow = gridWrapper.createDiv({
			cls: 'calendar-weekday-row',
		});
		WEEKDAY_NAMES.forEach((day) => {
			weekdayRow.createDiv({ cls: 'calendar-weekday-header', text: day });
		});

		// Days grid
		this.daysGridEl = gridWrapper.createDiv({ cls: 'calendar-days-grid' });

		// 2b. Side Panel container (Right side)
		this.sidePanelEl = bodyContainer.createDiv({
			cls: 'calendar-events-panel',
		});

		// Calculation for month grid
		const firstDayOfMonth = new Date(
			this.currentYear,
			this.currentMonth,
			1,
		);
		const lastDayOfMonth = new Date(
			this.currentYear,
			this.currentMonth + 1,
			0,
		);

		// Get day of week for 1st day (0 = Sun, 1 = Mon ... 6 = Sat) -> convert to Mon = 0 ... Sun = 6
		let startDayOffset = firstDayOfMonth.getDay() - 1;
		if (startDayOffset < 0) startDayOffset = 6;

		const totalDays = lastDayOfMonth.getDate();

		// Previous month padding
		const prevMonthLastDay = new Date(
			this.currentYear,
			this.currentMonth,
			0,
		).getDate();
		for (let i = startDayOffset - 1; i >= 0; i--) {
			const dayNum = prevMonthLastDay - i;
			this.daysGridEl.createDiv({
				cls: 'calendar-day-cell other-month',
				text: dayNum.toString(),
			});
		}

		// Current date string for highlighting today
		const todayObj = new Date();
		const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;

		// Current month cells
		for (let day = 1; day <= totalDays; day++) {
			const dateStr = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
			const isToday = dateStr === todayStr;
			const isSelected = dateStr === this.selectedDate;

			const dayCell = this.daysGridEl.createDiv({
				cls: `calendar-day-cell current-month${isToday ? ' is-today' : ''}${isSelected ? ' is-selected' : ''}`,
			});
			dayCell.dataset.date = dateStr;

			dayCell.createDiv({
				cls: 'calendar-day-number',
				text: day.toString(),
			});

			// Fetch events and notes for this day
			const { events, notes } = await getAgendaDataForDate(
				this.app,
				dateStr,
				this.settings,
			);

			const eventsContainer = dayCell.createDiv({
				cls: 'calendar-day-events-container',
			});

			const allItems: Array<
				| { type: 'event'; data: CalendarEvent }
				| { type: 'note'; data: AgendaNote }
			> = [
				...events.map((evt) => ({ type: 'event' as const, data: evt })),
				...notes.map((nt) => ({ type: 'note' as const, data: nt })),
			];

			if (allItems.length > 0) {
				const maxVisible = 5;
				const visibleItems = allItems.slice(0, maxVisible);
				const overflowCount = allItems.length - maxVisible;

				visibleItems.forEach((item) => {
					if (item.type === 'event') {
						const pill = eventsContainer.createDiv({
							cls: 'calendar-day-event-pill',
						});
						if (item.data.startTime) {
							pill.createSpan({
								cls: 'calendar-day-event-time',
								text: item.data.startTime,
							});
						}
						pill.createSpan({
							cls: 'calendar-day-event-title',
							text: item.data.title,
						});
					} else {
						const pill = eventsContainer.createDiv({
							cls: 'calendar-day-note-pill',
						});
						const iconSpan = pill.createSpan({
							cls: 'calendar-day-note-icon',
						});
						setIcon(iconSpan, item.data.isTodo ? (item.data.completed ? 'check-square' : 'square') : 'file-text');
						pill.createSpan({
							cls: 'calendar-day-note-title',
							text: item.data.title,
						});
					}
				});

				if (overflowCount > 0) {
					eventsContainer.createDiv({
						cls: 'calendar-day-more-events',
						text: `+${overflowCount} more`,
					});

					// Add hover popover preview ONLY when overflow occurs
					dayCell.addEventListener('mouseenter', (evt) => {
						const hoverItems = allItems.slice(maxVisible);
						this.showHoverPopover(evt, dateStr, hoverItems);
					});

					dayCell.addEventListener('mouseleave', () => {
						this.hideHoverPopover();
					});
				}
			} else {
				eventsContainer.createDiv({
					cls: 'calendar-day-no-events',
					text: 'No events scheduled',
				});
			}

			// Add click interaction (Select date and update side panel)
			dayCell.addEventListener('click', () => {
				this.hideHoverPopover();
				this.selectDate(dateStr);
			});
		}

		// Render the side panel state
		await this.renderSidePanel();
	}

	private selectDate(dateStr: string): void {
		this.selectedDate = dateStr;

		// Update grid cell highlights
		if (this.daysGridEl) {
			const cells = this.daysGridEl.querySelectorAll(
				'.calendar-day-cell.current-month',
			);
			cells.forEach((cell) => {
				const htmlCell = cell as HTMLElement;
				if (htmlCell.dataset.date === dateStr) {
					htmlCell.addClass('is-selected');
				} else {
					htmlCell.removeClass('is-selected');
				}
			});
		}

		void this.renderSidePanel();
	}

	private async renderSidePanel(): Promise<void> {
		if (!this.sidePanelEl) return;
		this.sidePanelEl.empty();

		if (!this.selectedDate) {
			this.sidePanelEl.addClass('is-hidden');
			return;
		}

		this.sidePanelEl.removeClass('is-hidden');

		// 1. Panel Header
		const headerEl = this.sidePanelEl.createDiv({ cls: 'panel-header' });

		const formattedDate = this.formatDateHeader(this.selectedDate);
		headerEl.createEl('h4', {
			cls: 'panel-date-title',
			text: formattedDate,
		});

		const closeBtn = headerEl.createEl('button', {
			cls: 'panel-close-btn',
			title: 'Close panel',
		});
		setIcon(closeBtn, 'x');
		closeBtn.addEventListener('click', () => {
			this.selectedDate = null;
			if (this.daysGridEl) {
				const cells = this.daysGridEl.querySelectorAll(
					'.calendar-day-cell.current-month',
				);
				cells.forEach((cell) => cell.removeClass('is-selected'));
			}
			void this.renderSidePanel();
		});

		// 2. Action Bar (Create Event & Add Note Buttons)
		const actionContainer = this.sidePanelEl.createDiv({
			cls: 'panel-actions',
		});

		const createBtn = actionContainer.createEl('button', {
			cls: 'calendar-panel-create-btn',
		});
		setIcon(createBtn.createSpan({ cls: 'btn-icon' }), 'plus');
		createBtn.createSpan({ text: 'Create Event' });

		const addNoteBtn = actionContainer.createEl('button', {
			cls: 'calendar-panel-add-note-btn',
		});
		setIcon(addNoteBtn.createSpan({ cls: 'btn-icon' }), 'file-plus');
		addNoteBtn.createSpan({ text: 'Add Note' });

		const currentSelectedDate = this.selectedDate;
		createBtn.addEventListener('click', () => {
			if (!currentSelectedDate) return;
			new AddEventModal(
				this.app,
				currentSelectedDate,
				this.settings,
				() => {
					void this.refresh();
				},
			).open();
		});

		addNoteBtn.addEventListener('click', () => {
			if (!currentSelectedDate) return;
			new AddNoteModal(
				this.app,
				currentSelectedDate,
				this.settings,
				() => {
					void this.refresh();
				},
			).open();
		});

		// 3. Agenda Content Section (Events + Notes Subtitle Divider + Notes)
		const panelEventsContainer = this.sidePanelEl.createDiv({
			cls: 'panel-events-container',
		});

		const { events, notes } = await getAgendaDataForDate(
			this.app,
			this.selectedDate,
			this.settings,
		);

		if (events.length === 0 && notes.length === 0) {
			const emptyEl = panelEventsContainer.createDiv({
				cls: 'panel-empty-state',
			});
			setIcon(emptyEl.createDiv({ cls: 'empty-icon' }), 'calendar-x');
			emptyEl.createDiv({
				cls: 'empty-text',
				text: 'No events or notes scheduled for this day.',
			});
			emptyEl.createDiv({
				cls: 'empty-hint',
				text: 'Click "Create Event" or "Add Note" above to add one.',
			});
		} else {
			// Events section
			if (events.length > 0) {
				const list = panelEventsContainer.createDiv({
					cls: 'panel-events-list',
				});
				events.forEach((item) => {
					const itemEl = list.createDiv({ cls: 'panel-event-item' });

					const timeEl = itemEl.createDiv({ cls: 'panel-event-time' });
					setIcon(timeEl.createSpan({ cls: 'time-icon' }), 'clock');
					timeEl.createSpan({
						text: `${item.startTime} - ${item.endTime}`,
					});

					itemEl.createDiv({
						cls: 'panel-event-title',
						text: item.title,
					});

					if (item.description) {
						itemEl.createDiv({
							cls: 'panel-event-desc',
							text: item.description,
						});
					}
				});
			} else {
				panelEventsContainer.createDiv({
					cls: 'panel-no-items-text',
					text: 'No timed events scheduled.',
				});
			}

			// Notes Divider Header
			const notesDivider = panelEventsContainer.createDiv({
				cls: 'panel-section-divider',
			});
			const notesHeader = notesDivider.createDiv({
				cls: 'panel-notes-header',
			});
			setIcon(notesHeader.createSpan({ cls: 'notes-icon' }), 'file-text');
			notesHeader.createSpan({ text: 'Notes' });

			// Notes section
			if (notes.length > 0) {
				const notesList = panelEventsContainer.createDiv({
					cls: 'panel-notes-list',
				});
				notes.forEach((note) => {
					const noteEl = notesList.createDiv({ cls: 'panel-note-item' });
					const noteIcon = noteEl.createSpan({ cls: 'panel-note-icon' });
					setIcon(noteIcon, note.isTodo ? (note.completed ? 'check-square' : 'square') : 'file-text');
					noteEl.createSpan({
						cls: 'panel-note-title',
						text: note.title,
					});
				});
			} else {
				panelEventsContainer.createDiv({
					cls: 'panel-no-items-text',
					text: 'No notes for this day.',
				});
			}
		}
	}

	private formatDateHeader(dateStr: string): string {
		const parts = dateStr.split('-');
		const year = parts[0] ? parseInt(parts[0], 10) : 1970;
		const month = parts[1] ? parseInt(parts[1], 10) - 1 : 0;
		const day = parts[2] ? parseInt(parts[2], 10) : 1;
		const dateObj = new Date(year, month, day);

		const dayOfWeekIndex = (dateObj.getDay() + 6) % 7; // Mon = 0 ... Sun = 6
		const dayName = WEEKDAY_NAMES[dayOfWeekIndex] ?? '';
		const monthName = MONTH_NAMES[month] ?? '';

		return `${dayName}, ${monthName} ${day}, ${year}`;
	}

	private async changeMonth(delta: number): Promise<void> {
		this.currentMonth += delta;
		if (this.currentMonth < 0) {
			this.currentMonth = 11;
			this.currentYear -= 1;
		} else if (this.currentMonth > 11) {
			this.currentMonth = 0;
			this.currentYear += 1;
		}
		await this.render();
	}

	private showHoverPopover(
		evt: MouseEvent,
		dateStr: string,
		overflowItems: Array<
			| { type: 'event'; data: CalendarEvent }
			| { type: 'note'; data: AgendaNote }
		>,
	): void {
		if (!this.popoverEl) return;

		this.popoverEl.empty();
		this.popoverEl.createDiv({ cls: 'popover-header', text: dateStr });

		const list = this.popoverEl.createDiv({
			cls: 'popover-events-list',
		});
		overflowItems.forEach((item) => {
			if (item.type === 'event') {
				const itemEl = list.createDiv({ cls: 'popover-event-item' });
				itemEl.createSpan({
					cls: 'popover-event-time',
					text: `${item.data.startTime} - ${item.data.endTime}`,
				});
				itemEl.createSpan({
					cls: 'popover-event-title',
					text: item.data.title,
				});

				if (item.data.description) {
					itemEl.createDiv({
						cls: 'popover-event-desc',
						text: item.data.description,
					});
				}
			} else {
				const itemEl = list.createDiv({ cls: 'popover-note-item' });
				const iconSpan = itemEl.createSpan({ cls: 'popover-note-icon' });
				setIcon(iconSpan, item.data.isTodo ? (item.data.completed ? 'check-square' : 'square') : 'file-text');
				itemEl.createSpan({
					cls: 'popover-note-title',
					text: item.data.title,
				});
			}
		});

		// Position popover relative to mouse target cell
		const targetCell = evt.currentTarget as HTMLElement;
		const rect = targetCell.getBoundingClientRect();

		this.popoverEl.removeClass('is-hidden');
		const popoverRect = this.popoverEl.getBoundingClientRect();

		let top = rect.bottom + 6;
		let left = rect.left + rect.width / 2 - popoverRect.width / 2;

		// Prevent popover going off-screen right
		if (left + popoverRect.width > window.innerWidth - 10) {
			left = window.innerWidth - popoverRect.width - 10;
		}
		// Prevent popover going off-screen left
		if (left < 10) {
			left = 10;
		}
		// If bottom overflow, show above cell
		if (top + popoverRect.height > window.innerHeight - 10) {
			top = rect.top - popoverRect.height - 6;
		}

		this.popoverEl.setCssProps({
			top: `${top}px`,
			left: `${left}px`,
		});
	}

	private hideHoverPopover(): void {
		if (this.popoverEl) {
			this.popoverEl.addClass('is-hidden');
		}
	}
}

