import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readConfig, writeConfig } from "./config";

let testDir: string;

beforeEach(() => {
	testDir = join(tmpdir(), `scriptor-test-${Date.now()}`);
	mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
	rmSync(testDir, { recursive: true, force: true });
});

describe("readConfig", () => {
	test("returns typed config object when file exists with repo key", async () => {
		const configDir = join(testDir, ".scriptor");
		mkdirSync(configDir, { recursive: true });
		writeFileSync(join(configDir, "config"), "repo: owner/repo\n");

		const config = await readConfig(testDir);

		expect(config).toEqual({ repo: "owner/repo" });
	});

	test("returns empty config when file does not exist", async () => {
		const config = await readConfig(testDir);

		expect(config).toEqual({});
	});

	test("returns config without repo when file exists but has no repo key", async () => {
		const configDir = join(testDir, ".scriptor");
		mkdirSync(configDir, { recursive: true });
		writeFileSync(join(configDir, "config"), "# empty config\n");

		const config = await readConfig(testDir);

		expect(config).toEqual({});
	});

	test("returns default empty config when file is corrupt/unparseable", async () => {
		const configDir = join(testDir, ".scriptor");
		mkdirSync(configDir, { recursive: true });
		writeFileSync(join(configDir, "config"), "{ invalid: yaml: content: [[\n");

		const config = await readConfig(testDir);

		expect(config).toEqual({});
	});

	test("returns default empty config when file contains non-object YAML", async () => {
		const configDir = join(testDir, ".scriptor");
		mkdirSync(configDir, { recursive: true });
		writeFileSync(join(configDir, "config"), "- just a list\n- not a map\n");

		const config = await readConfig(testDir);

		expect(config).toEqual({});
	});
});

describe("writeConfig", () => {
	test("creates config file with correct YAML when directory exists", async () => {
		const configDir = join(testDir, ".scriptor");
		mkdirSync(configDir, { recursive: true });

		await writeConfig({ repo: "owner/repo" }, testDir);

		const written = await Bun.file(join(configDir, "config")).text();
		expect(written).toContain("repo: owner/repo");
	});

	test("creates .scriptor directory if it does not exist", async () => {
		await writeConfig({ repo: "myorg/scripts" }, testDir);

		const written = await Bun.file(join(testDir, ".scriptor", "config")).text();
		expect(written).toContain("repo: myorg/scripts");
	});

	test("overwrites existing config file", async () => {
		const configDir = join(testDir, ".scriptor");
		mkdirSync(configDir, { recursive: true });
		writeFileSync(join(configDir, "config"), "repo: old/repo\n");

		await writeConfig({ repo: "new/repo" }, testDir);

		const written = await Bun.file(join(configDir, "config")).text();
		expect(written).toContain("repo: new/repo");
		expect(written).not.toContain("old/repo");
	});

	test("writes empty config when no repo is set", async () => {
		await writeConfig({}, testDir);

		const written = await Bun.file(join(testDir, ".scriptor", "config")).text();
		expect(written.trim()).toBe("{}");
	});

	test("written file can be round-tripped back by readConfig", async () => {
		const original = { repo: "acme/setup" };

		await writeConfig(original, testDir);
		const result = await readConfig(testDir);

		expect(result).toEqual(original);
	});
});
