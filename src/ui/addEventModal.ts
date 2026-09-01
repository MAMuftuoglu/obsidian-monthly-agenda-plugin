import { App, Modal, Notice, Setting, TextComponent } from 'obsidian';
import { saveEventToDailyNote } from '../data/vaultService';
import { MonthlyAgendaSettings } from '../types';

/**
 * Converts a HH:mm time string into minutes from midnight (0..1439).
 */
function timeToMinutes(timeStr: string): number {
	const [hStr, mStr] = timeStr.split(':');
	const h = parseInt(hStr ?? '0', 10);
	const m = parseInt(mStr ?? '0', 10);
	if (isNaN(h) || isNaN(m)) return 0;
	return h * 60 + m;
}

/**
 * Converts minutes from midnight into a normalized HH:mm time string (capped strictly at 23:59).
 */
function minutesToTime(totalMinutes: number): string {
	const capped = Math.min(Math.max(0, totalMinutes), 1439); // Cap at 23:59 (1439 mins)
	const h = Math.floor(capped / 60);
	const m = capped % 60;
	return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Calculates duration in minutes between start time and end time.
 * If end time is earlier than start time, treats end time as crossing into the next day.
 */
function calculateDurationMinutes(
	startTimeStr: string,
	endTimeStr: string,
): number {
	const startMins = timeToMinutes(startTimeStr);
	let endMins = timeToMinutes(endTimeStr);

	if (endMins < startMins) {
		endMins += 1440;
	}

	return Math.max(0, endMins - startMins);
}

export class AddEventModal extends Modal {
	private dateStr: string;
	private settings: MonthlyAgendaSettings;
	private onSaveSuccess: () => void;

	private title: string = '';
	private startTime: string = '09:00';
	private endTime: string = '10:00';
	private description: string = '';

	constructor(
		app: App,
		dateStr: string,
		settings: MonthlyAgendaSettings,
		onSaveSuccess: () => void,
	) {
		super(app);
		this.dateStr = dateStr;
		this.settings = settings;
		this.onSaveSuccess = onSaveSuccess;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: `Add event for ${this.dateStr}` });

		new Setting(contentEl)
			.setName('Event title')
			.setDesc('Title of the scheduled event')
			.addText((text) =>
				text
					.setPlaceholder('Team sync')
					.onChange((value) => (this.title = value.trim())),
			);

		let endTimeInputComponent: TextComponent | null = null;

		new Setting(contentEl)
			.setName('Start time')
			.setDesc('Start time (e.g. 09:00)')
			.addText((text) => {
				text.inputEl.type = 'time';
				text.setValue(this.startTime);
				text.onChange((newStartTime) => {
					if (!newStartTime) return;

					// Calculate duration from current start and end times (accounting for cross-midnight if any)
					const durationMins = calculateDurationMinutes(
						this.startTime,
						this.endTime,
					);

					this.startTime = newStartTime;

					const newStartMins = timeToMinutes(newStartTime);
					const targetEndMins = newStartMins + durationMins;
					this.endTime = minutesToTime(targetEndMins);

					if (endTimeInputComponent) {
						endTimeInputComponent.setValue(this.endTime);
					}
				});
			});

		new Setting(contentEl)
			.setName('End time')
			.setDesc('End time (e.g. 10:00)')
			.addText((text) => {
				endTimeInputComponent = text;
				text.inputEl.type = 'time';
				text.setValue(this.endTime);
				text.onChange((value) => {
					this.endTime = value;
				});
			});

		new Setting(contentEl)
			.setName('Description')
			.setDesc('Optional event description')
			.addTextArea((text) =>
				text
					.setPlaceholder('Details about this agenda item...')
					.onChange((value) => (this.description = value.trim())),
			);

		new Setting(contentEl)
			.addButton((button) =>
				button
					.setButtonText('Save event')
					.setCta()
					.onClick(async () => {
						if (!this.title) {
							new Notice('Please enter an event title.');
							return;
						}

						if (!this.startTime || !this.endTime) {
							new Notice('Please specify start and end times.');
							return;
						}

						try {
							await saveEventToDailyNote(
								this.app,
								this.dateStr,
								{
									startTime: this.startTime,
									endTime: this.endTime,
									title: this.title,
									description: this.description || undefined,
								},
								this.settings,
							);

							new Notice(
								`Event "${this.title}" saved to ${this.dateStr}`,
							);
							this.onSaveSuccess();
							this.close();
						} catch (error) {
							console.error('Failed to save event:', error);
							new Notice('Failed to save event to daily note.');
						}
					}),
			)
			.addButton((button) =>
				button.setButtonText('Cancel').onClick(() => this.close()),
			);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
