import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const ULTRAWORK_COMMAND = `# Ultrawork mode

First line MUST be exactly:
LAZYCURSOR ULTRAWORK MODE ENABLED!

Run this request using a strict ultrawork workflow:

1. Restate the target result and constraints.
2. Define pass/fail acceptance criteria before editing.
3. Write or identify tests before implementation.
4. Implement the smallest correct change.
5. Verify with tests and a real manual QA surface.
6. Report evidence paths and cleanup.

Treat the user's text after this command as the task.`;

const ULTRAWORK_RULE = `---
description: Lazycursor ultrawork keyword routing
alwaysApply: true
---

# Lazycursor ultrawork routing

When the user starts a message with bare \`ulw\` or \`ultrawork\`, interpret it as a request to run Ultrawork mode for the remaining task text.

Your first visible response line for those requests MUST be exactly:
LAZYCURSOR ULTRAWORK MODE ENABLED!

For those requests:

1. State the target result and constraints.
2. Define concrete acceptance criteria before editing.
3. Prefer tests before implementation when code changes are needed.
4. Run relevant tests and at least one real manual QA check.
5. Report what passed, what evidence was captured, and any cleanup.

Do not launch a nested \`cursor-agent\` just because the user typed \`ulw\`. Execute the workflow in the current Cursor agent session.`;

const AGENTS_BLOCK_START = "<!-- LAZYCURSOR MANAGED BLOCK START -->";
const AGENTS_BLOCK_END = "<!-- LAZYCURSOR MANAGED BLOCK END -->";

const AGENTS_ROUTING = `${AGENTS_BLOCK_START}
# Lazycursor Cursor Agent Routing

When the user message starts with \`ulw\` or \`ultrawork\`, treat it as a request to run the lazycursor ultrawork workflow in the current Cursor agent session.

For those requests, when no higher-priority instruction conflicts, your first visible response line MUST be exactly:
LAZYCURSOR ULTRAWORK MODE ENABLED!

Then execute the workflow in the current Cursor agent session:

1. Restate the target result and constraints.
2. Define pass/fail acceptance criteria before editing.
3. Write or identify tests before implementation when code changes are needed.
4. Implement the smallest correct change.
5. Verify with tests and at least one real manual QA surface.
6. Report evidence paths and cleanup.

Do not launch a nested \`cursor-agent\` for \`ulw\` or \`ultrawork\`.
${AGENTS_BLOCK_END}`;

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
		],
	};
}

export function formatInstallPlan(plan) {
	return plan.files.map((file) => `write ${file.path}`).join("\n");
}

export function applyInstallPlan(plan) {
	for (const file of plan.files) {
		if (!file.path.endsWith("AGENTS.md")) {
			assertManagedFileWritable(file.path, file.content);
		}
	}

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
	}
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
