import { render, useApp, useInput } from "ink";
import React, { useCallback, useState } from "react";
import { buildCursorCommand, runCursorCommand } from "./command.mjs";
import {
	appendStreamingTranscript,
	appendTranscript,
	createInitialTranscript,
	getVisibleTranscript,
	nextScrollOffset,
	phaseMeta,
} from "./tui-format.mjs";
import { LazycursorFrame } from "./tui-view.mjs";

export async function runInteractiveTui(options = {}) {
	if (!process.stdin.isTTY) {
		return runLineInputFallback(options);
	}

	let exitStatus = 0;
	const app = render(
		React.createElement(LazycursorTuiApp, {
			autoExit: process.env.LAZYCURSOR_TUI_AUTO_EXIT === "1",
			cursorAgentBin: options.cursorAgentBin ?? "cursor-agent",
			model: options.model,
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
	return runCommand(
		buildCursorCommand(["tui", prompt], {
			cursorAgentBin,
			model: options.model,
		}),
	);
}

export function LazycursorTuiApp({
	autoExit = false,
	cursorAgentBin = "cursor-agent",
	model,
	onExitStatus,
	runCommand = runCursorCommand,
}) {
	const { exit } = useApp();
	const [prompt, setPrompt] = useState("");
	const [phase, setPhase] = useState("editing");
	const [statusText, setStatusText] = useState("Enter an ultrawork task");
	const [submittedTask, setSubmittedTask] = useState("");
	const [scrollOffset, setScrollOffset] = useState(0);
	const [transcript, setTranscript] = useState(createInitialTranscript);

	const appendEntry = useCallback((kind, text) => {
		setScrollOffset(0);
		setTranscript((current) => appendTranscript(current, kind, text));
	}, []);

	const appendStreamEntry = useCallback((kind, text) => {
		setScrollOffset(0);
		setTranscript((current) => appendStreamingTranscript(current, kind, text));
	}, []);

	const submit = useCallback(
		(value = prompt) => {
			const task = value.trim();
			if (task.length === 0 || phase === "running") {
				return;
			}

			setPhase("running");
			setStatusText("Running ACP ultrawork");
			setSubmittedTask(task);
			setPrompt("");
			setScrollOffset(0);
			setTranscript(appendTranscript(createInitialTranscript(), "user", task));

			const command = buildCursorCommand(["tui", task], {
				cursorAgentBin,
				model,
			});
			void runCommand(command, {
				onOutput: (text) => appendStreamEntry("agent", text),
			})
				.then((status) => {
					const nextPhase = status === 0 ? "done" : "failed";
					setPhase(nextPhase);
					setStatusText(
						status === 0
							? "Done. Press q or Enter to exit."
							: `Failed with exit status ${status}. Press q or Enter to exit.`,
					);
					appendEntry(
						status === 0 ? "result" : "error",
						status === 0
							? "Done. All lazycursor obligations are closed."
							: `Failed with exit status ${status}.`,
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
					appendEntry(
						"error",
						error instanceof Error ? error.message : String(error),
					);
					onExitStatus?.(1);
					if (autoExit) {
						setTimeout(exit, 0);
					}
				});
		},
		[
			appendEntry,
			appendStreamEntry,
			autoExit,
			cursorAgentBin,
			exit,
			model,
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

			if (key.ctrl && input === "l") {
				setTranscript(createInitialTranscript());
				setScrollOffset(0);
				return;
			}

			if (key.upArrow) {
				setScrollOffset((current) =>
					nextScrollOffset(current, "up", transcript),
				);
				return;
			}

			if (key.downArrow) {
				setScrollOffset((current) =>
					nextScrollOffset(current, "down", transcript),
				);
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

	const meta = phaseMeta(phase);
	const visibleTranscript = getVisibleTranscript(transcript, scrollOffset);
	const activeTask = submittedTask.length > 0 ? submittedTask : prompt;
	const composerText = getComposerText({ phase, prompt });

	return React.createElement(LazycursorFrame, {
		activeTask,
		color: meta.color,
		composerText,
		cursorAgentBin,
		model,
		phase,
		statusLabel: meta.label,
		statusText,
		transcript: visibleTranscript,
	});
}

function getComposerText({ phase, prompt }) {
	switch (phase) {
		case "editing":
			return prompt.length > 0 ? `${prompt}_` : "Type an ultrawork task...";
		case "running":
			return "Agent is running. Transcript is live.";
		case "done":
			return "Run complete. Press q or Enter to exit.";
		case "failed":
			return "Run failed. Transcript is retained.";
		default:
			return "Waiting for input.";
	}
}
