// ---------------------------------------------------------------------------
// Execution Orchestrator Tests
//
// Tests exercise `runScriptExecution` with all deps injected as fakes.
// No real processes, filesystems, or TTY calls are made.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "bun:test";
import type {
	PreExecutionResult,
	ScriptEntry,
	ScriptInputs,
	ScriptRunResult,
} from "../manifest/types.js";
import type { ManifestResult } from "../startup/orchestrator.js";
import { runScriptExecution } from "./index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeScript(
	id: string,
	overrides: Partial<ScriptEntry> = {},
): ScriptEntry {
	return {
		id,
		name: `Script ${id}`,
		description: `Description for ${id}`,
		platform: "linux",
		arch: "x86",
		script: `${id}.sh`,
		dependencies: [],
		optional_dependencies: [],
		requires_elevation: false,
		inputs: [],
		...overrides,
	};
}

function makeManifestResult(
	overrides: Partial<ManifestResult> = {},
): ManifestResult {
	return {
		repo: { owner: "test", name: "repo" },
		manifest: "scripts: []",
		host: { platform: "linux", arch: "x86" },
		...overrides,
	};
}

function makePreExecResult(
	overrides: Partial<PreExecutionResult> = {},
): PreExecutionResult {
	return {
		orderedScripts: [],
		inputs: new Map<string, { value: string }>() as ScriptInputs,
		installedIds: new Set<string>(),
		...overrides,
	};
}

interface FakeDeps {
	platform: string;
	showSudoScreen: () => Promise<void>;
	runScripts: (
		scripts: ScriptEntry[],
		inputs: ScriptInputs,
		installedIds: Set<string>,
	) => Promise<ScriptRunResult>;
	readScript: (entry: ScriptEntry) => Promise<string>;
}

function makeDeps(overrides: Partial<FakeDeps> = {}): FakeDeps {
	return {
		platform: "linux",
		showSudoScreen: async () => {},
		runScripts: async () => ({ success: true }),
		readScript: async () => "#!/bin/bash\necho hello",
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// sudo screen wiring
// ---------------------------------------------------------------------------

describe("sudo screen wiring", () => {
	it("calls showSudoScreen before runScripts when Unix + elevation script present", async () => {
		const order: string[] = [];
		const scripts = [makeScript("a", { requires_elevation: true })];
		const preExecResult = makePreExecResult({ orderedScripts: scripts });

		const deps = makeDeps({
			platform: "linux",
			showSudoScreen: async () => {
				order.push("showSudoScreen");
			},
			runScripts: async () => {
				order.push("runScripts");
				return { success: true };
			},
		});

		await runScriptExecution(makeManifestResult(), preExecResult, deps);

		expect(order.indexOf("showSudoScreen")).toBeLessThan(
			order.indexOf("runScripts"),
		);
	});

	it("does not call showSudoScreen when no scripts require elevation (Unix)", async () => {
		let sudoCalled = false;
		const scripts = [makeScript("a", { requires_elevation: false })];
		const preExecResult = makePreExecResult({ orderedScripts: scripts });

		const deps = makeDeps({
			platform: "linux",
			showSudoScreen: async () => {
				sudoCalled = true;
			},
		});

		await runScriptExecution(makeManifestResult(), preExecResult, deps);

		expect(sudoCalled).toBe(false);
	});

	it("does not call showSudoScreen when orderedScripts is empty (Unix)", async () => {
		let sudoCalled = false;
		const preExecResult = makePreExecResult({ orderedScripts: [] });

		const deps = makeDeps({
			platform: "linux",
			showSudoScreen: async () => {
				sudoCalled = true;
			},
		});

		await runScriptExecution(makeManifestResult(), preExecResult, deps);

		expect(sudoCalled).toBe(false);
	});

	it("does not call showSudoScreen on Windows even when elevation script present", async () => {
		let sudoCalled = false;
		const scripts = [makeScript("a", { requires_elevation: true })];
		const preExecResult = makePreExecResult({ orderedScripts: scripts });

		const deps = makeDeps({
			platform: "win32",
			showSudoScreen: async () => {
				sudoCalled = true;
			},
		});

		await runScriptExecution(makeManifestResult(), preExecResult, deps);

		expect(sudoCalled).toBe(false);
	});

	it("calls showSudoScreen exactly once when multiple elevation scripts present", async () => {
		let sudoCallCount = 0;
		const scripts = [
			makeScript("a", { requires_elevation: true }),
			makeScript("b", { requires_elevation: true }),
		];
		const preExecResult = makePreExecResult({ orderedScripts: scripts });

		const deps = makeDeps({
			platform: "linux",
			showSudoScreen: async () => {
				sudoCallCount++;
			},
		});

		await runScriptExecution(makeManifestResult(), preExecResult, deps);

		expect(sudoCallCount).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// runScripts invocation
// ---------------------------------------------------------------------------

describe("runScripts invocation", () => {
	it("calls runScripts with orderedScripts from preExecResult", async () => {
		const scripts = [makeScript("s1"), makeScript("s2")];
		const preExecResult = makePreExecResult({ orderedScripts: scripts });
		let capturedScripts: ScriptEntry[] | undefined;

		const deps = makeDeps({
			runScripts: async (s) => {
				capturedScripts = s;
				return { success: true };
			},
		});

		await runScriptExecution(makeManifestResult(), preExecResult, deps);

		expect(capturedScripts).toBe(scripts);
	});

	it("calls runScripts with inputs from preExecResult", async () => {
		const inputs: ScriptInputs = new Map([["key", { value: "val" }]]);
		const preExecResult = makePreExecResult({ inputs });
		let capturedInputs: ScriptInputs | undefined;

		const deps = makeDeps({
			runScripts: async (_s, i) => {
				capturedInputs = i;
				return { success: true };
			},
		});

		await runScriptExecution(makeManifestResult(), preExecResult, deps);

		expect(capturedInputs).toBe(inputs);
	});

	it("calls runScripts with installedIds from preExecResult", async () => {
		const installedIds = new Set(["script-a", "script-b"]);
		const preExecResult = makePreExecResult({ installedIds });
		let capturedInstalledIds: Set<string> | undefined;

		const deps = makeDeps({
			runScripts: async (_s, _i, ids) => {
				capturedInstalledIds = ids;
				return { success: true };
			},
		});

		await runScriptExecution(makeManifestResult(), preExecResult, deps);

		expect(capturedInstalledIds).toBe(installedIds);
	});

	it("returns result directly from runScripts on success", async () => {
		const expected: ScriptRunResult = {
			success: true,
		};

		const deps = makeDeps({
			runScripts: async () => expected,
		});

		const result = await runScriptExecution(
			makeManifestResult(),
			makePreExecResult(),
			deps,
		);

		expect(result).toBe(expected);
	});

	it("returns result directly from runScripts on failure", async () => {
		const failedScript = makeScript("fail");
		const expected: ScriptRunResult = {
			success: false,
			failedScript,
			exitCode: 1,
		};

		const deps = makeDeps({
			runScripts: async () => expected,
		});

		const result = await runScriptExecution(
			makeManifestResult(),
			makePreExecResult(),
			deps,
		);

		expect(result).toBe(expected);
	});
});

// ---------------------------------------------------------------------------
// return value propagation
// ---------------------------------------------------------------------------

describe("return value propagation", () => {
	it("returns { success: true } when runScripts succeeds", async () => {
		const deps = makeDeps({
			runScripts: async () => ({
				success: true,
			}),
		});

		const result = await runScriptExecution(
			makeManifestResult(),
			makePreExecResult(),
			deps,
		);

		expect(result.success).toBe(true);
	});

	it("returns { success: false, failedScript, exitCode } when runScripts fails", async () => {
		const failedScript = makeScript("broken");
		const deps = makeDeps({
			runScripts: async () => ({
				success: false,
				failedScript,
				exitCode: 2,
			}),
		});

		const result = await runScriptExecution(
			makeManifestResult(),
			makePreExecResult(),
			deps,
		);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.failedScript).toBe(failedScript);
			expect(result.exitCode).toBe(2);
		}
	});
});

// ---------------------------------------------------------------------------
// macOS platform
// ---------------------------------------------------------------------------

describe("macOS platform", () => {
	it("calls showSudoScreen on macOS (darwin) when elevation script present", async () => {
		let sudoCalled = false;
		const scripts = [makeScript("a", { requires_elevation: true })];
		const preExecResult = makePreExecResult({ orderedScripts: scripts });

		const deps = makeDeps({
			platform: "darwin",
			showSudoScreen: async () => {
				sudoCalled = true;
			},
		});

		await runScriptExecution(makeManifestResult(), preExecResult, deps);

		expect(sudoCalled).toBe(true);
	});
});
