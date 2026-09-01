import { App, PluginSettingTab, Setting } from 'obsidian';
import MonthlyAgendaPlugin from './main';

export interface MonthlyAgendaSettings {
	agendaHeading: string;
	dailyNotesFolder: string;
	dateFormat: string;
}

export const DEFAULT_SETTINGS: MonthlyAgendaSettings = {
	agendaHeading: '## Agenda',
	dailyNotesFolder: '',
	dateFormat: 'YYYY-MM-DD',
};

export class MonthlyAgendaSettingTab extends PluginSettingTab {
	plugin: MonthlyAgendaPlugin;

	constructor(app: App, plugin: MonthlyAgendaPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions() {
		return [
			{
				id: 'agendaHeading',
				name: 'Agenda heading',
				description:
					'Markdown heading in daily notes under which agenda events are saved and parsed.',
			},
			{
				id: 'dailyNotesFolder',
				name: 'Daily notes folder',
				description:
					'Folder path where daily notes are stored (leave empty for vault root).',
			},
		];
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Agenda configuration')
			.setHeading();

		new Setting(containerEl)
			.setName('Agenda heading')
			.setDesc('Markdown heading in daily notes under which agenda events are saved and parsed.')
			.addText((text) =>
				text
					.setPlaceholder('## Agenda')
					.setValue(this.plugin.settings.agendaHeading)
					.onChange(async (value) => {
						this.plugin.settings.agendaHeading = value.trim() || '## Agenda';
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Daily notes folder')
			.setDesc('Folder path where daily notes are stored (leave empty for vault root).')
			.addText((text) =>
				text
					.setPlaceholder('E.g. Daily notes')
					.setValue(this.plugin.settings.dailyNotesFolder)
					.onChange(async (value) => {
						this.plugin.settings.dailyNotesFolder = value.trim();
						await this.plugin.saveSettings();
					}),
			);
	}
}
