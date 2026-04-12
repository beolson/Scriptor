// @vitest-environment node
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LoadGroupsDeps } from "./loadGroups.js";
import { loadGroups } from "./loadGroups.js";
import type { Script } from "./types.js";

// Navigate from lib/ → scriptor-web/ → 20_Applications/ → repo root → scripts/
const groupsFilePath = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../../..",
	"scripts",
	"groups.json",
);

// Navigate from lib/ → scriptor-web/ → 20_Applications/ → repo root → scripts-fixture/
const fixtureGroupsFilePath = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../../..",
	"scripts-fixture",
	"groups.json",
);

const fixtureRunnerPath = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../../..",
	"scripts-fixture",
	"linux",
	"fixture-group",
	"run-all.sh",
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeGroupsJson(
	entries: Array<{ id: string; name: string; description: string }>,
): string {
	return JSON.stringify(entries, null, "\t");
}

function makeScript(overrides: Partial<Script> = {}): Script {
	return {
		id: "linux/ubuntu-24.04-x64/install-bun",
		title: "Install Bun",
		description: "Installs Bun runtime.",
		platform: "ubuntu-24.04-x64",
		body: "Install Bun body.",
		source: "#!/bin/bash\necho installing bun",
		runCommand:
			"curl -fsSL https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/linux/ubuntu-24.04-x64/install-bun.sh | bash",
		...overrides,
	};
}

/** Minimal in-memory deps factory — callers override what they need */
function makeDeps(overrides: Partial<LoadGroupsDeps> = {}): LoadGroupsDeps {
	return {
		readFile: async () => makeGroupsJson([]),
		writeFile: async () => {},
		groupsFilePath: "/fake/groups.json",
		scriptsRootPath: "/fake/scripts",
		...overrides,
	};
}

// ─── scripts/groups.json file-shape tests (integration) ──────────────────────

describe("scripts/groups.json", () => {
	it("exists and is valid JSON", async () => {
		const text = await readFile(groupsFilePath, "utf8");
		expect(() => JSON.parse(text)).not.toThrow();
	});

	it("top-level value is an array", async () => {
		const text = await readFile(groupsFilePath, "utf8");
		const data = JSON.parse(text);
		expect(Array.isArray(data)).toBe(true);
	});

	it("has at least one entry", async () => {
		const text = await readFile(groupsFilePath, "utf8");
		const data = JSON.parse(text) as unknown[];
		expect(data.length).toBeGreaterThanOrEqual(1);
	});

	it("first entry has id, name, and description as non-empty strings", async () => {
		const text = await readFile(groupsFilePath, "utf8");
		const data = JSON.parse(text) as Record<string, unknown>[];
		const first = data[0];
		expect(typeof first.id).toBe("string");
		expect((first.id as string).length).toBeGreaterThan(0);
		expect(typeof first.name).toBe("string");
		expect((first.name as string).length).toBeGreaterThan(0);
		expect(typeof first.description).toBe("string");
		expect((first.description as string).length).toBeGreaterThan(0);
	});
});

// ─── loadGroups() unit tests ──────────────────────────────────────────────────

describe("loadGroups()", () => {
	let warnSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
	});

	afterEach(() => {
		warnSpy.mockRestore();
	});

	// ── Error handling ────────────────────────────────────────────────────────

	it("returns [] and warns when groups.json is missing", async () => {
		const deps = makeDeps({
			readFile: async () => {
				throw new Error("ENOENT: no such file or directory");
			},
		});

		const result = await loadGroups([], deps);

		expect(result).toEqual([]);
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining("[loadGroups]"),
		);
	});

	it("returns [] and warns when groups.json contains malformed JSON", async () => {
		const deps = makeDeps({
			readFile: async () => "{ this is not : valid json ]",
		});

		const result = await loadGroups([], deps);

		expect(result).toEqual([]);
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining("[loadGroups]"),
		);
	});

	it("returns [] and warns when groups.json is not an array", async () => {
		const deps = makeDeps({
			readFile: async () => JSON.stringify({ id: "not-an-array" }),
		});

		const result = await loadGroups([], deps);

		expect(result).toEqual([]);
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining("[loadGroups]"),
		);
	});

	// ── Parsing ───────────────────────────────────────────────────────────────

	it("parses a valid manifest and returns typed GroupEntry[]", async () => {
		const entries = [
			{
				id: "linux-dev-setup",
				name: "Linux Dev Setup",
				description: "Sets up a Linux dev machine.",
			},
			{
				id: "mac-dev-setup",
				name: "Mac Dev Setup",
				description: "Sets up a Mac dev machine.",
			},
		];
		const deps = makeDeps({
			readFile: async () => makeGroupsJson(entries),
		});

		const result = await loadGroups([], deps);

		expect(result).toHaveLength(2);
		expect(result[0]).toEqual(entries[0]);
		expect(result[1]).toEqual(entries[1]);
	});

	it("returns an empty array when groups.json is a valid empty array", async () => {
		const deps = makeDeps({ readFile: async () => "[]" });

		const result = await loadGroups([], deps);

		expect(result).toEqual([]);
		expect(warnSpy).not.toHaveBeenCalled();
	});

	// ── Runner generation (happy path) ────────────────────────────────────────

	it("calls writeFile with runner path for a group with valid members", async () => {
		const writtenFiles = new Map<string, string>();
		const deps = makeDeps({
			readFile: async () =>
				makeGroupsJson([
					{
						id: "linux-dev-setup",
						name: "Linux Dev Setup",
						description: "Linux setup group.",
					},
				]),
			writeFile: async (path, content) => {
				writtenFiles.set(path, content);
			},
			scriptsRootPath: "/fake/scripts",
		});

		const scripts = [
			makeScript({
				id: "linux/ubuntu-24.04-x64/install-bun",
				title: "Install Bun",
				platform: "ubuntu-24.04-x64",
				group: "linux-dev-setup",
				groupOrder: 1,
			}),
		];

		await loadGroups(scripts, deps);

		expect(writtenFiles.size).toBe(1);
		const runnerPath = [...writtenFiles.keys()][0];
		expect(runnerPath).toContain("linux-dev-setup");
		expect(runnerPath).toContain("run-all.sh");
	});

	it("runner content includes [1/2] and [2/2] progress markers", async () => {
		let writtenContent = "";
		const deps = makeDeps({
			readFile: async () =>
				makeGroupsJson([
					{
						id: "linux-dev-setup",
						name: "Linux Dev Setup",
						description: "Linux setup group.",
					},
				]),
			writeFile: async (_path, content) => {
				writtenContent = content;
			},
		});

		const scripts = [
			makeScript({
				id: "linux/ubuntu-24.04-x64/install-bun",
				title: "Install Bun",
				platform: "ubuntu-24.04-x64",
				group: "linux-dev-setup",
				groupOrder: 1,
			}),
			makeScript({
				id: "linux/ubuntu-24.04-x64/install-go",
				title: "Install Go",
				platform: "ubuntu-24.04-x64",
				group: "linux-dev-setup",
				groupOrder: 2,
			}),
		];

		await loadGroups(scripts, deps);

		expect(writtenContent).toContain("[1/2]");
		expect(writtenContent).toContain("[2/2]");
	});

	it("runner content includes member script raw URLs in declared order", async () => {
		let writtenContent = "";
		const deps = makeDeps({
			readFile: async () =>
				makeGroupsJson([
					{
						id: "linux-dev-setup",
						name: "Linux Dev Setup",
						description: "Linux setup group.",
					},
				]),
			writeFile: async (_path, content) => {
				writtenContent = content;
			},
		});

		const bunScript = makeScript({
			id: "linux/ubuntu-24.04-x64/install-bun",
			title: "Install Bun",
			platform: "ubuntu-24.04-x64",
			group: "linux-dev-setup",
			groupOrder: 1,
			runCommand:
				"curl -fsSL https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/linux/ubuntu-24.04-x64/install-bun.sh | bash",
		});
		const goScript = makeScript({
			id: "linux/ubuntu-24.04-x64/install-go",
			title: "Install Go",
			platform: "ubuntu-24.04-x64",
			group: "linux-dev-setup",
			groupOrder: 2,
			runCommand:
				"curl -fsSL https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/linux/ubuntu-24.04-x64/install-go.sh | bash",
		});

		await loadGroups([bunScript, goScript], deps);

		// Both URLs appear in the runner
		expect(writtenContent).toContain("install-bun.sh");
		expect(writtenContent).toContain("install-go.sh");

		// Bun URL appears before Go URL
		const bunIdx = writtenContent.indexOf("install-bun.sh");
		const goIdx = writtenContent.indexOf("install-go.sh");
		expect(bunIdx).toBeLessThan(goIdx);
	});

	it("skips runner generation and warns when a group has no valid members", async () => {
		const writtenFiles = new Map<string, string>();
		const deps = makeDeps({
			readFile: async () =>
				makeGroupsJson([
					{
						id: "linux-dev-setup",
						name: "Linux Dev Setup",
						description: "Linux setup group.",
					},
				]),
			writeFile: async (path, content) => {
				writtenFiles.set(path, content);
			},
		});

		// No scripts belong to this group
		await loadGroups([], deps);

		expect(writtenFiles.size).toBe(0);
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining("linux-dev-setup"),
		);
	});

	// ── Platform constraint ───────────────────────────────────────────────────

	it("throws with group ID and conflicting platforms when member scripts span multiple platforms", async () => {
		const deps = makeDeps({
			readFile: async () =>
				makeGroupsJson([
					{
						id: "mixed-group",
						name: "Mixed Group",
						description: "A group with mixed platforms.",
					},
				]),
		});

		const scripts = [
			makeScript({
				id: "linux/ubuntu-24.04-x64/install-bun",
				title: "Install Bun",
				platform: "ubuntu-24.04-x64",
				group: "mixed-group",
				groupOrder: 1,
			}),
			makeScript({
				id: "windows/windows-11-x64/install-bun",
				title: "Install Bun Windows",
				platform: "windows-11-x64",
				group: "mixed-group",
				groupOrder: 2,
			}),
		];

		await expect(loadGroups(scripts, deps)).rejects.toThrow(
			expect.objectContaining({
				message: expect.stringContaining("mixed-group"),
			}),
		);
	});

	it("thrown platform error message names the conflicting platforms", async () => {
		const deps = makeDeps({
			readFile: async () =>
				makeGroupsJson([
					{
						id: "mixed-group",
						name: "Mixed Group",
						description: "A group with mixed platforms.",
					},
				]),
		});

		const scripts = [
			makeScript({
				id: "linux/ubuntu-24.04-x64/install-bun",
				platform: "ubuntu-24.04-x64",
				group: "mixed-group",
				groupOrder: 1,
			}),
			makeScript({
				id: "windows/windows-11-x64/install-bun",
				platform: "windows-11-x64",
				group: "mixed-group",
				groupOrder: 2,
			}),
		];

		await expect(loadGroups(scripts, deps)).rejects.toThrow(
			expect.objectContaining({
				message: expect.stringMatching(/ubuntu-24\.04-x64|windows-11-x64/),
			}),
		);
	});

	// ── Member sort order ─────────────────────────────────────────────────────

	it("sorts members: explicit groupOrder ascending, then id as tiebreaker", async () => {
		let writtenContent = "";
		const deps = makeDeps({
			readFile: async () =>
				makeGroupsJson([
					{
						id: "linux-dev-setup",
						name: "Linux Dev Setup",
						description: "Linux setup group.",
					},
				]),
			writeFile: async (_path, content) => {
				writtenContent = content;
			},
		});

		const scripts = [
			makeScript({
				id: "linux/ubuntu-24.04-x64/install-go",
				title: "Install Go",
				platform: "ubuntu-24.04-x64",
				group: "linux-dev-setup",
				groupOrder: 2,
				runCommand:
					"curl -fsSL https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/linux/ubuntu-24.04-x64/install-go.sh | bash",
			}),
			makeScript({
				id: "linux/ubuntu-24.04-x64/install-bun",
				title: "Install Bun",
				platform: "ubuntu-24.04-x64",
				group: "linux-dev-setup",
				groupOrder: 1,
				runCommand:
					"curl -fsSL https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/linux/ubuntu-24.04-x64/install-bun.sh | bash",
			}),
		];

		await loadGroups(scripts, deps);

		// groupOrder: 1 (Bun) must appear before groupOrder: 2 (Go)
		const bunIdx = writtenContent.indexOf("install-bun.sh");
		const goIdx = writtenContent.indexOf("install-go.sh");
		expect(bunIdx).toBeLessThan(goIdx);
	});

	it("members without groupOrder sort after members with explicit groupOrder, with id as tiebreaker", async () => {
		let writtenContent = "";
		const deps = makeDeps({
			readFile: async () =>
				makeGroupsJson([
					{
						id: "linux-dev-setup",
						name: "Linux Dev Setup",
						description: "Linux setup group.",
					},
				]),
			writeFile: async (_path, content) => {
				writtenContent = content;
			},
		});

		const scripts = [
			// No groupOrder — sorts after explicit
			makeScript({
				id: "linux/ubuntu-24.04-x64/install-dotnet",
				title: "Install .NET",
				platform: "ubuntu-24.04-x64",
				group: "linux-dev-setup",
				// no groupOrder
				runCommand:
					"curl -fsSL https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/linux/ubuntu-24.04-x64/install-dotnet.sh | bash",
			}),
			makeScript({
				id: "linux/ubuntu-24.04-x64/install-bun",
				title: "Install Bun",
				platform: "ubuntu-24.04-x64",
				group: "linux-dev-setup",
				groupOrder: 1,
				runCommand:
					"curl -fsSL https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/linux/ubuntu-24.04-x64/install-bun.sh | bash",
			}),
		];

		await loadGroups(scripts, deps);

		// Bun (groupOrder: 1) should appear before .NET (no groupOrder)
		const bunIdx = writtenContent.indexOf("install-bun.sh");
		const dotnetIdx = writtenContent.indexOf("install-dotnet.sh");
		expect(bunIdx).toBeLessThan(dotnetIdx);
	});

	it("uses id as tiebreaker when two members share the same groupOrder", async () => {
		let writtenContent = "";
		const deps = makeDeps({
			readFile: async () =>
				makeGroupsJson([
					{
						id: "linux-dev-setup",
						name: "Linux Dev Setup",
						description: "Linux setup group.",
					},
				]),
			writeFile: async (_path, content) => {
				writtenContent = content;
			},
		});

		const scripts = [
			makeScript({
				id: "linux/ubuntu-24.04-x64/install-z-tool",
				title: "Install Z Tool",
				platform: "ubuntu-24.04-x64",
				group: "linux-dev-setup",
				groupOrder: 1,
				runCommand:
					"curl -fsSL https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/linux/ubuntu-24.04-x64/install-z-tool.sh | bash",
			}),
			makeScript({
				id: "linux/ubuntu-24.04-x64/install-a-tool",
				title: "Install A Tool",
				platform: "ubuntu-24.04-x64",
				group: "linux-dev-setup",
				groupOrder: 1,
				runCommand:
					"curl -fsSL https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/linux/ubuntu-24.04-x64/install-a-tool.sh | bash",
			}),
		];

		await loadGroups(scripts, deps);

		// a-tool (id sorts first) should appear before z-tool
		const aIdx = writtenContent.indexOf("install-a-tool.sh");
		const zIdx = writtenContent.indexOf("install-z-tool.sh");
		expect(aIdx).toBeLessThan(zIdx);
	});

	// ── Unknown group IDs ─────────────────────────────────────────────────────

	it("ignores scripts whose group field does not match any groups.json entry and warns", async () => {
		const writtenFiles = new Map<string, string>();
		const deps = makeDeps({
			readFile: async () =>
				makeGroupsJson([
					{
						id: "linux-dev-setup",
						name: "Linux Dev Setup",
						description: "Linux setup group.",
					},
				]),
			writeFile: async (path, content) => {
				writtenFiles.set(path, content);
			},
		});

		const scripts = [
			makeScript({
				id: "linux/ubuntu-24.04-x64/install-bun",
				title: "Install Bun",
				platform: "ubuntu-24.04-x64",
				group: "nonexistent-group-id", // does not match any entry
				groupOrder: 1,
			}),
		];

		await loadGroups(scripts, deps);

		// No runner written for the unknown group
		expect(writtenFiles.size).toBe(0);
		// A warning is emitted
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining("nonexistent-group-id"),
		);
	});

	// ── Runner content structure ──────────────────────────────────────────────

	it("runner script starts with bash shebang and set -euo pipefail", async () => {
		let writtenContent = "";
		const deps = makeDeps({
			readFile: async () =>
				makeGroupsJson([
					{
						id: "linux-dev-setup",
						name: "Linux Dev Setup",
						description: "Linux setup group.",
					},
				]),
			writeFile: async (_path, content) => {
				writtenContent = content;
			},
		});

		const scripts = [
			makeScript({
				id: "linux/ubuntu-24.04-x64/install-bun",
				title: "Install Bun",
				platform: "ubuntu-24.04-x64",
				group: "linux-dev-setup",
				groupOrder: 1,
			}),
		];

		await loadGroups(scripts, deps);

		expect(writtenContent).toContain("#!/bin/bash");
		expect(writtenContent).toContain("set -euo pipefail");
	});

	it("runner script for .ps1 group uses irm | iex pattern", async () => {
		let writtenPath = "";
		let writtenContent = "";
		const deps = makeDeps({
			readFile: async () =>
				makeGroupsJson([
					{
						id: "windows-dev-setup",
						name: "Windows Dev Setup",
						description: "Windows setup group.",
					},
				]),
			writeFile: async (path, content) => {
				writtenPath = path;
				writtenContent = content;
			},
		});

		const scripts = [
			makeScript({
				id: "windows/windows-11-x64/install-bun",
				title: "Install Bun",
				platform: "windows-11-x64",
				group: "windows-dev-setup",
				groupOrder: 1,
				runCommand:
					"irm https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/windows/windows-11-x64/install-bun.ps1 | iex",
			}),
		];

		await loadGroups(scripts, deps);

		expect(writtenPath).toContain("run-all.ps1");
		expect(writtenContent).toContain("irm");
		expect(writtenContent).toContain("iex");
	});

	it("runner path is placed under scriptsRootPath/<platform-prefix>/<group-id>/", async () => {
		let writtenPath = "";
		const deps = makeDeps({
			readFile: async () =>
				makeGroupsJson([
					{
						id: "linux-dev-setup",
						name: "Linux Dev Setup",
						description: "Linux setup group.",
					},
				]),
			writeFile: async (path) => {
				writtenPath = path;
			},
			scriptsRootPath: "/my/scripts",
		});

		const scripts = [
			makeScript({
				id: "linux/ubuntu-24.04-x64/install-bun",
				title: "Install Bun",
				platform: "ubuntu-24.04-x64",
				group: "linux-dev-setup",
				groupOrder: 1,
			}),
		];

		await loadGroups(scripts, deps);

		// Path should be under /my/scripts/linux/<group-id>/run-all.sh
		expect(writtenPath).toContain("/my/scripts/");
		expect(writtenPath).toContain("/linux-dev-setup/");
		expect(writtenPath).toContain("run-all.sh");
	});
});

// ─── scripts-fixture/groups.json file-shape tests (integration) ──────────────

describe("scripts-fixture/groups.json", () => {
	it("exists and is valid JSON", async () => {
		const text = await readFile(fixtureGroupsFilePath, "utf8");
		expect(() => JSON.parse(text)).not.toThrow();
	});

	it("top-level value is an array", async () => {
		const text = await readFile(fixtureGroupsFilePath, "utf8");
		const data = JSON.parse(text);
		expect(Array.isArray(data)).toBe(true);
	});

	it("has at least one entry", async () => {
		const text = await readFile(fixtureGroupsFilePath, "utf8");
		const data = JSON.parse(text) as unknown[];
		expect(data.length).toBeGreaterThanOrEqual(1);
	});

	it("contains a fixture-group entry with id, name, and description", async () => {
		const text = await readFile(fixtureGroupsFilePath, "utf8");
		const data = JSON.parse(text) as Record<string, unknown>[];
		const fixtureEntry = data.find((entry) => entry.id === "fixture-group");
		expect(fixtureEntry).toBeDefined();
		expect(typeof fixtureEntry?.name).toBe("string");
		expect((fixtureEntry?.name as string).length).toBeGreaterThan(0);
		expect(typeof fixtureEntry?.description).toBe("string");
		expect((fixtureEntry?.description as string).length).toBeGreaterThan(0);
	});
});

// ─── scripts-fixture run-all.sh runner file tests (integration) ──────────────

describe("scripts-fixture/linux/fixture-group/run-all.sh", () => {
	it("exists and is readable", async () => {
		const text = await readFile(fixtureRunnerPath, "utf8");
		expect(text.length).toBeGreaterThan(0);
	});

	it("starts with a bash shebang", async () => {
		const text = await readFile(fixtureRunnerPath, "utf8");
		expect(text.startsWith("#!/bin/bash")).toBe(true);
	});

	it("contains set -euo pipefail", async () => {
		const text = await readFile(fixtureRunnerPath, "utf8");
		expect(text).toContain("set -euo pipefail");
	});

	it("references fixture-install-curl script URL", async () => {
		const text = await readFile(fixtureRunnerPath, "utf8");
		expect(text).toContain("fixture-install-curl");
	});

	it("references fixture-setup-dev script URL", async () => {
		const text = await readFile(fixtureRunnerPath, "utf8");
		expect(text).toContain("fixture-setup-dev");
	});
});
