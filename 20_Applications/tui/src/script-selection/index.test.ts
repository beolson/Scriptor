// ---------------------------------------------------------------------------
// Script Selection Orchestrator Tests
//
// All deps are injected as fakes. No filesystem, network, or TTY calls.
// TDD: tests were written before the implementation (RED → GREEN).
// ---------------------------------------------------------------------------

import { describe, expect, it } from "bun:test";
import type { HostInfo } from "../host/types.js";
import type { Manifest, ScriptEntry } from "../manifest/types.js";
import {
	CircularDependencyError,
	MissingDependencyError,
} from "../manifest/types.js";
import type { ManifestResult } from "../startup/orchestrator.js";
import type { ScriptSelectionDeps } from "./index.js";
import { runScriptSelection } from "./index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_HOST: HostInfo = { platform: "linux", arch: "x86" };

function makeManifestResult(
	overrides: Partial<ManifestResult> = {},
): ManifestResult {
	return {
		repo: { owner: "test", name: "scripts" },
		manifest: "raw-yaml",
		host: DEFAULT_HOST,
		...overrides,
	};
}

function makeEntry(
	overrides: Partial<ScriptEntry> & { id: string; name: string },
): ScriptEntry {
	return {
		description: "A test script",
		platform: "linux",
		arch: "x86",
		script: "script.sh",
		distro: "Debian GNU/Linux",
		version: "13",
		group: "tools",
		dependencies: [],
		optional_dependencies: [],
		requires_elevation: false,
		inputs: [],
		...overrides,
	};
}

/**
 * Builds a full set of fake deps with sensible defaults.
 * Each dep can be overridden for specific test scenarios.
 */
function makeDeps(
	overrides: Partial<ScriptSelectionDeps> = {},
): ScriptSelectionDeps {
	const defaultEntries: ScriptEntry[] = [
		makeEntry({ id: "a", name: "Alpha", group: "tools" }),
		makeEntry({ id: "b", name: "Beta", group: "tools" }),
	];

	return {
		parseManifest: (_rawYaml: string) => defaultEntries,
		filterManifest: (_manifest: Manifest, _host: HostInfo) => defaultEntries,
		resolveDependencies: (ids: string[], _available: ScriptEntry[]) => ids,
		showNoScripts: (_hostLabel: string): never => {
			throw new Error("showNoScripts called");
		},
		showMainMenu: async (_groups: string[]) => "individual",
		showIndividualSelect: async (_scripts: ScriptEntry[]) => ["a"],
		existsSync: (_path: string) => false,
		homedir: () => "/home/test",
		log: {
			error: (_message: string) => {},
		},
		exit: (_code: number): never => {
			throw new Error(`exit:${_code}`);
		},
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Empty filtered list → showNoScripts
// ---------------------------------------------------------------------------

describe("empty filtered list", () => {
	it("calls showNoScripts when no scripts match the host", async () => {
		let noScriptsCalled = false;
		const deps = makeDeps({
			filterManifest: () => [],
			showNoScripts: (_label: string): never => {
				noScriptsCalled = true;
				throw new Error("__EXIT__");
			},
		});

		try {
			await runScriptSelection(makeManifestResult(), deps);
		} catch (err) {
			if ((err as Error).message !== "__EXIT__") throw err;
		}

		expect(noScriptsCalled).toBe(true);
	});

	it("does not call showMainMenu when no scripts match", async () => {
		let menuCalled = false;
		const deps = makeDeps({
			filterManifest: () => [],
			showNoScripts: (_label: string): never => {
				throw new Error("__EXIT__");
			},
			showMainMenu: async (_groups: string[]) => {
				menuCalled = true;
				return "individual";
			},
		});

		try {
			await runScriptSelection(makeManifestResult(), deps);
		} catch (err) {
			if ((err as Error).message !== "__EXIT__") throw err;
		}

		expect(menuCalled).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// creates path — installed-status detection
// ---------------------------------------------------------------------------

describe("creates path and installed-status detection", () => {
	it("expands ~ in creates path using homedir()", async () => {
		const checkedPaths: string[] = [];
		const entry = makeEntry({
			id: "a",
			name: "Alpha",
			group: "tools",
			creates: "~/bin/alpha",
		});

		const deps = makeDeps({
			filterManifest: () => [entry],
			existsSync: (path: string) => {
				checkedPaths.push(path);
				return false;
			},
			showMainMenu: async () => "individual",
			showIndividualSelect: async () => ["a"],
		});

		await runScriptSelection(makeManifestResult(), deps);

		expect(checkedPaths).toContain("/home/test/bin/alpha");
	});

	it("marks entry as installed when creates path exists", async () => {
		let capturedScripts: ScriptEntry[] = [];
		const entry = makeEntry({
			id: "a",
			name: "Alpha",
			group: "tools",
			creates: "~/bin/alpha",
		});

		const deps = makeDeps({
			filterManifest: () => [entry],
			existsSync: () => true,
			showMainMenu: async () => "individual",
			showIndividualSelect: async (scripts: ScriptEntry[]) => {
				capturedScripts = scripts;
				return ["a"];
			},
		});

		await runScriptSelection(makeManifestResult(), deps);

		const alpha = capturedScripts.find((s) => s.id === "a");
		expect(alpha?.installed).toBe(true);
	});

	it("marks entry as not installed when creates path does not exist", async () => {
		let capturedScripts: ScriptEntry[] = [];
		const entry = makeEntry({
			id: "a",
			name: "Alpha",
			group: "tools",
			creates: "~/bin/alpha",
		});

		const deps = makeDeps({
			filterManifest: () => [entry],
			existsSync: () => false,
			showMainMenu: async () => "individual",
			showIndividualSelect: async (scripts: ScriptEntry[]) => {
				capturedScripts = scripts;
				return ["a"];
			},
		});

		await runScriptSelection(makeManifestResult(), deps);

		const alpha = capturedScripts.find((s) => s.id === "a");
		expect(alpha?.installed).toBe(false);
	});

	it("installedIds contains IDs of entries whose creates path exists", async () => {
		const entryA = makeEntry({
			id: "a",
			name: "Alpha",
			group: "tools",
			creates: "~/bin/alpha",
		});
		const entryB = makeEntry({
			id: "b",
			name: "Beta",
			group: "tools",
			creates: "~/bin/beta",
		});

		const deps = makeDeps({
			filterManifest: () => [entryA, entryB],
			existsSync: (path: string) => path === "/home/test/bin/alpha",
			showMainMenu: async () => "individual",
			showIndividualSelect: async () => ["a", "b"],
		});

		const result = await runScriptSelection(makeManifestResult(), deps);

		expect(result.installedIds.has("a")).toBe(true);
		expect(result.installedIds.has("b")).toBe(false);
	});

	it("installedIds is empty when no entry has a creates field", async () => {
		const entry = makeEntry({ id: "a", name: "Alpha", group: "tools" });
		// no creates field

		const deps = makeDeps({
			filterManifest: () => [entry],
			showMainMenu: async () => "individual",
			showIndividualSelect: async () => ["a"],
		});

		const result = await runScriptSelection(makeManifestResult(), deps);

		expect(result.installedIds.size).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// Group selection
// ---------------------------------------------------------------------------

describe("group selection", () => {
	it("builds group list from filtered entries (only groups with at least one entry)", async () => {
		let capturedGroups: string[] = [];
		const entries = [
			makeEntry({ id: "a", name: "Alpha", group: "tools" }),
			makeEntry({ id: "b", name: "Beta", group: "dev" }),
			makeEntry({ id: "c", name: "Gamma", group: "tools" }),
		];

		const deps = makeDeps({
			filterManifest: () => entries,
			showMainMenu: async (groups: string[]) => {
				capturedGroups = groups;
				return "tools";
			},
			showIndividualSelect: async () => [],
			resolveDependencies: (ids: string[]) => ids,
		});

		await runScriptSelection(makeManifestResult(), deps);

		expect(capturedGroups).toContain("tools");
		expect(capturedGroups).toContain("dev");
		// Deduplicated — 'tools' appears only once
		expect(capturedGroups.filter((g) => g === "tools")).toHaveLength(1);
	});

	it("group selection returns only non-installed scripts in that group", async () => {
		const entryA = makeEntry({
			id: "a",
			name: "Alpha",
			group: "tools",
			creates: "~/bin/alpha",
		});
		const entryB = makeEntry({ id: "b", name: "Beta", group: "tools" });
		const entryC = makeEntry({ id: "c", name: "Gamma", group: "dev" });

		let resolvedIds: string[] = [];
		const deps = makeDeps({
			filterManifest: () => [entryA, entryB, entryC],
			existsSync: (path: string) => path === "/home/test/bin/alpha",
			showMainMenu: async () => "tools",
			resolveDependencies: (ids: string[], _available: ScriptEntry[]) => {
				resolvedIds = ids;
				return ids;
			},
		});

		await runScriptSelection(makeManifestResult(), deps);

		// Only non-installed entries in the "tools" group
		expect(resolvedIds).toContain("b");
		expect(resolvedIds).not.toContain("a"); // installed
		expect(resolvedIds).not.toContain("c"); // wrong group
	});

	it("group selection adds transitive deps via resolveDependencies", async () => {
		const entryA = makeEntry({
			id: "a",
			name: "Alpha",
			group: "tools",
			dependencies: ["b"],
		});
		const entryB = makeEntry({ id: "b", name: "Beta", group: "tools" });

		let resolvedInput: string[] = [];
		const deps = makeDeps({
			filterManifest: () => [entryA, entryB],
			showMainMenu: async () => "tools",
			resolveDependencies: (ids: string[], _available: ScriptEntry[]) => {
				resolvedInput = ids;
				return ["b", "a"]; // topological order
			},
		});

		const result = await runScriptSelection(makeManifestResult(), deps);

		expect(resolvedInput).toContain("a");
		// Returned orderedScripts must be in resolved order
		expect(result.orderedScripts.map((s) => s.id)).toEqual(["b", "a"]);
	});
});

// ---------------------------------------------------------------------------
// Individual selection
// ---------------------------------------------------------------------------

describe("individual selection", () => {
	it("calls showIndividualSelect when 'individual' is returned from main menu", async () => {
		let individualCalled = false;
		const entries = [makeEntry({ id: "a", name: "Alpha", group: "tools" })];

		const deps = makeDeps({
			filterManifest: () => entries,
			showMainMenu: async () => "individual",
			showIndividualSelect: async (_scripts: ScriptEntry[]) => {
				individualCalled = true;
				return ["a"];
			},
		});

		await runScriptSelection(makeManifestResult(), deps);

		expect(individualCalled).toBe(true);
	});

	it("individual selection returns user-picked scripts", async () => {
		const entries = [
			makeEntry({ id: "a", name: "Alpha", group: "tools" }),
			makeEntry({ id: "b", name: "Beta", group: "tools" }),
			makeEntry({ id: "c", name: "Gamma", group: "dev" }),
		];

		const deps = makeDeps({
			filterManifest: () => entries,
			showMainMenu: async () => "individual",
			showIndividualSelect: async () => ["a", "c"],
			resolveDependencies: (ids: string[]) => ids,
		});

		const result = await runScriptSelection(makeManifestResult(), deps);

		expect(result.orderedScripts.map((s) => s.id)).toEqual(["a", "c"]);
	});

	it("individual selection allows re-selecting installed scripts", async () => {
		const entry = makeEntry({
			id: "a",
			name: "Alpha",
			group: "tools",
			creates: "~/bin/alpha",
		});

		const deps = makeDeps({
			filterManifest: () => [entry],
			existsSync: () => true,
			showMainMenu: async () => "individual",
			showIndividualSelect: async () => ["a"],
			resolveDependencies: (ids: string[]) => ids,
		});

		const result = await runScriptSelection(makeManifestResult(), deps);

		// Installed script can still be selected and returned
		expect(result.orderedScripts.map((s) => s.id)).toContain("a");
	});
});

// ---------------------------------------------------------------------------
// Error handling — MissingDependencyError
// ---------------------------------------------------------------------------

describe("error handling", () => {
	it("calls log.error and exit(1) on MissingDependencyError", async () => {
		let errorMessage: string | undefined;
		let exitCode: number | undefined;

		const deps = makeDeps({
			showMainMenu: async () => "individual",
			showIndividualSelect: async () => ["a"],
			resolveDependencies: () => {
				throw new MissingDependencyError("Dependency not found");
			},
			log: {
				error: (message: string) => {
					errorMessage = message;
				},
			},
			exit: (code: number): never => {
				exitCode = code;
				throw new Error(`exit:${code}`);
			},
		});

		try {
			await runScriptSelection(makeManifestResult(), deps);
		} catch (err) {
			if (!(err as Error).message.startsWith("exit:")) throw err;
		}

		expect(errorMessage).toContain("Dependency not found");
		expect(exitCode).toBe(1);
	});

	it("calls log.error and exit(1) on CircularDependencyError", async () => {
		let errorMessage: string | undefined;
		let exitCode: number | undefined;

		const deps = makeDeps({
			showMainMenu: async () => "individual",
			showIndividualSelect: async () => ["a"],
			resolveDependencies: () => {
				throw new CircularDependencyError(
					"Circular dependency detected: A → B → A",
				);
			},
			log: {
				error: (message: string) => {
					errorMessage = message;
				},
			},
			exit: (code: number): never => {
				exitCode = code;
				throw new Error(`exit:${code}`);
			},
		});

		try {
			await runScriptSelection(makeManifestResult(), deps);
		} catch (err) {
			if (!(err as Error).message.startsWith("exit:")) throw err;
		}

		expect(errorMessage).toContain("Circular dependency detected");
		expect(exitCode).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// Return value shape
// ---------------------------------------------------------------------------

describe("return value", () => {
	it("always returns inputs as an empty Map", async () => {
		const deps = makeDeps({
			showMainMenu: async () => "individual",
			showIndividualSelect: async () => ["a"],
		});

		const result = await runScriptSelection(makeManifestResult(), deps);

		expect(result.inputs).toBeInstanceOf(Map);
		expect(result.inputs.size).toBe(0);
	});

	it("orderedScripts contains full ScriptEntry objects in resolved order", async () => {
		const entryA = makeEntry({ id: "a", name: "Alpha", group: "tools" });
		const entryB = makeEntry({ id: "b", name: "Beta", group: "tools" });

		const deps = makeDeps({
			filterManifest: () => [entryA, entryB],
			showMainMenu: async () => "individual",
			showIndividualSelect: async () => ["b", "a"],
			resolveDependencies: (_ids: string[]) => ["b", "a"],
		});

		const result = await runScriptSelection(makeManifestResult(), deps);

		expect(result.orderedScripts).toHaveLength(2);
		expect(result.orderedScripts[0]?.id).toBe("b");
		expect(result.orderedScripts[1]?.id).toBe("a");
	});
});
