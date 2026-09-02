import { Plugin, WorkspaceLeaf } from 'obsidian';
import { DEFAULT_SETTINGS, MonthlyAgendaSettings } from './types';
import { MonthlyAgendaSettingTab } from './settings';
import { CalendarView, VIEW_TYPE_CALENDAR } from './ui/calendarView';
import { syncDailyTodos } from './data/vaultService';

export default class MonthlyAgendaPlugin extends Plugin {
	settings!: MonthlyAgendaSettings;

	async onload() {
		await this.loadSettings();

		this.app.workspace.onLayoutReady(async () => {
			const todayObj = new Date();
			const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
			await syncDailyTodos(this.app, todayStr, this.settings);
		});

		// Register custom view
		this.registerView(
			VIEW_TYPE_CALENDAR,
			(leaf) => new CalendarView(leaf, this.settings),
		);

		// Add ribbon icon to open calendar view
		this.addRibbonIcon('calendar', 'Open monthly calendar', () => {
			void this.activateView();
		});

		// Add command to command palette
		this.addCommand({
			id: 'open-monthly-calendar',
			name: 'Open monthly calendar',
			callback: () => {
				void this.activateView();
			},
		});

		// Add settings tab
		this.addSettingTab(new MonthlyAgendaSettingTab(this.app, this));
	}

	onunload() {
		// Clean up view references if needed without detaching workspace leaves
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<MonthlyAgendaSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);

		// Notify active calendar view leaves of updated settings
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR);
		leaves.forEach((leaf) => {
			if (leaf.view instanceof CalendarView) {
				leaf.view.updateSettings(this.settings);
			}
		});
	}

	async activateView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_CALENDAR);

		leaf = leaves.length > 0 && leaves[0] ? leaves[0] : null;

		if (!leaf) {
			// Open calendar view in main workspace tab
			leaf = workspace.getLeaf('tab');
			await leaf.setViewState({
				type: VIEW_TYPE_CALENDAR,
				active: true,
			});
		}

		void workspace.revealLeaf(leaf);
	}
}
