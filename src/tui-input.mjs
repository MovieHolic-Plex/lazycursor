import { createInitialTranscript, nextScrollOffset } from "./tui-format.mjs";

export function handleTuiInput({
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
}) {
	if (key.ctrl && input === "c") {
		onExitStatus?.(130);
		closeTui();
		return;
	}
	if (key.ctrl && input === "l") {
		setTranscript(createInitialTranscript());
		setScrollOffset(0);
		return;
	}
	if (key.upArrow) {
		setScrollOffset((current) => nextScrollOffset(current, "up", transcript));
		return;
	}
	if (key.downArrow) {
		setScrollOffset((current) => nextScrollOffset(current, "down", transcript));
		return;
	}
	if (phase === "failed") {
		if (key.return || input === "q") {
			closeTui();
		}
		return;
	}
	if (phase !== "editing") {
		return;
	}
	if (prompt.length === 0 && input === "q") {
		closeTui();
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
}
