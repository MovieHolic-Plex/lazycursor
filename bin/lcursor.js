#!/usr/bin/env node

import { runLazycursorCli } from "../src/cli.mjs";
import { normalizeLcursorArgs } from "../src/command.mjs";

process.exit(
	await runLazycursorCli(normalizeLcursorArgs(process.argv.slice(2))),
);
