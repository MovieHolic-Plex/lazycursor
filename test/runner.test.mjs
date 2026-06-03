import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { runCursorCommand } from "../src/command.mjs";

function withWorkspace(run) {
	const target = mkdtempSync(join(tmpdir(), "lazycursor-test-"));
	const previousCwd = process.cwd();
	try {
		process.chdir(target);
		run(target);
	} finally {
		process.chdir(previousCwd);
		rmSync(target, { recursive: true, force: true });
	}
}

function writeFakeAgent(target, lines) {
	const fakeAgent = join(target, "fake-agent.mjs");
	writeFileSync(fakeAgent, lines.join("\n"), "utf8");
	return fakeAgent;
}

function readJson(path) {
	return JSON.parse(readFileSync(path, "utf8"));
}

describe("runCursorCommand", () => {
	it("Given a stateful ultrawork command When the agent marks obligations done Then the wrapper activates and finishes JSON state", () => {
		withWorkspace((target) => {
			const fakeAgent = writeFakeAgent(target, [
				"import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';",
				"import { join } from 'node:path';",
				"appendFileSync('runs.log', JSON.stringify({ prompt: process.argv.at(-1) }) + '\\n');",
				"const statePath = join(process.cwd(), '.cursor', 'lazycursor', 'state.json');",
				"const state = JSON.parse(readFileSync(statePath, 'utf8'));",
				"state.obligations = state.obligations.map((item) => ({ ...item, status: 'done' }));",
				"writeFileSync(statePath, JSON.stringify(state, null, 2) + '\\n');",
			]);

			const status = runCursorCommand({
				bin: process.execPath,
				args: [fakeAgent, "--print", "ultrawork fix tests"],
				statePrompt: "fix tests",
			});
			const state = readJson(
				join(target, ".cursor", "lazycursor", "state.json"),
			);
			const events = readFileSync(
				join(target, ".cursor", "lazycursor", "events.jsonl"),
				"utf8",
			);

			assert.equal(status, 0);
			assert.equal(state.active, false);
			assert.equal(state.phase, "finished");
			assert.match(events, /"event":"activate"/);
			assert.match(events, /"event":"finish"/);
		});
	});

	it("Given pending obligations after the first run When enforcing ultrawork Then the wrapper sends a follow-up run", () => {
		withWorkspace((target) => {
			const fakeAgent = writeFakeAgent(target, [
				"import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';",
				"import { join } from 'node:path';",
				"const runPath = join(process.cwd(), 'runs.log');",
				"const previous = existsSync(runPath) ? readFileSync(runPath, 'utf8').trim().split('\\n').filter(Boolean).length : 0;",
				"appendFileSync(runPath, JSON.stringify({ prompt: process.argv.at(-1) }) + '\\n');",
				"if (previous > 0) {",
				"  const statePath = join(process.cwd(), '.cursor', 'lazycursor', 'state.json');",
				"  const state = JSON.parse(readFileSync(statePath, 'utf8'));",
				"  state.obligations = state.obligations.map((item) => ({ ...item, status: 'done' }));",
				"  writeFileSync(statePath, JSON.stringify(state, null, 2) + '\\n');",
				"}",
			]);

			const status = runCursorCommand({
				bin: process.execPath,
				args: [fakeAgent, "--print", "ultrawork fix tests"],
				statePrompt: "fix tests",
			});
			const runs = readFileSync(join(target, "runs.log"), "utf8")
				.trim()
				.split("\n")
				.map((line) => JSON.parse(line));
			const state = readJson(
				join(target, ".cursor", "lazycursor", "state.json"),
			);

			assert.equal(status, 0);
			assert.equal(runs.length, 2);
			assert.match(runs[1].prompt, /LAZYCURSOR STOP WRAPPER/);
			assert.equal(state.stopLoopCount, 1);
			assert.equal(state.active, false);
		});
	});
});
