import { Box, Text } from "ink";
import React from "react";
import { entryMeta, OBLIGATIONS } from "./tui-format.mjs";

export function LazycursorFrame({
	activeTask,
	color,
	composerText,
	currentActivity,
	cursorAgentBin,
	model,
	phase,
	statusText,
	statusLabel,
	todoItems,
	transcript,
	workflowPhase = phase,
}) {
	return React.createElement(
		Box,
		{ flexDirection: "column", paddingX: 1 },
		React.createElement(Header, { label: statusLabel, color }),
		React.createElement(StatusRail, { activeTask, cursorAgentBin, model }),
		React.createElement(ObligationRail, {
			completed: workflowPhase === "done",
		}),
		React.createElement(
			Box,
			{ flexDirection: "row", gap: 1 },
			React.createElement(TranscriptPanel, {
				color,
				entries: transcript,
			}),
			React.createElement(TodoPanel, {
				activity: currentActivity,
				color,
				items: todoItems,
				phase: workflowPhase,
			}),
		),
		React.createElement(ComposerPanel, { phase, text: composerText }),
		React.createElement(Text, { color }, statusText),
		React.createElement(
			Text,
			{ color: "gray" },
			"Enter submit | ↑/↓ scroll | Ctrl+L clear | Ctrl+C exit | q exit",
		),
	);
}

function Header({ color, label }) {
	return React.createElement(
		Box,
		{ justifyContent: "space-between" },
		React.createElement(
			Text,
			{ bold: true, color },
			"lazycursor",
			React.createElement(Text, { color: "gray" }, "  ACP ultrawork"),
		),
		React.createElement(Text, { bold: true, color }, label),
	);
}

function StatusRail({ activeTask, cursorAgentBin, model }) {
	return React.createElement(
		Box,
		{ flexDirection: "column" },
		React.createElement(
			Text,
			null,
			React.createElement(Text, { color: "gray" }, "runner: "),
			cursorAgentBin,
		),
		React.createElement(
			Text,
			null,
			React.createElement(Text, { color: "gray" }, "mode: "),
			"json-state stop-loop",
		),
		React.createElement(
			Text,
			null,
			React.createElement(Text, { color: "gray" }, "model: "),
			model ?? "cursor default",
		),
		React.createElement(
			Text,
			null,
			React.createElement(Text, { color: "gray" }, "task: "),
			activeTask || "-",
		),
	);
}

function ObligationRail({ completed }) {
	return React.createElement(
		Box,
		{ gap: 1, marginTop: 1 },
		...OBLIGATIONS.map((obligation) =>
			React.createElement(
				Text,
				{ key: obligation, color: completed ? "green" : "yellow" },
				`[${obligation}]`,
			),
		),
	);
}

function TranscriptPanel({ color, entries }) {
	return React.createElement(
		Box,
		{
			borderColor: color,
			borderStyle: "round",
			flexDirection: "column",
			flexGrow: 1,
			marginTop: 1,
			paddingX: 1,
		},
		React.createElement(Text, { bold: true }, "Transcript"),
		...entries.map((entry, index) =>
			React.createElement(TranscriptLine, {
				entry,
				key: `${index}:${entry.kind}:${entry.text}`,
			}),
		),
	);
}

function TodoPanel({ activity, color, items, phase }) {
	return React.createElement(
		Box,
		{
			borderColor: color,
			borderStyle: "round",
			flexDirection: "column",
			marginTop: 1,
			paddingX: 1,
			width: 32,
		},
		React.createElement(Text, { bold: true }, "Todo"),
		React.createElement(
			Text,
			{ color: "gray" },
			React.createElement(Text, { color }, "Now: "),
			activity,
		),
		React.createElement(Text, { color: "gray" }, `State: ${phase}`),
		...items.map((item) =>
			React.createElement(
				Text,
				{ key: item.name, color: todoColor(item.status) },
				`${todoMark(item.status)} ${item.name}`,
			),
		),
	);
}

function ComposerPanel({ phase, text }) {
	return React.createElement(
		Box,
		{
			borderColor: phase === "editing" ? "cyan" : "gray",
			borderStyle: "single",
			flexDirection: "column",
			marginTop: 1,
			paddingX: 1,
		},
		React.createElement(Text, { color: "gray" }, "Composer"),
		React.createElement(
			Text,
			{ color: phase === "editing" ? "white" : "gray" },
			text,
		),
	);
}

function TranscriptLine({ entry }) {
	const meta = entryMeta(entry.kind);
	return React.createElement(
		Box,
		null,
		React.createElement(Text, { bold: true, color: meta.color }, meta.label),
		React.createElement(Text, null, "  "),
		React.createElement(Text, null, entry.text),
	);
}

function todoMark(status) {
	switch (status) {
		case "done":
			return "[x]";
		case "active":
			return "[>]";
		case "failed":
			return "[!]";
		default:
			return "[ ]";
	}
}

function todoColor(status) {
	switch (status) {
		case "done":
			return "green";
		case "active":
			return "yellow";
		case "failed":
			return "red";
		default:
			return "gray";
	}
}
