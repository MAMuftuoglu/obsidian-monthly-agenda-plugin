import { AgendaNote, CalendarEvent, DailyAgendaData } from '../types';

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
 * Parses markdown text to extract events and notes under a specific heading (default: ## Agenda).
 */
export function parseAgendaData(
	markdown: string,
	dateStr: string,
	heading: string = '## Agenda',
): DailyAgendaData {
	const events: CalendarEvent[] = [];
	const notes: AgendaNote[] = [];
	if (!markdown) return { events, notes };

	const lines = markdown.split(/\r?\n/);
	let inAgendaSection = false;
	const normalizedHeading = heading.trim().toLowerCase();
	const headingLevel = (heading.match(/^#+/) || ['##'])[0].length;

	for (let i = 0; i < lines.length; i++) {
		const currentLine = lines[i];
		if (currentLine === undefined) continue;

		const line = currentLine.trim();

		// Check if line is a header
		if (line.startsWith('#')) {
			const currentLevel = (line.match(/^#+/) || ['#'])[0].length;
			if (line.toLowerCase() === normalizedHeading) {
				inAgendaSection = true;
				continue;
			} else if (inAgendaSection) {
				if (currentLevel <= headingLevel) {
					// Exited main agenda section upon encountering same-or-higher level header
					break;
				}
				// Subheader inside agenda section (e.g. ### Notes), remain in section
				continue;
			}
		}

		if (inAgendaSection && line.length > 0) {
			const eventMatch = line.match(AGENDA_ITEM_REGEX);
			if (eventMatch) {
				const completedMark = eventMatch[1] ?? '';
				const startTime = normalizeTime(eventMatch[2] ?? '');
				const endTime = normalizeTime(eventMatch[3] ?? '');
				const title = eventMatch[4] ? eventMatch[4].trim() : '';
				const description = eventMatch[5] ? eventMatch[5].trim() : undefined;

				events.push({
					id: `${dateStr}-${startTime}-${title}`,
					date: dateStr,
					startTime,
					endTime,
					title,
					description,
					completed: completedMark.toLowerCase() === 'x',
				});
			} else if (/^\s*[-*]\s+/.test(line)) {
				// Bullet line that is not a timed event -> parse as AgendaNote
				const isTodoMatch = line.match(/^\s*[-*]\s+\[([ xX]?)\]\s/);
				const isTodo = !!isTodoMatch;
				const completed = isTodoMatch && isTodoMatch[1] ? isTodoMatch[1].toLowerCase() === 'x' : false;

				let title = line.replace(/^\s*[-*]\s+(?:\[[ xX]?\]\s*)?/, '').trim();
				if (title.startsWith('**') && title.endsWith('**') && title.length > 4) {
					title = title.slice(2, -2).trim();
				}
				if (title.length > 0) {
					notes.push({
						id: `${dateStr}-note-${notes.length + 1}-${title}`,
						date: dateStr,
						title,
						isTodo,
						completed,
					});
				}
			}
		}
	}

	const sortedEvents = events.sort((a, b) => {
		const dateA = new Date(`${dateStr}T${a.startTime}`);
		const dateB = new Date(`${dateStr}T${b.startTime}`);
		return dateA.getTime() - dateB.getTime();
	});

	return { events: sortedEvents, notes };
}

/**
 * Parses markdown text to extract events under a specific heading (default: ## Agenda).
 */
export function parseAgendaEvents(
	markdown: string,
	dateStr: string,
	heading: string = '## Agenda',
): CalendarEvent[] {
	return parseAgendaData(markdown, dateStr, heading).events;
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
 * Formats an AgendaNote into markdown string standard.
 */
export function formatNoteToMarkdown(
	note: Omit<AgendaNote, 'date'>,
): string {
	if (note.isTodo) {
		return `- [${note.completed ? 'x' : ' '}] ${note.title}`;
	}
	return `- ${note.title}`;
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

/**
 * Injects a new note under the specified heading (under ### Notes subheader) in the markdown document.
 */
export function injectNoteIntoAgenda(
	markdown: string,
	note: Omit<AgendaNote, 'date'>,
	heading: string = '## Agenda',
): string {
	const formattedNoteLine = formatNoteToMarkdown(note);
	const lines = markdown.split(/\r?\n/);
	const normalizedHeading = heading.trim().toLowerCase();
	const headingLevel = (heading.match(/^#+/) || ['##'])[0].length;

	let headingIndex = -1;
	let nextHeadingIndex = -1;

	for (let i = 0; i < lines.length; i++) {
		const currentLine = lines[i];
		if (currentLine === undefined) continue;

		const line = currentLine.trim();
		if (line.startsWith('#')) {
			const currentLevel = (line.match(/^#+/) || ['#'])[0].length;
			if (line.toLowerCase() === normalizedHeading) {
				headingIndex = i;
			} else if (
				headingIndex !== -1 &&
				nextHeadingIndex === -1 &&
				currentLevel <= headingLevel
			) {
				nextHeadingIndex = i;
				break;
			}
		}
	}

	if (headingIndex !== -1) {
		const sectionEndIndex =
			nextHeadingIndex !== -1 ? nextHeadingIndex : lines.length;

		let notesHeaderIndex = -1;
		let nextSubheaderIndex = -1;

		for (let i = headingIndex + 1; i < sectionEndIndex; i++) {
			const currentLine = lines[i];
			if (currentLine === undefined) continue;

			const line = currentLine.trim();
			if (line.startsWith('#')) {
				if (line.toLowerCase().includes('notes')) {
					notesHeaderIndex = i;
				} else if (
					notesHeaderIndex !== -1 &&
					nextSubheaderIndex === -1
				) {
					nextSubheaderIndex = i;
					break;
				}
			}
		}

		if (notesHeaderIndex !== -1) {
			const subEndIndex =
				nextSubheaderIndex !== -1
					? nextSubheaderIndex
					: sectionEndIndex;
			let lastNoteLineIndex = notesHeaderIndex;

			for (let i = notesHeaderIndex + 1; i < subEndIndex; i++) {
				const currentLine = lines[i];
				if (currentLine === undefined) continue;
				if (currentLine.trim().length > 0) {
					lastNoteLineIndex = i;
				}
			}

			lines.splice(lastNoteLineIndex + 1, 0, formattedNoteLine);
			return lines.join('\n');
		} else {
			let lastContentIndex = headingIndex;
			for (let i = headingIndex + 1; i < sectionEndIndex; i++) {
				const currentLine = lines[i];
				if (currentLine !== undefined && currentLine.trim().length > 0) {
					lastContentIndex = i;
				}
			}

			const toInsert = ['', '### Notes', formattedNoteLine];
			lines.splice(lastContentIndex + 1, 0, ...toInsert);
			return lines.join('\n');
		}
	} else {
		let result = markdown.trimEnd();
		if (result.length > 0) {
			result += '\n\n';
		}
		result += `${heading}\n\n### Notes\n${formattedNoteLine}\n`;
		return result;
	}
}

/**
 * Injects multiple to-do notes at the beginning of the Notes section.
 */
export function injectDailyTodosIntoAgenda(
	markdown: string,
	todos: string[],
	heading: string = '## Agenda',
): string {
	if (todos.length === 0) return markdown;

	let currentContent = markdown;
	// We want to insert them at the beginning of the Notes section.
	// Easiest approach: format them, find the `### Notes` header, and insert right after it.
	// If `### Notes` doesn't exist, we can use `injectNoteIntoAgenda` to add the first one (which creates the section),
	// then insert the rest.

	const formattedTodos = todos.map(t => formatNoteToMarkdown({ title: t, isTodo: true, completed: false }));

	const lines = currentContent.split(/\r?\n/);
	const normalizedHeading = heading.trim().toLowerCase();
	const headingLevel = (heading.match(/^#+/) || ['##'])[0].length;

	let headingIndex = -1;
	let nextHeadingIndex = -1;

	for (let i = 0; i < lines.length; i++) {
		const line = (lines[i] || '').trim();
		if (line.startsWith('#')) {
			const currentLevel = (line.match(/^#+/) || ['#'])[0].length;
			if (line.toLowerCase() === normalizedHeading) {
				headingIndex = i;
			} else if (
				headingIndex !== -1 &&
				nextHeadingIndex === -1 &&
				currentLevel <= headingLevel
			) {
				nextHeadingIndex = i;
				break;
			}
		}
	}

	if (headingIndex !== -1) {
		const sectionEndIndex = nextHeadingIndex !== -1 ? nextHeadingIndex : lines.length;
		let notesHeaderIndex = -1;

		for (let i = headingIndex + 1; i < sectionEndIndex; i++) {
			const line = (lines[i] || '').trim();
			if (line.startsWith('#') && line.toLowerCase().includes('notes')) {
				notesHeaderIndex = i;
				break;
			}
		}

		if (notesHeaderIndex !== -1) {
			// Insert immediately after notes header
			lines.splice(notesHeaderIndex + 1, 0, ...formattedTodos);
			return lines.join('\n');
		} else {
			// No notes header, insert at end of agenda section
			let lastContentIndex = headingIndex;
			for (let i = headingIndex + 1; i < sectionEndIndex; i++) {
				const line = lines[i];
				if (line !== undefined && line.trim().length > 0) {
					lastContentIndex = i;
				}
			}
			const toInsert = ['', '### Notes', ...formattedTodos];
			lines.splice(lastContentIndex + 1, 0, ...toInsert);
			return lines.join('\n');
		}
	} else {
		// No agenda heading, append at the end of the document
		let result = currentContent.trimEnd();
		if (result.length > 0) {
			result += '\n\n';
		}
		result += `${heading}\n\n### Notes\n${formattedTodos.join('\n')}\n`;
		return result;
	}
}

