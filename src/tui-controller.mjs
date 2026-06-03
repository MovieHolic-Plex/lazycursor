import { buildCursorCommand, runCursorCommand } from "./command.mjs";

export async function runLineInputFallback(options) {
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

export function getComposerText({ phase, prompt }) {
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

export async function submitTask({
	command,
	conversation,
	conversationFactory,
	onConversation,
	onOutput,
	runCommand,
	task,
}) {
	if (runCommand !== undefined) {
		return runCommand(command, { onOutput });
	}
	if (conversation !== null) {
		return conversation.submit(task);
	}
	const nextConversation = await conversationFactory(command, { onOutput });
	onConversation(nextConversation);
	return nextConversation.submit(task);
}
