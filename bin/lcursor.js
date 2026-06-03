#!/usr/bin/env node

import { runLcursorCli } from "../src/cli.mjs";

process.exit(await runLcursorCli(process.argv.slice(2)));
