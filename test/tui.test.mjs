import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { render } from "ink-testing-library";
import React from "react";

import { LazycursorTuiApp } from "../src/tui.mjs";

async function waitFor(check, label) {
	for (let attempt = 0; attempt < 50; attempt += 1) {
		if (check()) {
			return;
		}
		await delay(10);
	}
	throw new Error(`Timed out waiting for ${label}`);
}

describe("LazycursorTuiApp", { concurrency: false }, () => {
	it("Given an empty TUI When it opens Then it renders an ACP workspace HUD and composer", async () => {
		const app = render(React.createElement(LazycursorTuiApp));

		assert.match(app.lastFrame() ?? "", /ACP ultrawork/);
		assert.match(app.lastFrame() ?? "", /Transcript/);
		assert.match(app.lastFrame() ?? "", /Todo/);
		assert.match(app.lastFrame() ?? "", /Now: Waiting for task input/);
		assert.match(app.lastFrame() ?? "", /Composer/);
		assert.match(app.lastFrame() ?? "", /Enter submit/);

		app.unmount();
	});

	it("Given a narrow TUI When metadata renders Then status labels and values remain separated", async () => {
		const app = render(
			React.createElement(LazycursorTuiApp, {
				cursorAgentBin: "/tmp/fake-acp-agent.mjs",
				model: "composer-2.5-fast",
			}),
		);

		const frame = app.lastFrame() ?? "";
		assert.match(frame, /runner: \/tmp\/fake-acp-agent\.mjs/);
		assert.match(frame, /mode: json-state stop-loop/);
		assert.match(frame, /model: composer-2\.5-fast/);
		assert.match(frame, /task: -/);
		assert.doesNotMatch(frame, /runner\/tmp/);
		assert.doesNotMatch(frame, /modejson-state/);
		assert.doesNotMatch(frame, /stop-looptask/);

		app.unmount();
	});

	it("Given typed input When the user presses enter Then it runs the ACP command and renders streamed output", async () => {
		const calls = [];
		let exitStatus;
		const runCommand = async (command, options) => {
			calls.push(command);
			options.onOutput("agent chunk\n");
			return 0;
		};

		const app = render(
			React.createElement(LazycursorTuiApp, {
				autoExit: false,
				cursorAgentBin: "/tmp/fake-agent",
				model: "composer-2.5-fast",
				onExitStatus: (status) => {
					exitStatus = status;
				},
				runCommand,
			}),
		);

		app.stdin.write("fix tests\r");

		await waitFor(
			() => calls.length === 1 && app.lastFrame()?.includes("Turn complete"),
			"successful TUI completion",
		);

		assert.deepEqual(calls[0], {
			bin: "/tmp/fake-agent",
			args: ["--model", "composer-2.5-fast", "acp"],
			runner: "acp",
			statePrompt: "fix tests",
		});
		assert.equal(exitStatus, 0);
		assert.match(app.lastFrame() ?? "", /agent chunk/);
		assert.match(app.lastFrame() ?? "", /USER/);
		assert.match(app.lastFrame() ?? "", /AGENT/);
		assert.match(app.lastFrame() ?? "", /Turn complete/);

		app.unmount();
	});

	it("Given the real TUI runner When a turn completes Then a follow-up is sent through the same ACP conversation", async () => {
		const commands = [];
		const prompts = [];
		let closed = false;
		const conversationFactory = async (command, options) => {
			commands.push(command);
			return {
				close() {
					closed = true;
				},
				async submit(value) {
					prompts.push(value);
					options.onOutput(`answer for ${value}\n`);
					return 0;
				},
			};
		};
		const app = render(
			React.createElement(LazycursorTuiApp, {
				autoExit: false,
				conversationFactory,
			}),
		);

		app.stdin.write("first task\r");

		await waitFor(
			() => app.lastFrame()?.includes("Type a follow-up"),
			"first turn completion",
		);

		app.stdin.write("second task\r");

		await waitFor(
			() =>
				prompts.length === 2 && app.lastFrame()?.includes("answer for second"),
			"second turn completion",
		);

		assert.match(app.lastFrame() ?? "", /second task/);

		app.stdin.write("q");

		await waitFor(() => closed, "conversation close");

		assert.equal(commands.length, 1);
		assert.deepEqual(prompts, ["first task", "second task"]);

		app.unmount();
	});

	it("Given auto-exit mode When a conversation turn completes Then the ACP conversation is closed", async () => {
		let closed = false;
		const conversationFactory = async () => ({
			close() {
				closed = true;
			},
			async submit() {
				return 0;
			},
		});
		const app = render(
			React.createElement(LazycursorTuiApp, {
				autoExit: true,
				conversationFactory,
			}),
		);

		app.stdin.write("auto close\r");

		await waitFor(() => closed, "auto-exit conversation close");

		app.unmount();
	});

	it("Given character-sized ACP chunks When streamed Then transcript coalesces them into readable lines", async () => {
		const runCommand = async (_command, options) => {
			options.onOutput("뒤");
			options.onOutput(",");
			options.onOutput(" 개선");
			options.onOutput("합니다\n다");
			options.onOutput("음 줄");
			return 0;
		};
		const app = render(
			React.createElement(LazycursorTuiApp, {
				autoExit: false,
				runCommand,
			}),
		);

		app.stdin.write("stream korean\r");

		await waitFor(
			() => app.lastFrame()?.includes("뒤, 개선합니다"),
			"coalesced first streamed line",
		);

		const frame = app.lastFrame() ?? "";
		assert.match(frame, /뒤, 개선합니다/);
		assert.match(frame, /다음 줄/);
		assert.equal(frame.match(/AGENT/g)?.length, 2);

		app.unmount();
	});

	it("Given a failing ACP command When it completes Then it renders the failed status", async () => {
		const runCommand = async () => 7;
		const app = render(
			React.createElement(LazycursorTuiApp, {
				autoExit: false,
				runCommand,
			}),
		);

		app.stdin.write("break build\r");

		await waitFor(
			() => app.lastFrame()?.includes("Failed with exit status 7"),
			"failed TUI completion",
		);

		assert.match(app.lastFrame() ?? "", /Failed with exit status 7/);
		assert.match(app.lastFrame() ?? "", /FAILED/);
		app.unmount();
	});

	it("Given transcript output When the user clears the panel Then the initial prompt returns", async () => {
		const runCommand = async (_command, options) => {
			options.onOutput("temporary chunk\n");
			return 0;
		};
		const app = render(
			React.createElement(LazycursorTuiApp, {
				autoExit: false,
				runCommand,
			}),
		);

		app.stdin.write("clear me\r");

		await waitFor(
			() => app.lastFrame()?.includes("temporary chunk"),
			"transcript output",
		);

		app.stdin.write("\x0c");

		await waitFor(
			() =>
				(app.lastFrame()?.includes("Ready. Type a task and press Enter.") ??
					false) &&
				!app.lastFrame()?.includes("temporary chunk"),
			"cleared transcript",
		);

		app.unmount();
	});
});
