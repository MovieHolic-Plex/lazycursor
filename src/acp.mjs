import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import {
	activateUltraworkState,
	buildStopFollowup,
	inspectLazycursorStop,
} from "./state.mjs";

export async function runEnforcedAcpUltrawork(command, options = {}) {
	const workspace = process.cwd();
	const client = new AcpClient(command.bin, command.args, workspace, options);
	try {
		await client.start();
		const session = await client.openSession(workspace);
		return await sendEnforcedPrompt({
			client,
			prompt: command.statePrompt,
			sessionId: session.sessionId,
			workspace,
		});
	} finally {
		client.close();
	}
}

export async function createAcpConversation(command, options = {}) {
	const workspace = process.cwd();
	const client = new AcpClient(command.bin, command.args, workspace, options);
	let session;
	try {
		await client.start();
		session = await client.openSession(workspace);
	} catch (error) {
		client.close();
		throw error;
	}

	return {
		close() {
			client.close();
		},
		submit(prompt) {
			return sendEnforcedPrompt({
				client,
				prompt,
				sessionId: session.sessionId,
				workspace,
			});
		},
	};
}

class AcpClient {
	constructor(bin, args, cwd, options = {}) {
		this.bin = bin;
		this.args = args;
		this.cwd = cwd;
		this.onOutput = options.onOutput;
		this.nextId = 1;
		this.pending = new Map();
		this.child = null;
		this.closing = false;
	}

	async start() {
		this.child = spawn(this.bin, this.args, {
			cwd: this.cwd,
			env: process.env,
			stdio: ["pipe", "pipe", "inherit"],
		});

		const lines = createInterface({ input: this.child.stdout });
		lines.on("line", (line) => this.handleLine(line));
		this.child.on("exit", (code) => {
			if (this.closing) {
				this.pending.clear();
				return;
			}
			const error = new Error(
				`ACP process exited with code ${code ?? "unknown"}`,
			);
			this.rejectPending(error);
		});
	}

	async openSession(cwd) {
		await this.request("initialize", {
			protocolVersion: 1,
			clientCapabilities: {
				fs: { readTextFile: false, writeTextFile: false },
				terminal: false,
			},
			clientInfo: { name: "lazycursor", version: "0.8.0" },
		});
		await this.request("authenticate", { methodId: "cursor_login" });
		return this.request("session/new", { cwd, mcpServers: [] });
	}

	sendPrompt(sessionId, prompt) {
		return this.request("session/prompt", {
			sessionId,
			prompt: [{ type: "text", text: prompt }],
		});
	}

	request(method, params) {
		if (this.child === null || this.child.stdin.destroyed) {
			return Promise.reject(new Error("ACP process is not running"));
		}

		const id = this.nextId;
		this.nextId += 1;
		const message = { jsonrpc: "2.0", id, method, params };
		const waiter = new Promise((resolve, reject) => {
			this.pending.set(id, { resolve, reject });
		});
		this.child.stdin.write(`${JSON.stringify(message)}\n`);
		return waiter;
	}

	handleLine(line) {
		let message;
		try {
			message = JSON.parse(line);
		} catch {
			return;
		}

		if (message.id !== undefined && this.pending.has(message.id)) {
			const waiter = this.pending.get(message.id);
			this.pending.delete(message.id);
			if (message.error !== undefined) {
				waiter.reject(new Error(message.error.message ?? "ACP request failed"));
				return;
			}
			waiter.resolve(message.result ?? {});
			return;
		}

		if (message.method === "session/update") {
			this.handleSessionUpdate(message.params?.update);
			return;
		}

		if (
			message.method === "session/request_permission" &&
			message.id !== undefined
		) {
			this.respond(message.id, {
				outcome: { outcome: "selected", optionId: "allow-once" },
			});
		}
	}

	handleSessionUpdate(update) {
		const text = update?.content?.text;
		if (
			update?.sessionUpdate === "agent_message_chunk" &&
			typeof text === "string"
		) {
			if (this.onOutput === undefined) {
				process.stdout.write(text);
				return;
			}
			this.onOutput(text);
		}
	}

	respond(id, result) {
		if (this.child === null || this.child.stdin.destroyed) {
			return;
		}
		this.child.stdin.write(
			`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`,
		);
	}

	close() {
		if (this.child === null) {
			return;
		}
		this.closing = true;
		this.rejectPending(new Error("ACP process was closed"));
		this.child.stdin.end();
		this.child.kill();
	}

	rejectPending(error) {
		for (const waiter of this.pending.values()) {
			waiter.reject(error);
		}
		this.pending.clear();
	}
}

function buildRunPrompt(prompt) {
	return `ultrawork ${prompt}`.trim();
}

async function sendEnforcedPrompt({ client, prompt, sessionId, workspace }) {
	activateUltraworkState(workspace, prompt, "acp");
	let nextPrompt = buildRunPrompt(prompt);

	for (;;) {
		await client.sendPrompt(sessionId, nextPrompt);
		const stop = inspectLazycursorStop(workspace, 8, "acp");
		if (stop.kind === "inactive" || stop.kind === "finished") {
			return 0;
		}

		const followup = buildStopFollowup(stop.pending, "ACP");
		if (stop.kind === "limit_exceeded") {
			console.error(followup);
			console.error("LAZYCURSOR STOP ACP: loop limit exceeded.");
			return 1;
		}
		nextPrompt = buildRunPrompt(followup);
	}
}
