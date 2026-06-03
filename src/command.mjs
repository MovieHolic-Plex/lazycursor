import { spawnSync } from "node:child_process";
import { runEnforcedAcpUltrawork } from "./acp.mjs";
import {
	activateUltraworkState,
	buildStopFollowup,
	inspectLazycursorStop,
} from "./state.mjs";

const DEFAULT_CURSOR_AGENT_BIN = "cursor-agent";

const BASE_HEADLESS_ARGS = [
	"--print",
	"--trust",
	"--force",
	"--output-format",
	"text",
];

export function buildCursorCommand(argv, options = {}) {
	const bin = options.cursorAgentBin ?? DEFAULT_CURSOR_AGENT_BIN;
	const modelArgs = buildModelArgs(options.model);

	if (argv.length === 0) {
		return { bin, args: [] };
	}

	if (argv[0] === "--") {
		return { bin, args: argv.slice(1) };
	}

	const [command, ...rest] = argv;

	if (command === "install") {
		throw new Error("install is handled by parseLazycursorArgs");
	}

	if (command === "run") {
		const prompt = rest.join(" ");
		return {
			bin,
			args: [...modelArgs, ...BASE_HEADLESS_ARGS, buildRunPrompt(prompt)],
			statePrompt: prompt,
		};
	}

	if (command === "tui") {
		const prompt = rest.join(" ");
		return {
			bin,
			args: [...modelArgs, "acp"],
			runner: "acp",
			statePrompt: prompt,
		};
	}

	if (command === "ulw" || command === "ultrawork") {
		const prompt = rest.join(" ");
		return {
			bin,
			args: [...modelArgs, ...BASE_HEADLESS_ARGS, buildRunPrompt(prompt)],
			statePrompt: prompt,
		};
	}

	if (command === "ask") {
		return {
			bin,
			args: [
				...modelArgs,
				...BASE_HEADLESS_ARGS,
				"--mode",
				"ask",
				rest.join(" "),
			],
		};
	}

	if (command === "plan") {
		return {
			bin,
			args: [
				...modelArgs,
				...BASE_HEADLESS_ARGS,
				"--mode",
				"plan",
				rest.join(" "),
			],
		};
	}

	const prompt = argv.join(" ");
	return {
		bin,
		args: [...modelArgs, ...BASE_HEADLESS_ARGS, buildRunPrompt(prompt)],
		statePrompt: prompt,
	};
}

export function runCursorCommand(command, options = {}) {
	if (command.runner === "acp") {
		return runEnforcedAcpUltrawork(command, options);
	}

	if (typeof command.statePrompt !== "string") {
		return runCursorAgent(command.bin, command.args);
	}

	return runEnforcedUltrawork(command);
}

function runEnforcedUltrawork(command) {
	const workspace = process.cwd();
	activateUltraworkState(workspace, command.statePrompt);

	let args = command.args;
	for (;;) {
		const status = runCursorAgent(command.bin, args);
		if (status !== 0) {
			return status;
		}

		const stop = inspectLazycursorStop(workspace);
		if (stop.kind === "inactive" || stop.kind === "finished") {
			return 0;
		}

		const followup = buildStopFollowup(stop.pending);
		if (stop.kind === "limit_exceeded") {
			console.error(followup);
			console.error("LAZYCURSOR STOP WRAPPER: loop limit exceeded.");
			return 1;
		}

		args = [...args.slice(0, -1), buildRunPrompt(followup)];
	}
}

function runCursorAgent(bin, args) {
	const result = spawnSync(bin, args, {
		cwd: process.cwd(),
		env: process.env,
		stdio: "inherit",
	});

	if (typeof result.status === "number") {
		return result.status;
	}

	return 1;
}

function buildRunPrompt(prompt) {
	return `ultrawork ${prompt}`.trim();
}

function buildModelArgs(model) {
	return typeof model === "string" && model.length > 0
		? ["--model", model]
		: [];
}
