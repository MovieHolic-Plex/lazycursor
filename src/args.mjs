import { buildCursorCommand } from "./command.mjs";

const DEFAULT_CURSOR_AGENT_BIN = "cursor-agent";

const USAGE = `Usage:
  lazycursor [--dry-run] <task...>
  lazycursor [--dry-run] run <task...>
  lazycursor [--dry-run] tui <task...>
  lazycursor [--dry-run] --model <model> tui <task...>
  lazycursor --list-models
  lazycursor [--dry-run] ask <question...>
  lazycursor [--dry-run] plan <task...>
  lazycursor [--dry-run] install [--target <workspace>]
  lazycursor [--dry-run] -- <raw cursor-agent args...>

Examples:
  lazycursor --dry-run "fix failing tests"
  lazycursor --model gpt-5.3-codex-high tui "fix failing tests"
  lazycursor tui "fix failing tests"
  lazycursor install --target /path/to/workspace
  lazycursor -- --version`;

const LCURSOR_PASSTHROUGH_COMMANDS = new Set([
	"install",
	"run",
	"tui",
	"ulw",
	"ultrawork",
	"ask",
	"plan",
]);

export function parseInteractiveLcursorArgs(argv) {
	let cursorAgentBin = DEFAULT_CURSOR_AGENT_BIN;
	let model;

	for (let index = 0; index < argv.length; index += 1) {
		const value = argv[index];

		if (value === "--cursor-agent-bin") {
			const parsed = readOptionValue(argv, index, "--cursor-agent-bin");
			if (parsed.kind === "error") {
				return parsed;
			}
			cursorAgentBin = parsed.value;
			index += 1;
			continue;
		}

		if (value === "--model") {
			const parsed = readOptionValue(argv, index, "--model");
			if (parsed.kind === "error") {
				return parsed;
			}
			model = parsed.value;
			index += 1;
			continue;
		}

		return { kind: "passthrough" };
	}

	if (model === undefined) {
		return { kind: "interactive", cursorAgentBin };
	}
	return { kind: "interactive", cursorAgentBin, model };
}

export function parseLazycursorArgs(argv) {
	const args = [];
	let dryRun = false;
	let cursorAgentBin = DEFAULT_CURSOR_AGENT_BIN;
	let model;
	let targetDir = process.cwd();

	for (let index = 0; index < argv.length; index += 1) {
		const value = argv[index];

		if (value === "--") {
			args.push(...argv.slice(index));
			break;
		}
		if (value === "--dry-run") {
			dryRun = true;
			continue;
		}
		if (value === "--help" || value === "-h") {
			return { kind: "help", usage: USAGE };
		}
		if (value === "--list-models") {
			return {
				kind: "run",
				dryRun,
				command: { bin: cursorAgentBin, args: ["--list-models"] },
			};
		}
		if (value === "--cursor-agent-bin") {
			const parsed = readOptionValue(argv, index, "--cursor-agent-bin");
			if (parsed.kind === "error") {
				return parsed;
			}
			cursorAgentBin = parsed.value;
			index += 1;
			continue;
		}
		if (value === "--model") {
			const parsed = readOptionValue(argv, index, "--model");
			if (parsed.kind === "error") {
				return parsed;
			}
			model = parsed.value;
			index += 1;
			continue;
		}
		if (value === "--target") {
			const parsed = readOptionValue(argv, index, "--target");
			if (parsed.kind === "error") {
				return parsed;
			}
			targetDir = parsed.value;
			index += 1;
			continue;
		}

		args.push(value);
	}

	if (args[0] === "install") {
		return { kind: "install", dryRun, targetDir };
	}

	return {
		kind: "run",
		dryRun,
		command: buildCursorCommand(args, { cursorAgentBin, model }),
	};
}

export function normalizeLcursorArgs(argv) {
	if (argv.length === 0) {
		return ["--help"];
	}

	for (let index = 0; index < argv.length; index += 1) {
		const value = argv[index];

		if (value === "--" || value === "--help" || value === "-h") {
			return argv;
		}
		if (value === "--dry-run") {
			continue;
		}
		if (value === "--list-models") {
			return argv;
		}
		if (
			value === "--cursor-agent-bin" ||
			value === "--target" ||
			value === "--model"
		) {
			index += 1;
			continue;
		}
		if (LCURSOR_PASSTHROUGH_COMMANDS.has(value)) {
			return argv;
		}
		return [...argv.slice(0, index), "tui", ...argv.slice(index)];
	}

	return ["--help"];
}

export function formatDryRunCommand(command) {
	return [command.bin, ...command.args].map(shellQuote).join(" ");
}

function readOptionValue(argv, index, optionName) {
	const nextValue = argv[index + 1];
	if (nextValue === undefined || nextValue.length === 0) {
		return {
			kind: "error",
			message: `${optionName} requires a value`,
		};
	}
	return { kind: "value", value: nextValue };
}

function shellQuote(value) {
	if (/^[A-Za-z0-9_/:=.,@%+-]+$/.test(value)) {
		return value;
	}

	return `'${value.replaceAll("'", "'\\''")}'`;
}
