import { ItemView, WorkspaceLeaf, setIcon } from 'obsidian';
import { getEventsForDate } from '../data/vaultService';
import { CalendarEvent, MonthlyAgendaSettings } from '../types';
import { AddEventModal } from './addEventModal';

export const VIEW_TYPE_CALENDAR = 'monthly-agenda-calendar';

export class CalendarView extends ItemView {
	private settings: MonthlyAgendaSettings;
	private currentYear: number;
	private currentMonth: number; // 0-indexed (0 = Jan, 11 = Dec)
	private popoverEl: HTMLElement | null = null;

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

		const monthNames = [
			'January',
			'February',
			'March',
			'April',
			'May',
			'June',
			'July',
			'August',
			'September',
			'October',
			'November',
			'December',
		];
		const titleText = `${monthNames[this.currentMonth]} ${this.currentYear}`;
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

		// 2. Grid container
		const gridContainer = container.createDiv({ cls: 'calendar-grid' });

		// Weekday labels (Mon - Sun)
		const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
		const weekdayRow = gridContainer.createDiv({
			cls: 'calendar-weekday-row',
		});
		weekDays.forEach((day) => {
			weekdayRow.createDiv({ cls: 'calendar-weekday-header', text: day });
		});

		// Days grid
		const daysGrid = gridContainer.createDiv({ cls: 'calendar-days-grid' });

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
			daysGrid.createDiv({
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

			const dayCell = daysGrid.createDiv({
				cls: `calendar-day-cell current-month${isToday ? ' is-today' : ''}`,
			});

			dayCell.createDiv({
				cls: 'calendar-day-number',
				text: day.toString(),
			});

			// Fetch events for this day
			const events = await getEventsForDate(
				this.app,
				dateStr,
				this.settings,
			);

			if (events.length > 0) {
				const badge = dayCell.createDiv({
					cls: 'calendar-event-badge',
				});
				badge.createSpan({
					cls: 'calendar-event-count',
					text: `${events.length} ${events.length === 1 ? 'event' : 'events'}`,
				});
			}

			// Add hover state (popover preview)
			dayCell.addEventListener('mouseenter', (evt) => {
				this.showHoverPopover(evt, dateStr, events);
			});

			dayCell.addEventListener('mouseleave', () => {
				this.hideHoverPopover();
			});

			// Add click interaction (Open Add Event Modal)
			dayCell.addEventListener('click', () => {
				this.hideHoverPopover();
				new AddEventModal(this.app, dateStr, this.settings, () => {
					void this.refresh();
				}).open();
			});
		}
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
		events: CalendarEvent[],
	): void {
		if (!this.popoverEl) return;

		this.popoverEl.empty();
		this.popoverEl.createDiv({ cls: 'popover-header', text: dateStr });

		if (events.length === 0) {
			this.popoverEl.createDiv({
				cls: 'popover-empty',
				text: 'No events scheduled. Click to add.',
			});
		} else {
			const list = this.popoverEl.createDiv({
				cls: 'popover-events-list',
			});
			events.forEach((item) => {
				const itemEl = list.createDiv({ cls: 'popover-event-item' });
				itemEl.createSpan({
					cls: 'popover-event-time',
					text: `${item.startTime} - ${item.endTime}`,
				});
				itemEl.createSpan({
					cls: 'popover-event-title',
					text: item.title,
				});

				if (item.description) {
					itemEl.createDiv({
						cls: 'popover-event-desc',
						text: item.description,
					});
				}
			});
		}

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
