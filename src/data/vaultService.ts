import { App, TFile, normalizePath } from 'obsidian';
import { CalendarEvent, MonthlyAgendaSettings } from '../types';
import { injectEventIntoAgenda, parseAgendaEvents } from './eventParser';

interface InternalPluginInstance {
	options?: {
		folder?: string;
	};
}

interface InternalPluginWrapper {
	enabled?: boolean;
	instance?: InternalPluginInstance;
}

interface InternalPlugins {
	getPluginById(id: string): InternalPluginWrapper | null;
}

interface AppWithInternalPlugins {
	internalPlugins?: InternalPlugins;
}

/**
 * Resolves the folder path for daily notes.
 * Uses plugin settings override if provided. Otherwise, auto-detects from Obsidian's internal Daily Notes plugin.
 */
export function getResolvedDailyNotesFolder(
	app: App,
	settings: MonthlyAgendaSettings,
): string {
	if (
		settings?.dailyNotesFolder &&
		settings.dailyNotesFolder.trim().length > 0
	) {
		return settings.dailyNotesFolder.trim();
	}

	try {
		const appWithPlugins = app as unknown as AppWithInternalPlugins;
		const internalDailyNotes =
			appWithPlugins.internalPlugins?.getPluginById?.('daily-notes');

		if (internalDailyNotes && internalDailyNotes.enabled) {
			const folder = internalDailyNotes.instance?.options?.folder;
			if (typeof folder === 'string' && folder.trim().length > 0) {
				return folder.trim();
			}
		}
	} catch (err) {
		console.debug('Could not auto-detect Daily Notes plugin folder:', err);
	}

	return '';
}

/**
 * Ensures nested folder structure exists in the vault.
 */
export async function ensureFolderExists(
	app: App,
	folderPath: string,
): Promise<void> {
	const normalized = normalizePath(folderPath);
	if (!normalized || normalized === '.') return;

	const parts = normalized.split('/');
	let current = '';
	for (const part of parts) {
		current = current ? `${current}/${part}` : part;
		const folderExists = app.vault.getAbstractFileByPath(current);
		if (!folderExists) {
			await app.vault.createFolder(current);
		}
	}
}

/**
 * Normalizes and builds vault path for a daily note given a YYYY-MM-DD date string.
 */
export function getDailyNotePath(
	app: App,
	dateStr: string,
	settings: MonthlyAgendaSettings,
): string {
	const folder = getResolvedDailyNotesFolder(app, settings);
	const filename = `${dateStr}.md`;
	if (!folder) {
		return normalizePath(filename);
	}
	return normalizePath(`${folder}/${filename}`);
}

/**
 * Retrieves the TFile for a daily note if it exists in the vault.
 */
export function getDailyNoteFile(
	app: App,
	dateStr: string,
	settings: MonthlyAgendaSettings,
): TFile | null {
	const path = getDailyNotePath(app, dateStr, settings);
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
	const path = getDailyNotePath(app, dateStr, settings);
	const file = getDailyNoteFile(app, dateStr, settings);

	if (file) {
		// File exists - safely update using app.vault.process
		await app.vault.process(file, (content) => {
			return injectEventIntoAgenda(content, event, settings.agendaHeading);
		});
	} else {
		// Ensure folder structure exists
		const folder = getResolvedDailyNotesFolder(app, settings);
		if (folder) {
			await ensureFolderExists(app, folder);
		}

		// Create file with new agenda section and event
		const initialContent = injectEventIntoAgenda(
			'',
			event,
			settings.agendaHeading,
		);
		await app.vault.create(path, initialContent);
	}
}
