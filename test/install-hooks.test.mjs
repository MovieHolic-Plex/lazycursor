import assert from "node:assert/strict";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { applyInstallPlan, buildInstallPlan } from "../src/install.mjs";

describe("Cursor hook installation", () => {
	it("Given a workspace When applying the install plan Then lazycursor hooks and JSON state are installed", () => {
		const target = mkdtempSync(join(tmpdir(), "lazycursor-test-"));
		try {
			applyInstallPlan(buildInstallPlan(target));

			const hooksJson = JSON.parse(
				readFileSync(join(target, ".cursor", "hooks.json"), "utf8"),
			);
			const hookPath = join(target, ".cursor", "hooks", "lazycursor.mjs");
			const statePath = join(target, ".cursor", "lazycursor", "state.json");

			assert.equal(hooksJson.version, 1);
			assert.equal(
				hooksJson.hooks.beforeSubmitPrompt[0].command,
				".cursor/hooks/lazycursor.mjs beforeSubmitPrompt",
			);
			assert.equal(hooksJson.hooks.beforeSubmitPrompt[0].matcher, undefined);
			assert.equal(
				hooksJson.hooks.stop[0].command,
				".cursor/hooks/lazycursor.mjs stop",
			);
			assert.equal(statSync(hookPath).mode & 0o111, 0o111);
			assert.deepEqual(JSON.parse(readFileSync(statePath, "utf8")), {
				active: false,
				mode: "idle",
				phase: "idle",
				obligations: [],
				stopLoopCount: 0,
			});
		} finally {
			rmSync(target, { recursive: true, force: true });
		}
	});

	it("Given existing Cursor hooks When applying twice Then user hooks are preserved and lazycursor hooks are not duplicated", () => {
		const target = mkdtempSync(join(tmpdir(), "lazycursor-test-"));
		try {
			const cursorDir = join(target, ".cursor");
			mkdirSync(cursorDir, { recursive: true });
			writeFileSync(
				join(cursorDir, "hooks.json"),
				JSON.stringify(
					{
						version: 1,
						hooks: {
							stop: [{ command: ".cursor/hooks/custom-stop.sh" }],
						},
					},
					null,
					2,
				),
				"utf8",
			);

			applyInstallPlan(buildInstallPlan(target));
			applyInstallPlan(buildInstallPlan(target));

			const hooksJson = JSON.parse(
				readFileSync(join(cursorDir, "hooks.json"), "utf8"),
			);

			assert.deepEqual(
				hooksJson.hooks.stop.map((hook) => hook.command),
				[".cursor/hooks/custom-stop.sh", ".cursor/hooks/lazycursor.mjs stop"],
			);
		} finally {
			rmSync(target, { recursive: true, force: true });
		}
	});

	it("Given malformed Cursor hooks When applying the install plan Then no partial managed files are written", () => {
		const target = mkdtempSync(join(tmpdir(), "lazycursor-test-"));
		try {
			const cursorDir = join(target, ".cursor");
			const commandPath = join(cursorDir, "commands", "ulw.md");
			mkdirSync(cursorDir, { recursive: true });
			writeFileSync(
				join(cursorDir, "hooks.json"),
				JSON.stringify({ version: 1, hooks: { stop: { command: "bad" } } }),
				"utf8",
			);

			assert.throws(
				() => applyInstallPlan(buildInstallPlan(target)),
				/an event is not an array/,
			);
			assert.throws(() => readFileSync(commandPath, "utf8"), /ENOENT/);
		} finally {
			rmSync(target, { recursive: true, force: true });
		}
	});

	it("Given a directory at the state path When applying the install plan Then no partial managed files are written", () => {
		const target = mkdtempSync(join(tmpdir(), "lazycursor-test-"));
		try {
			const cursorDir = join(target, ".cursor");
			const commandPath = join(cursorDir, "commands", "ulw.md");
			mkdirSync(join(cursorDir, "lazycursor", "state.json"), {
				recursive: true,
			});

			assert.throws(
				() => applyInstallPlan(buildInstallPlan(target)),
				/non-file lazycursor state path/,
			);
			assert.throws(() => readFileSync(commandPath, "utf8"), /ENOENT/);
		} finally {
			rmSync(target, { recursive: true, force: true });
		}
	});
});
