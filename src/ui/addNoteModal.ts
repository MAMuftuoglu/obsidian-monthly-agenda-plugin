import { App, Modal, Notice, Setting } from 'obsidian';
import { saveNoteToDailyNote } from '../data/vaultService';
import { MonthlyAgendaSettings } from '../types';

export class AddNoteModal extends Modal {
	private dateStr: string;
	private settings: MonthlyAgendaSettings;
	private onSaveSuccess: () => void;

	private title: string = '';

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

		contentEl.createEl('h2', { text: `Add note for ${this.dateStr}` });

		new Setting(contentEl)
			.setName('Note title')
			.setDesc('Title of the agenda note')
			.addText((text) =>
				text
					.setPlaceholder('Remind to buy coffee')
					.onChange((value) => (this.title = value.trim())),
			);

		new Setting(contentEl)
			.addButton((button) =>
				button
					.setButtonText('Save note')
					.setCta()
					.onClick(async () => {
						if (!this.title) {
							new Notice('Please enter a note title.');
							return;
						}

						try {
							await saveNoteToDailyNote(
								this.app,
								this.dateStr,
								{
									title: this.title,
								},
								this.settings,
							);

							new Notice(
								`Note "${this.title}" saved to ${this.dateStr}`,
							);
							this.onSaveSuccess();
							this.close();
						} catch (error) {
							console.error('Failed to save note:', error);
							new Notice('Failed to save note to daily note.');
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
