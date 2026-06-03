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

function trimTranscript(entries) {
	return entries.slice(Math.max(0, entries.length - TRANSCRIPT_LIMIT));
}
