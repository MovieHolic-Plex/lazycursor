import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

export const DEFAULT_OBLIGATIONS = [
	{ id: "deep-interview", status: "pending" },
	{ id: "ralplan", status: "pending" },
	{ id: "ultragoal", status: "pending" },
	{ id: "team", status: "pending", optional: true },
];

export const INITIAL_STATE = {
	active: false,
	mode: "idle",
	phase: "idle",
	obligations: [],
	stopLoopCount: 0,
};

export function getStatePath(workspace = process.cwd()) {
	return join(resolve(workspace), ".cursor", "lazycursor", "state.json");
}

export function getEventsPath(workspace = process.cwd()) {
	return join(resolve(workspace), ".cursor", "lazycursor", "events.jsonl");
}

export function activateUltraworkState(workspace, prompt, source = "wrapper") {
	const current = readLazycursorState(workspace);
	if (current.active) {
		appendLazycursorEvent(workspace, {
			event: "activate_ignored_active",
			prompt,
			source,
		});
		return current;
	}

	const now = new Date().toISOString();
	const nextState = {
		active: true,
		mode: "ulw",
		phase: "planning",
		prompt,
		obligations: DEFAULT_OBLIGATIONS,
		stopLoopCount: 0,
		startedAt: now,
		updatedAt: now,
	};
	writeLazycursorState(workspace, nextState);
	appendLazycursorEvent(workspace, { event: "activate", prompt, source });
	return nextState;
}

export function inspectLazycursorStop(
	workspace,
	limit = 8,
	source = "wrapper",
) {
	const state = readLazycursorState(workspace);
	if (!state.active) {
		return { kind: "inactive", pending: [], state };
	}

	const obligations = Array.isArray(state.obligations) ? state.obligations : [];
	const pending = obligations.filter(
		(item) => item?.status !== "done" && item?.optional !== true,
	);
	if (pending.length === 0) {
		const now = new Date().toISOString();
		const nextState = {
			...state,
			active: false,
			phase: "finished",
			completedAt: now,
			updatedAt: now,
		};
		writeLazycursorState(workspace, nextState);
		appendLazycursorEvent(workspace, { event: "finish", source });
		return { kind: "finished", pending: [], state: nextState };
	}

	const stopLoopCount = Number.isInteger(state.stopLoopCount)
		? state.stopLoopCount + 1
		: 1;
	const nextState = {
		...state,
		stopLoopCount,
		updatedAt: new Date().toISOString(),
	};
	writeLazycursorState(workspace, nextState);
	appendLazycursorEvent(workspace, {
		event: "stop_block",
		pending: pending.map((item) => item.id),
		source,
		stopLoopCount,
	});

	const kind = stopLoopCount > limit ? "limit_exceeded" : "blocked";
	return { kind, pending, state: nextState };
}

export function buildStopFollowup(pending, label = "WRAPPER") {
	return [
		`LAZYCURSOR STOP ${label}: active ultrawork state is not complete.`,
		"Read .cursor/lazycursor/state.json, finish required pending obligations, and update the JSON state as evidence is completed.",
		`Required pending obligations: ${pending.map((item) => item.id).join(", ")}`,
		"Do not set active=false until ultragoal evidence and final reporting are complete.",
	].join("\n");
}

export function readLazycursorState(workspace = process.cwd()) {
	const path = getStatePath(workspace);
	if (!existsSync(path)) {
		return INITIAL_STATE;
	}
	try {
		return JSON.parse(readFileSync(path, "utf8"));
	} catch (error) {
		if (error instanceof SyntaxError) {
			return {
				active: true,
				mode: "ulw",
				phase: "invalid_state",
				obligations: [{ id: "repair_state", status: "pending" }],
				stopLoopCount: 0,
			};
		}
		throw error;
	}
}

export function writeLazycursorState(workspace, state) {
	const path = getStatePath(workspace);
	mkdirSync(dirname(path), { recursive: true });
	const tempPath = `${path}.${process.pid}.tmp`;
	writeFileSync(tempPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
	renameSync(tempPath, path);
}

export function appendLazycursorEvent(workspace, event) {
	const path = getEventsPath(workspace);
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(
		path,
		`${JSON.stringify({ ...event, at: new Date().toISOString() })}\n`,
		{
			encoding: "utf8",
			flag: "a",
		},
	);
}
