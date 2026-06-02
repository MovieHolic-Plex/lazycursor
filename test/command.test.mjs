import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
	buildCursorCommand,
	formatDryRunCommand,
	parseLazycursorArgs,
} from "../src/command.mjs";
import { applyInstallPlan, buildInstallPlan } from "../src/install.mjs";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json");

describe("buildCursorCommand", () => {
	it("Given install args When parsing the command Then it plans Cursor TUI command installation instead of launching a nested agent", () => {
		const parsed = parseLazycursorArgs(["install", "--target", "/repo"]);

		assert.equal(parsed.kind, "install");
		assert.equal(parsed.targetDir, "/repo");
		assert.equal(parsed.dryRun, false);
	});

	it("Given install reaches the headless command builder When building the command Then it is rejected as installer-only", () => {
		assert.throws(
			() => buildCursorCommand(["install"]),
			/install is handled by parseLazycursorArgs/,
		);
	});

	it("Given a plain task When building the command Then it runs Cursor Agent headlessly with an ultrawork prompt", () => {
		const command = buildCursorCommand(["fix", "the", "tests"]);

		assert.equal(command.bin, "cursor-agent");
		assert.deepEqual(command.args.slice(0, 5), [
			"--print",
			"--trust",
			"--force",
			"--output-format",
			"text",
		]);
		assert.equal(command.args.at(-1), "ultrawork: fix the tests");
	});

	it("Given ask and plan commands When building the command Then it selects Cursor read-only modes", () => {
		const ask = buildCursorCommand(["ask", "explain", "auth"]);
		const plan = buildCursorCommand(["plan", "migrate", "db"]);

		assert.deepEqual(ask.args.slice(5), ["--mode", "ask", "explain auth"]);
		assert.deepEqual(plan.args.slice(5), ["--mode", "plan", "migrate db"]);
	});

	it("Given raw cursor separator When building the command Then raw Cursor Agent args pass through unchanged", () => {
		const command = buildCursorCommand(["--", "--version"]);

		assert.deepEqual(command, {
			bin: "cursor-agent",
			args: ["--version"],
		});
	});
});

describe("formatDryRunCommand", () => {
	it("Given command args with spaces When formatting Then shell quoting is stable", () => {
		assert.equal(
			formatDryRunCommand({
				bin: "cursor-agent",
				args: ["--print", "ultrawork: fix tests"],
			}),
			"cursor-agent --print 'ultrawork: fix tests'",
		);
	});
});

describe("buildInstallPlan", () => {
	it("Given a workspace When building the install plan Then Cursor commands, a rule, and AGENTS routing are created", () => {
		const plan = buildInstallPlan("/repo");

		assert.deepEqual(
			plan.files.map((file) => file.path),
			[
				"/repo/.cursor/commands/ulw.md",
				"/repo/.cursor/commands/ultrawork.md",
				"/repo/.cursor/rules/lazycursor-ultrawork.mdc",
				"/repo/AGENTS.md",
			],
		);
		assert.match(plan.files[0].content, /Ultrawork mode/);
		assert.match(plan.files[0].content, /First line MUST be exactly/);
		assert.match(plan.files[0].content, /LAZYCURSOR ULTRAWORK MODE ENABLED!/);
		assert.match(plan.files[1].content, /Ultrawork mode/);
		assert.match(plan.files[2].content, /alwaysApply: true/);
		assert.match(plan.files[2].content, /bare `ulw` or `ultrawork`/);
		assert.match(plan.files[3].content, /LAZYCURSOR ULTRAWORK MODE ENABLED!/);
		assert.match(
			plan.files[3].content,
			/When the user message starts with `ulw`/,
		);
		assert.match(
			plan.files[3].content,
			/when no higher-priority instruction conflicts/,
		);
	});

	it("Given an existing AGENTS file When applying the install plan Then user instructions are preserved and lazycursor block is updated once", () => {
		const target = mkdtempSync(join(tmpdir(), "lazycursor-test-"));
		try {
			writeFileSync(
				join(target, "AGENTS.md"),
				"# Existing instructions\n\nKeep this line.\n",
				"utf8",
			);

			applyInstallPlan(buildInstallPlan(target));
			applyInstallPlan(buildInstallPlan(target));

			const agents = readFileSync(join(target, "AGENTS.md"), "utf8");

			assert.match(agents, /Keep this line\./);
			assert.equal(agents.match(/LAZYCURSOR MANAGED BLOCK START/g)?.length, 1);
			assert.equal(agents.match(/LAZYCURSOR MANAGED BLOCK END/g)?.length, 1);
		} finally {
			rmSync(target, { recursive: true, force: true });
		}
	});
});

describe("package metadata", () => {
	it("Given npm execution When resolving bins Then lazycursor and lazycursor-ai point at the same wrapper", () => {
		assert.deepEqual(packageJson.bin, {
			lazycursor: "bin/lazycursor-ai.js",
			"lazycursor-ai": "bin/lazycursor-ai.js",
		});
	});
});
