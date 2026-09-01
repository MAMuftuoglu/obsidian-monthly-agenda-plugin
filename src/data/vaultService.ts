import { App, TFile, normalizePath } from 'obsidian';
import { CalendarEvent, MonthlyAgendaSettings } from '../types';
import { injectEventIntoAgenda, parseAgendaEvents } from './eventParser';

/**
 * Normalizes and builds vault path for a daily note given a YYYY-MM-DD date string.
 */
export function getDailyNotePath(dateStr: string, settings: MonthlyAgendaSettings): string {
	const folder = settings.dailyNotesFolder ? settings.dailyNotesFolder.trim() : '';
	const filename = `${dateStr}.md`;
	if (!folder) {
		return normalizePath(filename);
	}
	return normalizePath(`${folder}/${filename}`);
}

/**
 * Retrieves the TFile for a daily note if it exists in the vault.
 */
export function getDailyNoteFile(app: App, dateStr: string, settings: MonthlyAgendaSettings): TFile | null {
	const path = getDailyNotePath(dateStr, settings);
	const abstractFile = app.vault.getAbstractFileByPath(path);
	if (abstractFile instanceof TFile) {
		return abstractFile;
	}
	return null;
}

/**
 * Reads and parses agenda events for a given date string.
 */
export async function getEventsForDate(
	app: App,
	dateStr: string,
	settings: MonthlyAgendaSettings,
): Promise<CalendarEvent[]> {
	const file = getDailyNoteFile(app, dateStr, settings);
	if (!file) {
		return [];
	}

	const content = await app.vault.read(file);
	return parseAgendaEvents(content, dateStr, settings.agendaHeading);
}

/**
 * Saves a new agenda event to the daily note for a given date string.
 * Creates the daily note file if it does not yet exist.
 */
export async function saveEventToDailyNote(
	app: App,
	dateStr: string,
	event: Omit<CalendarEvent, 'date'>,
	settings: MonthlyAgendaSettings,
): Promise<void> {
	const path = getDailyNotePath(dateStr, settings);
	const file = getDailyNoteFile(app, dateStr, settings);

	if (file) {
		// File exists - safely update using app.vault.process
		await app.vault.process(file, (content) => {
			return injectEventIntoAgenda(content, event, settings.agendaHeading);
		});
	} else {
		// Ensure folder exists if folder is specified
		if (settings.dailyNotesFolder) {
			const folderPath = normalizePath(settings.dailyNotesFolder);
			const folderExists = app.vault.getAbstractFileByPath(folderPath);
			if (!folderExists) {
				await app.vault.createFolder(folderPath);
			}
		}

		// Create file with new agenda section and event
		const initialContent = injectEventIntoAgenda('', event, settings.agendaHeading);
		await app.vault.create(path, initialContent);
	}
}
