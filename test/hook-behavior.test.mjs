import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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

import { applyInstallPlan, buildInstallPlan } from "../src/install.mjs";

function installFixture() {
	const target = mkdtempSync(join(tmpdir(), "lazycursor-test-"));
	applyInstallPlan(buildInstallPlan(target));
	const hookPath = join(target, ".cursor", "hooks", "lazycursor.mjs");
	const statePath = join(target, ".cursor", "lazycursor", "state.json");
	chmodSync(hookPath, 0o755);
	return { hookPath, statePath, target };
}

function runHook(fixture, event, prompt) {
	return spawnSync(process.execPath, [fixture.hookPath, event], {
		cwd: fixture.target,
		input: JSON.stringify(prompt === undefined ? {} : { prompt }),
		encoding: "utf8",
	});
}

function runHookRaw(fixture, event, input) {
	return spawnSync(process.execPath, [fixture.hookPath, event], {
		cwd: fixture.target,
		input,
		encoding: "utf8",
	});
}

function readState(fixture) {
	return JSON.parse(readFileSync(fixture.statePath, "utf8"));
}

describe("Cursor hook behavior", () => {
	it("Given a bare ulw prompt When the installed hook runs Then JSON state is activated and stop returns a follow-up", () => {
		const fixture = installFixture();
		try {
			const promptResult = runHook(
				fixture,
				"beforeSubmitPrompt",
				"ulw fix tests",
			);
			assert.equal(promptResult.status, 0);

			const state = readState(fixture);
			assert.equal(state.active, true);
			assert.equal(state.prompt, "fix tests");
			assert.equal(state.obligations[0].status, "pending");

			const stopResult = runHook(fixture, "stop");
			const stopOutput = JSON.parse(stopResult.stdout);

			assert.equal(stopResult.status, 0);
			assert.match(stopOutput.followup_message, /LAZYCURSOR STOP HOOK/);
			assert.match(stopOutput.followup_message, /plan/);
		} finally {
			rmSync(fixture.target, { recursive: true, force: true });
		}
	});

	it("Given a slash ulw prompt When the installed hook runs Then JSON state is activated with the task text", () => {
		const fixture = installFixture();
		try {
			const promptResult = runHook(
				fixture,
				"beforeSubmitPrompt",
				"/ulw ship hook enforcement",
			);
			const state = readState(fixture);

			assert.equal(promptResult.status, 0);
			assert.equal(state.active, true);
			assert.equal(state.prompt, "ship hook enforcement");
		} finally {
			rmSync(fixture.target, { recursive: true, force: true });
		}
	});

	it("Given active state When the user cancels ultrawork Then JSON state is deactivated", () => {
		const fixture = installFixture();
		try {
			runHook(fixture, "beforeSubmitPrompt", "ulw fix tests");
			const cancelResult = runHook(fixture, "beforeSubmitPrompt", "ulw cancel");
			const state = readState(fixture);

			assert.equal(cancelResult.status, 0);
			assert.equal(state.active, false);
			assert.equal(state.phase, "cancelled");
		} finally {
			rmSync(fixture.target, { recursive: true, force: true });
		}
	});

	it("Given active state When another ulw prompt arrives Then existing obligation progress is preserved", () => {
		const fixture = installFixture();
		try {
			writeFileSync(
				fixture.statePath,
				JSON.stringify(
					{
						active: true,
						mode: "ulw",
						phase: "implementation",
						prompt: "original task",
						obligations: [
							{ id: "plan", status: "done" },
							{ id: "implementation", status: "pending" },
						],
						stopLoopCount: 3,
					},
					null,
					2,
				),
				"utf8",
			);

			const promptResult = runHook(
				fixture,
				"beforeSubmitPrompt",
				"ulw replacement task",
			);
			const state = readState(fixture);

			assert.equal(promptResult.status, 0);
			assert.equal(state.prompt, "original task");
			assert.equal(state.stopLoopCount, 3);
			assert.equal(state.obligations[0].status, "done");
		} finally {
			rmSync(fixture.target, { recursive: true, force: true });
		}
	});

	it("Given invalid JSON state When the stop hook runs Then it fails closed with a repair follow-up", () => {
		const fixture = installFixture();
		try {
			writeFileSync(fixture.statePath, "{not json", "utf8");

			const stopResult = runHook(fixture, "stop");
			const stopOutput = JSON.parse(stopResult.stdout);

			assert.equal(stopResult.status, 0);
			assert.match(stopOutput.followup_message, /repair_state/);
			assert.match(stopOutput.followup_message, /state.json/);
		} finally {
			rmSync(fixture.target, { recursive: true, force: true });
		}
	});

	it("Given invalid hook stdin When beforeSubmitPrompt runs Then it denies the prompt and records protocol repair state", () => {
		const fixture = installFixture();
		try {
			const promptResult = runHookRaw(fixture, "beforeSubmitPrompt", "{bad");
			const promptOutput = JSON.parse(promptResult.stdout);
			const state = readState(fixture);

			assert.equal(promptResult.status, 0);
			assert.equal(promptOutput.permission, "deny");
			assert.match(promptOutput.message, /invalid hook JSON input/);
			assert.equal(state.active, true);
			assert.equal(state.phase, "protocol_error");
			assert.equal(state.obligations[0].id, "repair_hook_input");
		} finally {
			rmSync(fixture.target, { recursive: true, force: true });
		}
	});

	it("Given invalid hook stdin When stop runs Then it returns a repair follow-up", () => {
		const fixture = installFixture();
		try {
			const stopResult = runHookRaw(fixture, "stop", "{bad");
			const stopOutput = JSON.parse(stopResult.stdout);
			const state = readState(fixture);

			assert.equal(stopResult.status, 0);
			assert.match(stopOutput.followup_message, /repair_hook_input/);
			assert.equal(state.active, true);
			assert.equal(state.phase, "protocol_error");
		} finally {
			rmSync(fixture.target, { recursive: true, force: true });
		}
	});

	it("Given all obligations are done When the stop hook runs Then JSON state is finished without a follow-up", () => {
		const fixture = installFixture();
		try {
			writeFileSync(
				fixture.statePath,
				JSON.stringify(
					{
						active: true,
						mode: "ulw",
						phase: "verification",
						obligations: [
							{ id: "plan", status: "done" },
							{ id: "implementation", status: "done" },
							{ id: "verification", status: "done" },
							{ id: "report", status: "done" },
						],
						stopLoopCount: 0,
					},
					null,
					2,
				),
				"utf8",
			);

			const stopResult = runHook(fixture, "stop");
			const stopOutput = JSON.parse(stopResult.stdout);
			const state = readState(fixture);

			assert.equal(stopResult.status, 0);
			assert.deepEqual(stopOutput, {});
			assert.equal(state.active, false);
			assert.equal(state.phase, "finished");
		} finally {
			rmSync(fixture.target, { recursive: true, force: true });
		}
	});
});
