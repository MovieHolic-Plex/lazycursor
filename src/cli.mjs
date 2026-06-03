import {
	formatDryRunCommand,
	parseLazycursorArgs,
	runCursorCommand,
} from "./command.mjs";
import {
	applyInstallPlan,
	buildInstallPlan,
	formatInstallPlan,
} from "./install.mjs";

export async function runLazycursorCli(argv) {
	const parsed = parseLazycursorArgs(argv);

	if (parsed.kind === "help") {
		console.log(parsed.usage);
		return 0;
	}

	if (parsed.kind === "error") {
		console.error(parsed.message);
		return 2;
	}

	if (parsed.kind === "install") {
		const plan = buildInstallPlan(parsed.targetDir);
		if (parsed.dryRun) {
			console.log(formatInstallPlan(plan));
			return 0;
		}
		applyInstallPlan(plan);
		console.log(formatInstallPlan(plan));
		return 0;
	}

	if (parsed.dryRun) {
		console.log(formatDryRunCommand(parsed.command));
		return 0;
	}

	return runCursorCommand(parsed.command);
}
