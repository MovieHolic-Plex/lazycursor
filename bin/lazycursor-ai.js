#!/usr/bin/env node

import { runLazycursorCli } from "../src/cli.mjs";

process.exit(await runLazycursorCli(process.argv.slice(2)));
