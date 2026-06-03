import { render, useApp, useInput } from "ink";
import React, { useCallback, useRef, useState } from "react";
import { createAcpConversation } from "./acp.mjs";
import { buildCursorCommand } from "./command.mjs";
import {
	getComposerText,
	runLineInputFallback,
	submitTask,
} from "./tui-controller.mjs";
import {
	activityText,
	appendStreamingTranscript,
	appendTranscript,
	buildTodoItems,
	createInitialTranscript,
	getVisibleTranscript,
	phaseMeta,
} from "./tui-format.mjs";
import { handleTuiInput } from "./tui-input.mjs";
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
			runCommand: options.runCommand,
		}),
		{ exitOnCtrlC: true },
	);

	await app.waitUntilExit();
	return exitStatus;
}

export function LazycursorTuiApp({
	autoExit = false,
	conversationFactory = createAcpConversation,
	cursorAgentBin = "cursor-agent",
	model,
	onExitStatus,
	runCommand,
}) {
	const { exit } = useApp();
	const [prompt, setPrompt] = useState("");
	const [phase, setPhase] = useState("editing");
	const [statusText, setStatusText] = useState("Enter an ultrawork task");
	const [submittedTask, setSubmittedTask] = useState("");
	const [scrollOffset, setScrollOffset] = useState(0);
	const [transcript, setTranscript] = useState(createInitialTranscript);
	const [lastActivity, setLastActivity] = useState("");
	const [conversation, setConversation] = useState(null);
	const conversationRef = useRef(null);

	const appendEntry = useCallback((kind, text) => {
		setScrollOffset(0);
		setLastActivity(text.trim());
		setTranscript((current) => appendTranscript(current, kind, text));
	}, []);

	const appendStreamEntry = useCallback((kind, text) => {
		setScrollOffset(0);
		setLastActivity((current) =>
			`${current}${text}`.replace(/\s+/g, " ").trim(),
		);
		setTranscript((current) => appendStreamingTranscript(current, kind, text));
	}, []);

	const closeTui = useCallback(() => {
		const currentConversation = conversationRef.current ?? conversation;
		currentConversation?.close();
		conversationRef.current = null;
		setConversation(null);
		exit();
	}, [conversation, exit]);

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
			setLastActivity("Starting ACP session");
			setTranscript((current) => appendTranscript(current, "user", task));

			const command = buildCursorCommand(["tui", task], {
				cursorAgentBin,
				model,
			});
			void submitTask({
				command,
				conversation,
				conversationFactory,
				onConversation: (nextConversation) => {
					conversationRef.current = nextConversation;
					setConversation(nextConversation);
				},
				onOutput: (text) => appendStreamEntry("agent", text),
				runCommand,
				task,
			})
				.then((status) => {
					const nextPhase = status === 0 ? "editing" : "failed";
					setPhase(nextPhase);
					setStatusText(
						status === 0
							? "Turn complete. Type a follow-up or press q to exit."
							: `Failed with exit status ${status}. Press q or Enter to exit.`,
					);
					appendEntry(
						status === 0 ? "result" : "error",
						status === 0
							? "Turn complete. Continue the conversation or press q."
							: `Failed with exit status ${status}.`,
					);
					onExitStatus?.(status);
					if (autoExit) {
						setTimeout(closeTui, 0);
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
						setTimeout(closeTui, 0);
					}
				});
		},
		[
			appendEntry,
			appendStreamEntry,
			autoExit,
			closeTui,
			conversation,
			conversationFactory,
			cursorAgentBin,
			model,
			onExitStatus,
			phase,
			prompt,
			runCommand,
		],
	);

	useInput(
		(input, key) => {
			handleTuiInput({
				closeTui,
				input,
				key,
				onExitStatus,
				phase,
				prompt,
				setPrompt,
				setScrollOffset,
				setTranscript,
				submit,
				transcript,
			});
		},
		{ isActive: true },
	);

	const meta = phaseMeta(phase);
	const visibleTranscript = getVisibleTranscript(transcript, scrollOffset);
	const activeTask = submittedTask.length > 0 ? submittedTask : prompt;
	const composerText = getComposerText({ phase, prompt });
	const workflowPhase = statusText.startsWith("Turn complete") ? "done" : phase;
	const currentActivity = activityText({ lastActivity, phase: workflowPhase });
	const todoItems = buildTodoItems(workflowPhase);

	return React.createElement(LazycursorFrame, {
		activeTask,
		color: meta.color,
		composerText,
		currentActivity,
		cursorAgentBin,
		model,
		phase,
		statusLabel: meta.label,
		statusText,
		todoItems,
		transcript: visibleTranscript,
		workflowPhase,
	});
}
