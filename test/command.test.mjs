import assert from "node:assert/strict";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
	buildCursorCommand,
	formatDryRunCommand,
	normalizeLcursorArgs,
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
		assert.equal(command.args.at(-1), "ultrawork fix the tests");
		assert.equal(command.statePrompt, "fix the tests");
	});

	it("Given an explicit ulw command When building the command Then the wrapper strips the trigger before activating state", () => {
		const command = buildCursorCommand(["ulw", "fix", "the", "tests"]);

		assert.equal(command.args.at(-1), "ultrawork fix the tests");
		assert.equal(command.statePrompt, "fix the tests");
	});

	it("Given ask and plan commands When building the command Then it selects Cursor read-only modes", () => {
		const ask = buildCursorCommand(["ask", "explain", "auth"]);
		const plan = buildCursorCommand(["plan", "migrate", "db"]);

		assert.deepEqual(ask.args.slice(5), ["--mode", "ask", "explain auth"]);
		assert.deepEqual(plan.args.slice(5), ["--mode", "plan", "migrate db"]);
	});

	it("Given a tui command When building the command Then it selects ACP mode with state enforcement", () => {
		const command = buildCursorCommand(["tui", "fix", "the", "tests"]);

		assert.equal(command.bin, "cursor-agent");
		assert.deepEqual(command.args, ["acp"]);
		assert.equal(command.runner, "acp");
		assert.equal(command.statePrompt, "fix the tests");
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

describe("normalizeLcursorArgs", () => {
	it("Given a plain lcursor task When normalizing Then it defaults to the ACP tui runner", () => {
		assert.deepEqual(normalizeLcursorArgs(["fix", "the", "tests"]), [
			"tui",
			"fix",
			"the",
			"tests",
		]);
	});

	it("Given lcursor options before a task When normalizing Then it preserves options and inserts tui before the task", () => {
		assert.deepEqual(
			normalizeLcursorArgs([
				"--dry-run",
				"--cursor-agent-bin",
				"/tmp/fake",
				"fix",
				"tests",
			]),
			["--dry-run", "--cursor-agent-bin", "/tmp/fake", "tui", "fix", "tests"],
		);
	});

	it("Given an explicit lazycursor subcommand When normalizing Then it leaves the command unchanged", () => {
		assert.deepEqual(normalizeLcursorArgs(["install"]), ["install"]);
		assert.deepEqual(normalizeLcursorArgs(["ulw", "fix"]), ["ulw", "fix"]);
		assert.deepEqual(normalizeLcursorArgs(["tui", "fix"]), ["tui", "fix"]);
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
				"/repo/.cursor/hooks/lazycursor.mjs",
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
		assert.match(plan.files[4].content, /LAZYCURSOR STOP HOOK/);
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

	it("Given an existing custom Cursor command When applying the install plan Then unmanaged files are not overwritten", () => {
		const target = mkdtempSync(join(tmpdir(), "lazycursor-test-"));
		try {
			const commandDir = join(target, ".cursor", "commands");
			const commandPath = join(commandDir, "ulw.md");
			mkdirSync(commandDir, { recursive: true });
			writeFileSync(commandPath, "# Custom team command\n", "utf8");

			assert.throws(
				() => applyInstallPlan(buildInstallPlan(target)),
				/Refusing to overwrite existing unmanaged file/,
			);
			assert.equal(
				readFileSync(commandPath, "utf8"),
				"# Custom team command\n",
			);
		} finally {
			rmSync(target, { recursive: true, force: true });
		}
	});

	it("Given duplicate lazycursor AGENTS blocks When applying the install plan Then stale duplicates are collapsed into one block", () => {
		const target = mkdtempSync(join(tmpdir(), "lazycursor-test-"));
		try {
			writeFileSync(
				join(target, "AGENTS.md"),
				[
					"# Existing instructions",
					"",
					"<!-- LAZYCURSOR MANAGED BLOCK START -->",
					"old block",
					"<!-- LAZYCURSOR MANAGED BLOCK END -->",
					"",
					"Keep this line.",
					"",
					"<!-- LAZYCURSOR MANAGED BLOCK START -->",
					"stale duplicate",
					"<!-- LAZYCURSOR MANAGED BLOCK END -->",
					"",
				].join("\n"),
				"utf8",
			);

			applyInstallPlan(buildInstallPlan(target));

			const agents = readFileSync(join(target, "AGENTS.md"), "utf8");

			assert.match(agents, /Keep this line\./);
			assert.equal(agents.match(/LAZYCURSOR MANAGED BLOCK START/g)?.length, 1);
			assert.equal(agents.match(/LAZYCURSOR MANAGED BLOCK END/g)?.length, 1);
			assert.doesNotMatch(agents, /stale duplicate/);
		} finally {
			rmSync(target, { recursive: true, force: true });
		}
	});

	it("Given a later unmanaged Cursor file conflict When applying the install plan Then no earlier Cursor files are written", () => {
		const target = mkdtempSync(join(tmpdir(), "lazycursor-test-"));
		try {
			const commandDir = join(target, ".cursor", "commands");
			const ulwPath = join(commandDir, "ulw.md");
			const ultraworkPath = join(commandDir, "ultrawork.md");
			mkdirSync(commandDir, { recursive: true });
			writeFileSync(ultraworkPath, "# Custom ultrawork command\n", "utf8");

			assert.throws(
				() => applyInstallPlan(buildInstallPlan(target)),
				/Refusing to overwrite existing unmanaged file/,
			);
			assert.equal(
				readFileSync(ultraworkPath, "utf8"),
				"# Custom ultrawork command\n",
			);
			assert.equal(existsSync(ulwPath), false);
		} finally {
			rmSync(target, { recursive: true, force: true });
		}
	});
});

describe("package metadata", () => {
	it("Given npm execution When resolving bins Then the package exposes full and short wrappers", () => {
		assert.deepEqual(packageJson.bin, {
			lcursor: "bin/lcursor.js",
			lazycursor: "bin/lazycursor-ai.js",
			"lazycursor-ai": "bin/lazycursor-ai.js",
		});
	});
});
