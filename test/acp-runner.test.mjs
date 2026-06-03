import assert from "node:assert/strict";
import {
	chmodSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { runCursorCommand } from "../src/command.mjs";

async function withWorkspace(run) {
	const target = mkdtempSync(join(tmpdir(), "lazycursor-acp-test-"));
	const previousCwd = process.cwd();
	try {
		process.chdir(target);
		return await run(target);
	} finally {
		process.chdir(previousCwd);
		rmSync(target, { recursive: true, force: true });
	}
}

function writeFakeAcpAgent(target) {
	const fakeAgent = join(target, "fake-acp-agent.mjs");
	writeFileSync(
		fakeAgent,
		[
			"#!/usr/bin/env node",
			"import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';",
			"import { createInterface } from 'node:readline';",
			"import { join } from 'node:path';",
			"const rl = createInterface({ input: process.stdin });",
			"function send(value) { process.stdout.write(JSON.stringify(value) + '\\n'); }",
			"function markDone() {",
			"  const statePath = join(process.cwd(), '.cursor', 'lazycursor', 'state.json');",
			"  const state = JSON.parse(readFileSync(statePath, 'utf8'));",
			"  state.obligations = state.obligations.map((item) => ({ ...item, status: 'done' }));",
			"  writeFileSync(statePath, JSON.stringify(state, null, 2) + '\\n');",
			"}",
			"rl.on('line', (line) => {",
			"  const message = JSON.parse(line);",
			"  appendFileSync('acp-rpc.jsonl', JSON.stringify(message) + '\\n');",
			"  if (message.method === 'initialize') send({ jsonrpc: '2.0', id: message.id, result: {} });",
			"  if (message.method === 'authenticate') send({ jsonrpc: '2.0', id: message.id, result: {} });",
			"  if (message.method === 'session/new') send({ jsonrpc: '2.0', id: message.id, result: { sessionId: 's1' } });",
			"  if (message.method === 'session/prompt') {",
			"    const text = message.params.prompt[0].text;",
			"    appendFileSync('prompts.log', text + '\\n---\\n');",
			"    if (text.includes('LAZYCURSOR STOP ACP')) markDone();",
			"    send({ jsonrpc: '2.0', method: 'session/update', params: { update: { sessionUpdate: 'agent_message_chunk', content: { text: '' } } } });",
			"    send({ jsonrpc: '2.0', id: message.id, result: { stopReason: 'end_turn' } });",
			"  }",
			"});",
		].join("\n"),
		"utf8",
	);
	chmodSync(fakeAgent, 0o755);
	return fakeAgent;
}

describe("ACP runner", () => {
	it("Given pending obligations after the first ACP prompt When enforcing ultrawork Then it sends a follow-up prompt in the same ACP session", async () => {
		await withWorkspace(async (target) => {
			const fakeAgent = writeFakeAcpAgent(target);

			const status = await runCursorCommand({
				bin: fakeAgent,
				args: ["acp"],
				runner: "acp",
				statePrompt: "fix tests",
			});
			const prompts = readFileSync(join(target, "prompts.log"), "utf8");
			const state = JSON.parse(
				readFileSync(
					join(target, ".cursor", "lazycursor", "state.json"),
					"utf8",
				),
			);
			const events = readFileSync(
				join(target, ".cursor", "lazycursor", "events.jsonl"),
				"utf8",
			);

			assert.equal(status, 0);
			assert.match(prompts, /ultrawork fix tests/);
			assert.match(prompts, /LAZYCURSOR STOP ACP/);
			assert.equal(state.active, false);
			assert.equal(state.phase, "finished");
			assert.equal(state.stopLoopCount, 1);
			assert.match(events, /"source":"acp"/);
		});
	});
});
