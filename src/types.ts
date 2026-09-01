export interface CalendarEvent {
	id?: string;
	date: string; // Format: YYYY-MM-DD
	startTime: string; // Format: HH:mm
	endTime: string; // Format: HH:mm
	title: string;
	description?: string;
	completed?: boolean;
}

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
