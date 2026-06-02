import {
	chmodSync,
	existsSync,
	mkdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
	AGENTS_BLOCK_END,
	AGENTS_BLOCK_START,
	AGENTS_ROUTING,
	INITIAL_STATE,
	LAZYCURSOR_HOOK_SCRIPT,
	ULTRAWORK_COMMAND,
	ULTRAWORK_RULE,
} from "./templates.mjs";

const HOOK_COMMANDS = {
	beforeSubmitPrompt: ".cursor/hooks/lazycursor.mjs beforeSubmitPrompt",
	stop: ".cursor/hooks/lazycursor.mjs stop",
};

export function buildInstallPlan(targetDir) {
	const root = resolve(targetDir);

	return {
		targetDir: root,
		files: [
			{
				path: join(root, ".cursor", "commands", "ulw.md"),
				content: ULTRAWORK_COMMAND,
			},
			{
				path: join(root, ".cursor", "commands", "ultrawork.md"),
				content: ULTRAWORK_COMMAND,
			},
			{
				path: join(root, ".cursor", "rules", "lazycursor-ultrawork.mdc"),
				content: ULTRAWORK_RULE,
			},
			{
				path: join(root, "AGENTS.md"),
				content: AGENTS_ROUTING,
			},
			{
				path: join(root, ".cursor", "hooks", "lazycursor.mjs"),
				content: LAZYCURSOR_HOOK_SCRIPT,
				executable: true,
			},
		],
		hooksPath: join(root, ".cursor", "hooks.json"),
		statePath: join(root, ".cursor", "lazycursor", "state.json"),
	};
}

export function formatInstallPlan(plan) {
	return [
		...plan.files.map((file) => `write ${file.path}`),
		`merge ${plan.hooksPath}`,
		`init ${plan.statePath}`,
	].join("\n");
}

export function applyInstallPlan(plan) {
	for (const file of plan.files) {
		if (!file.path.endsWith("AGENTS.md")) {
			assertManagedFileWritable(file.path, file.content);
		}
	}
	assertHooksConfigWritable(plan.hooksPath);
	assertStateFileWritable(plan.statePath);

	for (const file of plan.files) {
		mkdirSync(dirname(file.path), { recursive: true });
		if (file.path.endsWith("AGENTS.md")) {
			writeFileSync(
				file.path,
				mergeAgentsContent(file.path, file.content),
				"utf8",
			);
			continue;
		}
		writeManagedFile(file.path, file.content);
		if (file.executable === true) {
			chmodSync(file.path, 0o755);
		}
	}
	mergeHooksConfig(plan.hooksPath);
	initStateFile(plan.statePath);
}

function writeManagedFile(path, content) {
	const nextContent = `${content}\n`;
	assertManagedFileWritable(path, content);

	writeFileSync(path, nextContent, "utf8");
}

function assertManagedFileWritable(path, content) {
	const nextContent = `${content}\n`;
	if (existsSync(path)) {
		const current = readFileSync(path, "utf8");
		if (current !== nextContent) {
			throw new Error(`Refusing to overwrite existing unmanaged file: ${path}`);
		}
	}
}

function mergeAgentsContent(path, managedBlock) {
	const nextBlock = `${managedBlock}\n`;

	if (!existsSync(path)) {
		return nextBlock;
	}

	const current = readFileSync(path, "utf8");
	let cursor = 0;
	let merged = "";
	let inserted = false;

	while (cursor < current.length) {
		const start = current.indexOf(AGENTS_BLOCK_START, cursor);
		if (start === -1) {
			break;
		}
		const end = current.indexOf(AGENTS_BLOCK_END, start);
		if (end === -1) {
			break;
		}
		const afterEnd = end + AGENTS_BLOCK_END.length;
		merged += current.slice(cursor, start);
		if (!inserted) {
			merged += nextBlock;
			inserted = true;
		}
		cursor = current[afterEnd] === "\n" ? afterEnd + 1 : afterEnd;
	}

	if (inserted) {
		merged += current.slice(cursor);
		return merged.replace(/\n{3,}/g, "\n\n");
	}

	const separator = current.endsWith("\n") ? "\n" : "\n\n";
	return `${current}${separator}${nextBlock}`;
}

function assertHooksConfigWritable(path) {
	buildMergedHooksConfig(path);
}

function mergeHooksConfig(path) {
	const nextConfig = buildMergedHooksConfig(path);

	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, `${JSON.stringify(nextConfig, null, 2)}\n`, "utf8");
}

function buildMergedHooksConfig(path) {
	const config = existsSync(path)
		? readHooksConfig(path)
		: { version: 1, hooks: {} };
	const hooks = parseHooksMap(config.hooks);

	hooks.beforeSubmitPrompt = appendHook(hooks.beforeSubmitPrompt, {
		command: HOOK_COMMANDS.beforeSubmitPrompt,
		timeout: 10,
		failClosed: false,
	});
	hooks.stop = appendHook(hooks.stop, {
		command: HOOK_COMMANDS.stop,
		timeout: 10,
		loop_limit: 8,
	});

	return { ...config, version: 1, hooks };
}

function readHooksConfig(path) {
	const raw = readFileSync(path, "utf8");
	try {
		return JSON.parse(raw);
	} catch (error) {
		if (error instanceof SyntaxError) {
			throw new Error(`Refusing to merge invalid Cursor hooks JSON: ${path}`);
		}
		throw error;
	}
}

function parseHooksMap(value) {
	if (value === undefined) {
		return {};
	}
	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(
			"Refusing to merge Cursor hooks because hooks is not an object",
		);
	}
	return { ...value };
}

function appendHook(existing, hook) {
	const hooks = existing === undefined ? [] : parseHookArray(existing);
	if (hooks.some((item) => item.command === hook.command)) {
		return hooks;
	}
	return [...hooks, hook];
}

function parseHookArray(value) {
	if (!Array.isArray(value)) {
		throw new Error(
			"Refusing to merge Cursor hooks because an event is not an array",
		);
	}
	return value;
}

function initStateFile(path) {
	if (existsSync(path)) {
		return;
	}
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, `${JSON.stringify(INITIAL_STATE, null, 2)}\n`, "utf8");
}

function assertStateFileWritable(path) {
	if (!existsSync(path)) {
		return;
	}

	if (!statSync(path).isFile()) {
		throw new Error(`Refusing to use non-file lazycursor state path: ${path}`);
	}
}
