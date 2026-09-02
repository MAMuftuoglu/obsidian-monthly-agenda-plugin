import { App, PluginSettingTab, Setting } from 'obsidian';
import { getResolvedDailyNotesFolder } from './data/vaultService';
import MonthlyAgendaPlugin from './main';

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

		new Setting(containerEl).setName('Agenda configuration').setHeading();

		new Setting(containerEl)
			.setName('Agenda heading')
			.setDesc(
				'Markdown heading in daily notes under which agenda events are saved and parsed.',
			)
			.addText((text) =>
				text
					.setPlaceholder('## Agenda')
					.setValue(
						this.plugin.settings?.agendaHeading || '## Agenda',
					)
					.onChange(async (value) => {
						this.plugin.settings.agendaHeading = value;
						await this.plugin.saveSettings();
					}),
			);

		const folderSetting = new Setting(containerEl).setName(
			'Daily notes folder',
		);

		const updateFolderDesc = () => {
			const resolvedFolder = getResolvedDailyNotesFolder(
				this.plugin.settings,
			);
			const folderStatusText = resolvedFolder
				? `Active target: "${resolvedFolder}"`
				: 'Active target: Vault root (/)';
			folderSetting.setDesc(
				`Override folder path where daily notes are stored (e.g. "Daily notes"). Leave blank to auto-detect from Obsidian's Daily Notes plugin. (${folderStatusText})`,
			);
		};

		updateFolderDesc();

		folderSetting.addText((text) =>
			text
				.setPlaceholder('E.g. Daily notes')
				.setValue(this.plugin.settings?.dailyNotesFolder || '')
				.onChange(async (value) => {
					this.plugin.settings.dailyNotesFolder = value;
					await this.plugin.saveSettings();
					updateFolderDesc();
				}),
		);

		new Setting(containerEl)
			.setName('Daily to-dos')
			.setDesc(
				'List of default daily tasks to automatically add to new daily notes. Enter one per line.',
			)
			.addTextArea((text) =>
				text
					.setPlaceholder(
						'List your daily to-dos. Example:\nWorkout\nread 10 pages',
					)
					.setValue(this.plugin.settings?.dailyTodos || '')
					.onChange(async (value) => {
						this.plugin.settings.dailyTodos = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
