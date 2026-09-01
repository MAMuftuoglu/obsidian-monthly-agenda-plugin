import { CalendarEvent } from '../types';

/**
 * Regex pattern to match agenda event items in daily notes.
 * Format: - [ ] HH:mm - HH:mm | **Title** | Description (optional)
 */
const AGENDA_ITEM_REGEX =
	/^\s*-\s*\[([ xX]?)\]\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s*\|\s*\*\*(.*?)\*\*(?:\s*\|\s*(.*))?$/;

/**
 * Normalizes time string to HH:mm format (e.g. 9:00 -> 09:00).
 */
function normalizeTime(timeStr: string): string {
	const parts = timeStr.trim().split(':');

	if (parts.length !== 2) return timeStr;
	if (parts[0] === undefined || parts[1] === undefined) return timeStr;

	const hours = parts[0].padStart(2, '0');
	const minutes = parts[1].padStart(2, '0');
	return `${hours}:${minutes}`;
}

/**
 * Parses markdown text to extract events under a specific heading (default: ## Agenda).
 */
export function parseAgendaEvents(
	markdown: string,
	dateStr: string,
	heading: string = '## Agenda',
): CalendarEvent[] {
	const events: CalendarEvent[] = [];
	if (!markdown) return events;

	const lines = markdown.split(/\r?\n/);
	let inAgendaSection = false;
	const normalizedHeading = heading.trim().toLowerCase();

	for (let i = 0; i < lines.length; i++) {
		const currentLine = lines[i];
		if (currentLine === undefined) continue;

		const line = currentLine.trim();

		// Check if line is a header
		if (line.startsWith('#')) {
			if (line.toLowerCase() === normalizedHeading) {
				inAgendaSection = true;
				continue;
			} else if (inAgendaSection) {
				// We exited the agenda section upon encountering another header
				break;
			}
		}

		if (inAgendaSection && line.length > 0) {
			const match = line.match(AGENDA_ITEM_REGEX);
			if (match) {
				const completedMark = match[1] ?? '';
				const startTime = normalizeTime(match[2] ?? '');
				const endTime = normalizeTime(match[3] ?? '');
				const title = match[4] ? match[4].trim() : '';
				const description = match[5] ? match[5].trim() : undefined;

				events.push({
					id: `${dateStr}-${startTime}-${title}`,
					date: dateStr,
					startTime,
					endTime,
					title,
					description,
					completed: completedMark.toLowerCase() === 'x',
				});
			}
		}
	}

	const sortedEvents = events.sort((a, b) => {
		const dateA = new Date(`${dateStr}T${a.startTime}`);
		const dateB = new Date(`${dateStr}T${b.startTime}`);
		return dateA.getTime() - dateB.getTime();
	});

	return sortedEvents;
}

/**
 * Formats a CalendarEvent into markdown string standard.
 */
export function formatEventToMarkdown(
	event: Omit<CalendarEvent, 'date'>,
): string {
	const completedMarker = event.completed ? 'x' : ' ';
	const descSuffix = event.description ? ` | ${event.description}` : '';
	return `- [${completedMarker}] ${event.startTime} - ${event.endTime} | **${event.title}**${descSuffix}`;
}

/**
 * Injects a new event under the specified heading in the markdown document.
 * If heading does not exist, appends heading and event to the document.
 */
export function injectEventIntoAgenda(
	markdown: string,
	event: Omit<CalendarEvent, 'date'>,
	heading: string = '## Agenda',
): string {
	const formattedEventLine = formatEventToMarkdown(event);
	const lines = markdown.split(/\r?\n/);
	const normalizedHeading = heading.trim().toLowerCase();

	let headingIndex = -1;
	let nextHeadingIndex = -1;

	for (let i = 0; i < lines.length; i++) {
		const currentLine = lines[i];
		if (currentLine === undefined) continue;

		const line = currentLine.trim();
		if (line.startsWith('#')) {
			if (line.toLowerCase() === normalizedHeading) {
				headingIndex = i;
			} else if (headingIndex !== -1 && nextHeadingIndex === -1) {
				nextHeadingIndex = i;
				break;
			}
		}
	}

	if (headingIndex !== -1) {
		// Heading exists
		const sectionEndIndex =
			nextHeadingIndex !== -1 ? nextHeadingIndex : lines.length;

		let insertIndex = -1;
		let lastAgendaItemIndex = headingIndex;
		const eventStartTime = normalizeTime(event.startTime);

		for (let i = headingIndex + 1; i < sectionEndIndex; i++) {
			const currentLine = lines[i];
			if (currentLine === undefined) continue;

			const match = currentLine.trim().match(AGENDA_ITEM_REGEX);
			if (match && match[2]) {
				lastAgendaItemIndex = i;
				const existingStartTime = normalizeTime(match[2]);

				// Insert before the first existing event that starts later
				if (eventStartTime.localeCompare(existingStartTime) < 0) {
					insertIndex = i;
					break;
				}
			}
		}

		// If no later event was found, insert after the last agenda item line
		if (insertIndex === -1) {
			insertIndex = lastAgendaItemIndex + 1;
		}

		lines.splice(insertIndex, 0, formattedEventLine);
		return lines.join('\n');
	} else {
		// Heading does not exist; append to end of file
		let result = markdown.trimEnd();
		if (result.length > 0) {
			result += '\n\n';
		}
		result += `${heading}\n${formattedEventLine}\n`;
		return result;
	}
}
