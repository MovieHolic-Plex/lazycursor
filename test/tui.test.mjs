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
				onExitStatus: (status) => {
					exitStatus = status;
				},
				runCommand,
			}),
		);

		app.stdin.write("fix tests\r");

		await waitFor(
			() => calls.length === 1 && app.lastFrame()?.includes("Done."),
			"successful TUI completion",
		);

		assert.deepEqual(calls[0], {
			bin: "/tmp/fake-agent",
			args: ["acp"],
			runner: "acp",
			statePrompt: "fix tests",
		});
		assert.equal(exitStatus, 0);
		assert.match(app.lastFrame() ?? "", /agent chunk/);

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
		app.unmount();
	});
});
