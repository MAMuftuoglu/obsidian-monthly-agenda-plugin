export interface CalendarEvent {
	id?: string;
	date: string; // Format: YYYY-MM-DD
	startTime: string; // Format: HH:mm
	endTime: string; // Format: HH:mm
	title: string;
	description?: string;
	completed?: boolean;
}

export interface AgendaNote {
	id?: string;
	date: string; // Format: YYYY-MM-DD
	title: string;
	isTodo?: boolean;
	completed?: boolean;
}

export interface DailyAgendaData {
	events: CalendarEvent[];
	notes: AgendaNote[];
}

export interface MonthlyAgendaSettings {
	agendaHeading: string;
	dailyNotesFolder: string;
	dateFormat: string;
	dailyTodos: string;
}

export const DEFAULT_SETTINGS: MonthlyAgendaSettings = {
	agendaHeading: '## Agenda',
	dailyNotesFolder: '',
	dateFormat: 'YYYY-MM-DD',
	dailyTodos: '',
};

