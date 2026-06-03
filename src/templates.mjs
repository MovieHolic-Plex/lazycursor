export const ULTRAWORK_COMMAND = `# Ultrawork mode

First line MUST be exactly:
LAZYCURSOR ULTRAWORK MODE ENABLED!

Run this request using a strict ultrawork workflow:

1. Restate the target result and constraints.
2. Run deep-interview when requirements are ambiguous enough to need clarification.
3. Produce a ralplan-grade plan before broad implementation.
4. Track and complete work through ultragoal.
5. Use optional team execution only when parallel tmux workers help.
6. Verify with tests and a real manual QA surface.
7. Update .cursor/lazycursor/state.json as obligations are completed. Use obligation status values \`pending\` and \`done\`.
8. Report evidence paths and cleanup.

Treat the user's text after this command as the task.`;

export const ULTRAWORK_RULE = `---
description: Lazycursor ultrawork keyword routing
alwaysApply: true
---

# Lazycursor ultrawork routing

When the user starts a message with bare \`ulw\` or \`ultrawork\`, interpret it as a request to run Ultrawork mode for the remaining task text.

Your first visible response line for those requests MUST be exactly:
LAZYCURSOR ULTRAWORK MODE ENABLED!

If \`.cursor/lazycursor/state.json\` says \`active: true\`, you MUST follow that workflow state before stopping. Mark obligations with \`status: "done"\` only after concrete evidence exists.

For those requests:

1. State the target result and constraints.
2. Define concrete acceptance criteria before editing.
3. Follow the workflow: \`deep-interview -> ralplan -> ultragoal -> optional team execution when parallel tmux workers help\`.
4. Prefer tests before implementation when code changes are needed.
5. Update \`.cursor/lazycursor/state.json\` as each obligation is completed; supported obligation statuses are \`pending\` and \`done\`.
6. Run relevant tests and at least one real manual QA check.
7. Set \`active: false\` only after every required obligation is done and final evidence is reported.

Do not launch a nested \`cursor-agent\` just because the user typed \`ulw\`. Execute the workflow in the current Cursor agent session.`;

export const AGENTS_BLOCK_START = "<!-- LAZYCURSOR MANAGED BLOCK START -->";
export const AGENTS_BLOCK_END = "<!-- LAZYCURSOR MANAGED BLOCK END -->";

export const AGENTS_ROUTING = `${AGENTS_BLOCK_START}
# Lazycursor Cursor Agent Routing

When the user message starts with \`ulw\` or \`ultrawork\`, treat it as a request to run the lazycursor ultrawork workflow in the current Cursor agent session.

For those requests, when no higher-priority instruction conflicts, your first visible response line MUST be exactly:
LAZYCURSOR ULTRAWORK MODE ENABLED!

If \`.cursor/lazycursor/state.json\` has \`active: true\`, do not stop while required obligations are pending. Update obligation statuses from \`pending\` to \`done\` as work progresses, and set \`active: false\` only after ultragoal evidence and final reporting are complete.

Then execute the workflow in the current Cursor agent session:

1. Restate the target result and constraints.
2. Define pass/fail acceptance criteria before editing.
3. Follow \`deep-interview -> ralplan -> ultragoal\`.
4. Use optional team execution only when parallel tmux workers help.
5. Write or identify tests before implementation when code changes are needed.
6. Implement the smallest correct change.
7. Verify with tests and at least one real manual QA surface.
8. Report evidence paths and cleanup.

Do not launch a nested \`cursor-agent\` for \`ulw\` or \`ultrawork\`.
${AGENTS_BLOCK_END}`;

export const LAZYCURSOR_HOOK_SCRIPT = `#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const STATE_PATH = join(process.cwd(), ".cursor", "lazycursor", "state.json");
const EVENTS_PATH = join(process.cwd(), ".cursor", "lazycursor", "events.jsonl");
const ULW_PATTERN = /^\\s*\\/?(?:ulw|ultrawork)\\b:?\\s*([\\s\\S]*)?$/i;
const CANCEL_PATTERN = /^\\s*\\/?(?:ulw|ultrawork)\\s+cancel\\b/i;
const DEFAULT_OBLIGATIONS = [
  { id: "deep-interview", status: "pending" },
  { id: "ralplan", status: "pending" },
  { id: "ultragoal", status: "pending" },
  { id: "team", status: "pending", optional: true }
];

function main() {
  const event = process.argv[2] ?? "unknown";
  const input = readStdinJson();
  if (input?.__lazycursorInvalidStdin === true) {
    return handleInvalidHookInput(event, input.error);
  }

  if (event === "beforeSubmitPrompt") {
    return handleBeforeSubmitPrompt(input);
  }

  if (event === "stop") {
    return handleStop();
  }

  writeJson({});
}

function handleInvalidHookInput(event, errorMessage) {
  writeState({
    active: true,
    mode: "ulw",
    phase: "protocol_error",
    obligations: [{ id: "repair_hook_input", status: "pending" }],
    stopLoopCount: 0,
    error: errorMessage,
    updatedAt: new Date().toISOString()
  });
  appendEvent({ event: "protocol_error", hookEvent: event, error: errorMessage });

  if (event === "beforeSubmitPrompt") {
    writeJson({
      permission: "deny",
      message: "LAZYCURSOR HOOK ERROR: invalid hook JSON input. Repair the Cursor hook invocation before continuing."
    });
    return;
  }

  writeJson({
    followup_message: [
      "LAZYCURSOR STOP HOOK: invalid hook JSON input.",
      "Repair the Cursor hook invocation and update .cursor/lazycursor/state.json before stopping.",
      "Pending obligations: repair_hook_input"
    ].join("\\n")
  });
}

function handleBeforeSubmitPrompt(input) {
  const prompt = extractPrompt(input);

  if (CANCEL_PATTERN.test(prompt)) {
    writeState({ active: false, mode: "idle", phase: "cancelled", obligations: [], stopLoopCount: 0 });
    appendEvent({ event: "cancel", prompt });
    writeJson({ permission: "allow" });
    return;
  }

  const match = ULW_PATTERN.exec(prompt);
  if (match === null) {
    writeJson({ permission: "allow" });
    return;
  }

  const task = (match[1] ?? "").trim();
  const state = readState();
  if (state.active) {
    appendEvent({ event: "activate_ignored_active", prompt: task });
    writeJson({ permission: "allow" });
    return;
  }

  writeState({
    active: true,
    mode: "ulw",
    phase: "planning",
    prompt: task,
    obligations: DEFAULT_OBLIGATIONS,
    stopLoopCount: 0,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  appendEvent({ event: "activate", prompt: task });
  writeJson({ permission: "allow" });
}

function handleStop() {
  const state = readState();
  if (!state.active) {
    writeJson({});
    return;
  }

  const obligations = Array.isArray(state.obligations) ? state.obligations : [];
  const pending = obligations.filter((item) => item?.status !== "done" && item?.optional !== true);
  if (pending.length === 0) {
    writeState({ ...state, active: false, phase: "finished", completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    appendEvent({ event: "finish" });
    writeJson({});
    return;
  }

  const stopLoopCount = Number.isInteger(state.stopLoopCount) ? state.stopLoopCount + 1 : 1;
  writeState({ ...state, stopLoopCount, updatedAt: new Date().toISOString() });
  appendEvent({ event: "stop_block", pending: pending.map((item) => item.id), stopLoopCount });
  writeJson({
    followup_message: [
      "LAZYCURSOR STOP HOOK: active ultrawork state is not complete.",
      "Read .cursor/lazycursor/state.json, finish required pending obligations, and update the JSON state as evidence is completed.",
      "Required pending obligations: " + pending.map((item) => item.id).join(", "),
      "Do not set active=false until ultragoal evidence and final reporting are complete."
    ].join("\\n")
  });
}

function extractPrompt(input) {
  for (const key of ["prompt", "message", "text", "userPrompt", "user_prompt"]) {
    if (typeof input?.[key] === "string") {
      return input[key];
    }
  }
  return "";
}

function readStdinJson() {
  const raw = readFileSync(0, "utf8").trim();
  if (raw.length === 0) {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { __lazycursorInvalidStdin: true, error: error.message };
    }
    throw error;
  }
}

function readState() {
  if (!existsSync(STATE_PATH)) {
    return { active: false, mode: "idle", phase: "idle", obligations: [], stopLoopCount: 0 };
  }
  try {
    return JSON.parse(readFileSync(STATE_PATH, "utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        active: true,
        mode: "ulw",
        phase: "invalid_state",
        obligations: [{ id: "repair_state", status: "pending" }],
        stopLoopCount: 0
      };
    }
    throw error;
  }
}

function writeState(state) {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  const tempPath = STATE_PATH + "." + process.pid + ".tmp";
  writeFileSync(tempPath, JSON.stringify(state, null, 2) + "\\n", "utf8");
  renameSync(tempPath, STATE_PATH);
}

function appendEvent(event) {
  mkdirSync(dirname(EVENTS_PATH), { recursive: true });
  writeFileSync(EVENTS_PATH, JSON.stringify({ ...event, at: new Date().toISOString() }) + "\\n", {
    encoding: "utf8",
    flag: "a"
  });
}

function writeJson(value) {
  process.stdout.write(JSON.stringify(value) + "\\n");
}

main();
`;

export const INITIAL_STATE = {
	active: false,
	mode: "idle",
	phase: "idle",
	obligations: [],
	stopLoopCount: 0,
};
