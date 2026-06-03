import { Box, render, Text, useApp, useInput } from "ink";
import React, { useCallback, useState } from "react";
import { buildCursorCommand, runCursorCommand } from "./command.mjs";

const MAX_LOG_LINES = 12;

export async function runInteractiveTui(options = {}) {
	if (!process.stdin.isTTY) {
		return runLineInputFallback(options);
	}

	let exitStatus = 0;
	const app = render(
		React.createElement(LazycursorTuiApp, {
			autoExit: process.env.LAZYCURSOR_TUI_AUTO_EXIT === "1",
			cursorAgentBin: options.cursorAgentBin ?? "cursor-agent",
			onExitStatus: (status) => {
				exitStatus = status;
			},
			runCommand: options.runCommand ?? runCursorCommand,
		}),
		{ exitOnCtrlC: true },
	);

	await app.waitUntilExit();
	return exitStatus;
}

async function runLineInputFallback(options) {
	process.stdout.write("lazycursor> ");
	const chunks = [];
	for await (const chunk of process.stdin) {
		chunks.push(Buffer.from(chunk));
	}
	const prompt = Buffer.concat(chunks)
		.toString("utf8")
		.split(/\r?\n|\r/u)[0]
		.trim();

	if (prompt.length === 0) {
		console.error("No task provided.");
		return 2;
	}

	const cursorAgentBin = options.cursorAgentBin ?? "cursor-agent";
	const runCommand = options.runCommand ?? runCursorCommand;
	return runCommand(buildCursorCommand(["tui", prompt], { cursorAgentBin }));
}

export function LazycursorTuiApp({
	autoExit = false,
	cursorAgentBin = "cursor-agent",
	onExitStatus,
	runCommand = runCursorCommand,
}) {
	const { exit } = useApp();
	const [prompt, setPrompt] = useState("");
	const [phase, setPhase] = useState("editing");
	const [statusText, setStatusText] = useState("Enter an ultrawork task");
	const [logs, setLogs] = useState([]);

	const appendLog = useCallback((text) => {
		setLogs((current) => trimLogLines([...current, ...splitOutput(text)]));
	}, []);

	const submit = useCallback(
		(value = prompt) => {
			const task = value.trim();
			if (task.length === 0 || phase === "running") {
				return;
			}

			setPhase("running");
			setStatusText("Running ACP ultrawork");
			setLogs([`> ${task}`]);

			const command = buildCursorCommand(["tui", task], { cursorAgentBin });
			void runCommand(command, { onOutput: appendLog })
				.then((status) => {
					const nextPhase = status === 0 ? "done" : "failed";
					setPhase(nextPhase);
					setStatusText(
						status === 0
							? "Done. Press q or Enter to exit."
							: `Failed with exit status ${status}. Press q or Enter to exit.`,
					);
					onExitStatus?.(status);
					if (autoExit) {
						setTimeout(exit, 0);
					}
				})
				.catch((error) => {
					setPhase("failed");
					setStatusText(
						"Failed with an ACP runner error. Press q or Enter to exit.",
					);
					appendLog(error instanceof Error ? error.message : String(error));
					onExitStatus?.(1);
					if (autoExit) {
						setTimeout(exit, 0);
					}
				});
		},
		[
			appendLog,
			autoExit,
			cursorAgentBin,
			exit,
			onExitStatus,
			phase,
			prompt,
			runCommand,
		],
	);

	useInput(
		(input, key) => {
			if (key.ctrl && input === "c") {
				onExitStatus?.(130);
				exit();
				return;
			}

			if (phase === "done" || phase === "failed") {
				if (key.return || input === "q") {
					exit();
				}
				return;
			}

			if (phase !== "editing") {
				return;
			}

			const lineBreak = input.includes("\r") || input.includes("\n");
			if (key.return || lineBreak) {
				const text = input.replace(/\r?\n/g, "");
				const nextPrompt = `${prompt}${text}`;
				if (text.length > 0) {
					setPrompt(nextPrompt);
				}
				submit(nextPrompt);
				return;
			}

			if (key.backspace || key.delete) {
				setPrompt((current) => current.slice(0, -1));
				return;
			}

			if (input.length > 0) {
				setPrompt((current) => `${current}${input}`);
			}
		},
		{ isActive: true },
	);

	return React.createElement(
		Box,
		{ flexDirection: "column" },
		React.createElement(
			Text,
			{ bold: true, color: phaseColor(phase) },
			"lazycursor",
		),
		React.createElement(Text, null, statusText),
		React.createElement(Text, null, `Task: ${prompt}`),
		React.createElement(
			Text,
			null,
			"Obligations: plan -> implementation -> verification -> report",
		),
		React.createElement(
			Box,
			{ flexDirection: "column", marginTop: 1 },
			...logs.map((line, index) =>
				React.createElement(Text, { key: `${index}:${line}` }, line),
			),
		),
	);
}

function phaseColor(phase) {
	if (phase === "done") {
		return "green";
	}
	if (phase === "failed") {
		return "red";
	}
	if (phase === "running") {
		return "yellow";
	}
	return "cyan";
}

function splitOutput(text) {
	return text
		.split(/\r?\n/)
		.map((line) => line.trimEnd())
		.filter((line) => line.length > 0);
}

function trimLogLines(lines) {
	return lines.slice(Math.max(0, lines.length - MAX_LOG_LINES));
}
