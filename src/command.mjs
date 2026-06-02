import { spawnSync } from "node:child_process";

const DEFAULT_CURSOR_AGENT_BIN = "cursor-agent";

const BASE_HEADLESS_ARGS = [
	"--print",
	"--trust",
	"--force",
	"--output-format",
	"text",
];

const USAGE = `Usage:
  lazycursor [--dry-run] <task...>
  lazycursor [--dry-run] run <task...>
  lazycursor [--dry-run] ask <question...>
  lazycursor [--dry-run] plan <task...>
  lazycursor [--dry-run] install [--target <workspace>]
  lazycursor [--dry-run] -- <raw cursor-agent args...>

Examples:
  lazycursor --dry-run "fix failing tests"
  lazycursor install --target /path/to/workspace
  lazycursor -- --version`;

export function buildCursorCommand(argv, options = {}) {
	const bin = options.cursorAgentBin ?? DEFAULT_CURSOR_AGENT_BIN;

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
		return {
			bin,
			args: [...BASE_HEADLESS_ARGS, buildRunPrompt(rest)],
		};
	}

	if (command === "ask") {
		return {
			bin,
			args: [...BASE_HEADLESS_ARGS, "--mode", "ask", rest.join(" ")],
		};
	}

	if (command === "plan") {
		return {
			bin,
			args: [...BASE_HEADLESS_ARGS, "--mode", "plan", rest.join(" ")],
		};
	}

	return {
		bin,
		args: [...BASE_HEADLESS_ARGS, buildRunPrompt(argv)],
	};
}

export function parseLazycursorArgs(argv) {
	const args = [];
	let dryRun = false;
	let cursorAgentBin = DEFAULT_CURSOR_AGENT_BIN;
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

		if (value === "--cursor-agent-bin") {
			const nextValue = argv[index + 1];
			if (nextValue === undefined || nextValue.length === 0) {
				return {
					kind: "error",
					message: "--cursor-agent-bin requires a value",
				};
			}
			cursorAgentBin = nextValue;
			index += 1;
			continue;
		}

		if (value === "--target") {
			const nextValue = argv[index + 1];
			if (nextValue === undefined || nextValue.length === 0) {
				return {
					kind: "error",
					message: "--target requires a value",
				};
			}
			targetDir = nextValue;
			index += 1;
			continue;
		}

		args.push(value);
	}

	if (args[0] === "install") {
		return {
			kind: "install",
			dryRun,
			targetDir,
		};
	}

	return {
		kind: "run",
		dryRun,
		command: buildCursorCommand(args, { cursorAgentBin }),
	};
}

export function formatDryRunCommand(command) {
	return [command.bin, ...command.args].map(shellQuote).join(" ");
}

export function runCursorCommand(command) {
	const result = spawnSync(command.bin, command.args, {
		cwd: process.cwd(),
		env: process.env,
		stdio: "inherit",
	});

	if (typeof result.status === "number") {
		return result.status;
	}

	return 1;
}

function buildRunPrompt(parts) {
	return `ultrawork: ${parts.join(" ")}`.trim();
}

function shellQuote(value) {
	if (/^[A-Za-z0-9_/:=.,@%+-]+$/.test(value)) {
		return value;
	}

	return `'${value.replaceAll("'", "'\\''")}'`;
}
