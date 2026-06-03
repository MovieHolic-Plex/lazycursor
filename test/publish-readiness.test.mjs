import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, join } from "node:path";
import { describe, it } from "node:test";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json");
const rootDir = new URL("..", import.meta.url).pathname;

const readProjectFile = (path) => readFileSync(join(rootDir, path), "utf8");

describe("README publish readiness", () => {
	it("Given a public repository upload When reading README Then it documents install and usage in four languages", () => {
		const readme = readProjectFile("README.md");

		for (const heading of ["## English", "## 한국어", "## 日本語", "## 中文"]) {
			assert.match(readme, new RegExp(`^${heading}$`, "m"), heading);
		}

		assert.match(readme, /npx lazycursor-ai install/);
		assert.match(readme, /\/ulw/);
		assert.match(readme, /Cursor Agent/);
	});
});

describe("package publish metadata", () => {
	it("Given GitHub publication When checking package metadata Then it points at the public lazycursor repository", () => {
		assert.equal(
			packageJson.repository.url,
			"git+https://github.com/MovieHolic-Plex/lazycursor.git",
		);
		assert.equal(
			packageJson.homepage,
			"https://github.com/MovieHolic-Plex/lazycursor#readme",
		);
		assert.equal(
			packageJson.bugs.url,
			"https://github.com/MovieHolic-Plex/lazycursor/issues",
		);
	});
});

describe("repository hygiene", () => {
	it("Given a public upload When checking ignore policy Then sensitive local files and generated artifacts are excluded", () => {
		const gitignore = readProjectFile(".gitignore");

		for (const pattern of [
			"node_modules/",
			"*.tgz",
			".env*",
			"*.pem",
			"*.key",
			"credentials.*",
			"config.local.*",
			"coverage/",
		]) {
			assert.match(
				gitignore,
				new RegExp(`^${pattern.replaceAll("*", "\\*")}$`, "m"),
			);
		}
	});

	it("Given a public upload When scanning project files Then sensitive file names are absent", () => {
		const sensitiveNames = new Set([
			".env",
			".env.local",
			"credentials.json",
			"credentials.yml",
			"config.local.json",
		]);
		const sensitiveExtensions = new Set([".pem", ".key"]);
		const visited = [];
		const stack = [rootDir];

		while (stack.length > 0) {
			const current = stack.pop();
			for (const entry of readdirSync(current, { withFileTypes: true })) {
				if ([".git", "node_modules"].includes(entry.name)) {
					continue;
				}

				const absolute = join(current, entry.name);
				if (entry.isDirectory()) {
					stack.push(absolute);
					continue;
				}

				visited.push(entry.name);
				assert.equal(
					sensitiveNames.has(entry.name),
					false,
					`sensitive file name found: ${entry.name}`,
				);
				assert.equal(
					sensitiveExtensions.has(extname(entry.name)),
					false,
					`sensitive file extension found: ${entry.name}`,
				);
			}
		}

		assert.equal(existsSync(join(rootDir, "package-lock.json")), true);
		assert.ok(visited.includes("package.json"));
	});
});
