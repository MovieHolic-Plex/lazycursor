export const OBLIGATIONS = ["plan", "implementation", "verification", "report"];
export const TRANSCRIPT_LIMIT = 120;
export const TRANSCRIPT_VIEW_SIZE = 12;

export function createInitialTranscript() {
	return [
		{
			kind: "system",
			text: "Ready. Type a task and press Enter.",
		},
	];
}

export function appendTranscript(entries, kind, text) {
	return trimTranscript([
		...entries,
		...splitOutput(text).map((line) => ({ kind, text: line })),
	]);
}

export function appendStreamingTranscript(entries, kind, text) {
	const chunks = String(text).replaceAll("\r\n", "\n").split("\n");
	const nextEntries = [...entries];

	for (let index = 0; index < chunks.length; index += 1) {
		const chunk = chunks[index];
		if (chunk.length > 0) {
			appendStreamingChunk(nextEntries, kind, chunk);
		}
		if (index < chunks.length - 1) {
			sealLastEntry(nextEntries);
		}
	}

	return trimTranscript(nextEntries);
}

export function getVisibleTranscript(entries, scrollOffset) {
	const safeOffset = Math.max(0, Math.min(scrollOffset, entries.length));
	const end = Math.max(0, entries.length - safeOffset);
	const start = Math.max(0, end - TRANSCRIPT_VIEW_SIZE);
	return entries.slice(start, end);
}

export function nextScrollOffset(current, direction, entries) {
	const maxOffset = Math.max(0, entries.length - TRANSCRIPT_VIEW_SIZE);
	if (direction === "up") {
		return Math.min(maxOffset, current + 1);
	}
	return Math.max(0, current - 1);
}

export function phaseMeta(phase) {
	switch (phase) {
		case "done":
			return { color: "green", label: "DONE" };
		case "failed":
			return { color: "red", label: "FAILED" };
		case "running":
			return { color: "yellow", label: "RUNNING" };
		case "editing":
			return { color: "cyan", label: "READY" };
		default:
			return { color: "white", label: "UNKNOWN" };
	}
}

export function entryMeta(kind) {
	switch (kind) {
		case "user":
			return { color: "cyan", label: "USER" };
		case "agent":
			return { color: "green", label: "AGENT" };
		case "result":
			return { color: "yellow", label: "RESULT" };
		case "error":
			return { color: "red", label: "ERROR" };
		case "system":
			return { color: "gray", label: "SYSTEM" };
		default:
			return { color: "white", label: "LOG" };
	}
}

export function splitOutput(text) {
	return String(text)
		.split(/\r?\n/)
		.map((line) => line.trimEnd())
		.filter((line) => line.length > 0);
}

function appendStreamingChunk(entries, kind, text) {
	const last = entries.at(-1);
	if (last?.kind === kind && last.sealed !== true) {
		entries[entries.length - 1] = {
			...last,
			text: `${last.text}${text}`,
		};
		return;
	}
	entries.push({ kind, text, sealed: false });
}

function sealLastEntry(entries) {
	const last = entries.at(-1);
	if (last !== undefined) {
		entries[entries.length - 1] = { ...last, sealed: true };
	}
}

function trimTranscript(entries) {
	return entries.slice(Math.max(0, entries.length - TRANSCRIPT_LIMIT));
}
