#!/usr/bin/env node

import {
	formatDryRunCommand,
	parseLazycursorArgs,
	runCursorCommand,
} from "../src/command.mjs";
import {
	applyInstallPlan,
	buildInstallPlan,
	formatInstallPlan,
} from "../src/install.mjs";

const parsed = parseLazycursorArgs(process.argv.slice(2));

if (parsed.kind === "help") {
	console.log(parsed.usage);
	process.exit(0);
}

if (parsed.kind === "error") {
	console.error(parsed.message);
	process.exit(2);
}

if (parsed.kind === "install") {
	const plan = buildInstallPlan(parsed.targetDir);
	if (parsed.dryRun) {
		console.log(formatInstallPlan(plan));
		process.exit(0);
	}
	applyInstallPlan(plan);
	console.log(formatInstallPlan(plan));
	process.exit(0);
}

if (parsed.dryRun) {
	console.log(formatDryRunCommand(parsed.command));
	process.exit(0);
}

process.exit(await runCursorCommand(parsed.command));
