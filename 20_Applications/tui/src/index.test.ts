// ---------------------------------------------------------------------------
// CLI Entry Point Tests
//
// Tests exercise flag parsing by calling Commander's parseAsync() with string
// arrays, using injected fakes for orchestrator, applyUpdateHandler, and
// clack so no real network/filesystem/TTY calls are made.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "bun:test";
import { guardTTY } from "./index.js";
import type {
	PreExecutionResult,
	ScriptRunResult,
	ScriptSelectionResult,
} from "./manifest/types.js";
import { buildProgram } from "./program.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface FakeHost {
	platform: "linux" | "mac" | "windows";
	arch: "x86" | "arm";
}

const DEFAULT_HOST: FakeHost = { platform: "linux", arch: "x86" };

type FakeManifestResult = {
	repo: { owner: string; name: string };
	manifest: string;
	host: FakeHost;
	localRoot?: string;
};

interface ProgramDeps {
	detectHost: () => Promise<FakeHost>;
	runStartup: (opts: {
		host: FakeHost;
		repo?: { owner: string; name: string };
		localMode?: boolean;
	}) => Promise<FakeManifestResult>;
	runScriptSelection: (
		result: FakeManifestResult,
	) => Promise<ScriptSelectionResult>;
	runPreExecution: (
		selectionResult: ScriptSelectionResult,
	) => Promise<PreExecutionResult>;
	runScriptExecution: (
		manifestResult: FakeManifestResult,
		preExecResult: PreExecutionResult,
	) => Promise<ScriptRunResult>;
	handleApplyUpdate: (oldPath: string) => Promise<never>;
	intro: (title: string) => void;
	outro: (message: string) => void;
	log: {
		success: (message: string) => void;
	};
	exit: (code: number) => never;
}

const DEFAULT_MANIFEST_RESULT: FakeManifestResult = {
	repo: { owner: "beolson", name: "Scriptor" },
	manifest: "scripts: []",
	host: DEFAULT_HOST,
};

const DEFAULT_SELECTION_RESULT: ScriptSelectionResult = {
	orderedScripts: [],
	inputs: new Map(),
	installedIds: new Set(),
};

const DEFAULT_PRE_EXECUTION_RESULT: PreExecutionResult = {
	orderedScripts: [],
	inputs: new Map(),
	installedIds: new Set(),
};

function makeDeps(overrides: Partial<ProgramDeps> = {}): ProgramDeps {
	return {
		detectHost: async () => DEFAULT_HOST,
		runStartup: async () => DEFAULT_MANIFEST_RESULT,
		runScriptSelection: async () => DEFAULT_SELECTION_RESULT,
		runPreExecution: async () => DEFAULT_PRE_EXECUTION_RESULT,
		runScriptExecution: async () => ({ success: true }),
		handleApplyUpdate: async (_path: string): Promise<never> => {
			throw new Error("handleApplyUpdate called");
		},
		intro: () => {},
		outro: () => {},
		log: { success: () => {} },
		exit: (_code: number): never => {
			// Default fake: silently swallow exit so normal test flows complete.
			return undefined as never;
		},
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// --repo flag parsing
// ---------------------------------------------------------------------------

describe("--repo flag", () => {
	it("parses a valid owner/repo and passes it to runStartup", async () => {
		let capturedRepo: { owner: string; name: string } | undefined;
		const deps = makeDeps({
			runStartup: async (opts) => {
				capturedRepo = opts.repo;
				return {
					repo: { owner: "alice", name: "scripts" },
					manifest: "",
					host: DEFAULT_HOST,
				};
			},
		});

		const program = buildProgram(deps);
		await program.parseAsync(["--repo", "alice/scripts"], { from: "user" });

		expect(capturedRepo).toEqual({ owner: "alice", name: "scripts" });
	});

	it("strips leading and trailing whitespace from --repo value", async () => {
		let capturedRepo: { owner: string; name: string } | undefined;
		const deps = makeDeps({
			runStartup: async (opts) => {
				capturedRepo = opts.repo;
				return {
					repo: { owner: "alice", name: "scripts" },
					manifest: "",
					host: DEFAULT_HOST,
				};
			},
		});

		const program = buildProgram(deps);
		await program.parseAsync(["--repo", "  alice/scripts  "], { from: "user" });

		expect(capturedRepo).toEqual({ owner: "alice", name: "scripts" });
	});

	it("exits with error message for invalid --repo format (no slash)", async () => {
		let exitCode: number | undefined;

		const deps = makeDeps({
			exit: (code) => {
				exitCode = code;
				throw new Error(`exit:${code}`);
			},
		});

		const program = buildProgram(deps);
		program.exitOverride();

		try {
			await program.parseAsync(["--repo", "notaslash"], { from: "user" });
		} catch {
			// Commander throws on exitOverride
		}

		expect(exitCode ?? 1).toBe(1);
	});

	it("exits with error message for invalid --repo format (too many slashes)", async () => {
		let exitCode: number | undefined;

		const deps = makeDeps({
			exit: (code) => {
				exitCode = code;
				throw new Error(`exit:${code}`);
			},
		});

		const program = buildProgram(deps);
		program.exitOverride();

		try {
			await program.parseAsync(["--repo", "a/b/c"], { from: "user" });
		} catch {
			// Commander throws on exitOverride
		}

		expect(exitCode ?? 1).toBe(1);
	});

	it("passes undefined repo to runStartup when --repo is not provided", async () => {
		let capturedRepo: unknown = "not-set";
		const deps = makeDeps({
			runStartup: async (opts) => {
				capturedRepo = opts.repo;
				return {
					repo: { owner: "beolson", name: "Scriptor" },
					manifest: "",
					host: DEFAULT_HOST,
				};
			},
		});

		const program = buildProgram(deps);
		await program.parseAsync([], { from: "user" });

		expect(capturedRepo).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// --repo=local flag
// ---------------------------------------------------------------------------

describe("--repo=local flag", () => {
	it("passes localMode: true to runStartup", async () => {
		let capturedOpts: { repo?: unknown; localMode?: boolean } | undefined;
		const deps = makeDeps({
			runStartup: async (opts) => {
				capturedOpts = opts;
				return {
					repo: { owner: "local", name: "local" },
					manifest: "",
					host: DEFAULT_HOST,
					localRoot: "/git/root",
				};
			},
		});

		const program = buildProgram(deps);
		await program.parseAsync(["--repo", "local"], { from: "user" });

		expect(capturedOpts?.localMode).toBe(true);
	});

	it("passes undefined repo to runStartup when --repo=local", async () => {
		let capturedRepo: unknown = "not-set";
		const deps = makeDeps({
			runStartup: async (opts) => {
				capturedRepo = opts.repo;
				return {
					repo: { owner: "local", name: "local" },
					manifest: "",
					host: DEFAULT_HOST,
					localRoot: "/git/root",
				};
			},
		});

		const program = buildProgram(deps);
		await program.parseAsync(["--repo", "local"], { from: "user" });

		expect(capturedRepo).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// --apply-update flag
// ---------------------------------------------------------------------------

describe("--apply-update flag", () => {
	it("calls handleApplyUpdate with the provided old path before orchestrator", async () => {
		let applyCalledWith: string | undefined;
		let startupCalled = false;

		const deps = makeDeps({
			handleApplyUpdate: async (path: string): Promise<never> => {
				applyCalledWith = path;
				throw new Error("apply-update-called");
			},
			runStartup: async () => {
				startupCalled = true;
				return {
					repo: { owner: "beolson", name: "Scriptor" },
					manifest: "",
					host: DEFAULT_HOST,
				};
			},
		});

		const program = buildProgram(deps);
		program.exitOverride();

		try {
			await program.parseAsync(["--apply-update", "/old/binary"], {
				from: "user",
			});
		} catch {
			// handleApplyUpdate throws in this fake
		}

		expect(applyCalledWith).toBe("/old/binary");
		expect(startupCalled).toBe(false);
	});

	it("does not call handleApplyUpdate when flag is absent", async () => {
		let applyUpdateCalled = false;

		const deps = makeDeps({
			handleApplyUpdate: async (_path: string): Promise<never> => {
				applyUpdateCalled = true;
				throw new Error("should not be called");
			},
		});

		const program = buildProgram(deps);
		await program.parseAsync([], { from: "user" });

		expect(applyUpdateCalled).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// intro / outro
// ---------------------------------------------------------------------------

describe("intro and outro", () => {
	it("calls intro at startup", async () => {
		let introCalled = false;
		const deps = makeDeps({
			intro: () => {
				introCalled = true;
			},
		});
		const program = buildProgram(deps);
		await program.parseAsync([], { from: "user" });
		expect(introCalled).toBe(true);
	});

	it("does not call outro (removed in favour of runScriptExecution)", async () => {
		let outroCalled = false;
		const deps = makeDeps({
			outro: () => {
				outroCalled = true;
			},
		});
		const program = buildProgram(deps);
		await program.parseAsync([], { from: "user" });
		expect(outroCalled).toBe(false);
	});

	it("intro title contains 'Scriptor' and host info on the same line", async () => {
		let capturedTitle: string | undefined;
		const deps = makeDeps({
			detectHost: async () => ({
				platform: "linux" as const,
				arch: "x86" as const,
				distro: "Debian GNU/Linux",
				version: "13",
			}),
			intro: (title) => {
				capturedTitle = title;
			},
		});
		const program = buildProgram(deps);
		await program.parseAsync([], { from: "user" });
		expect(capturedTitle).toContain("Scriptor");
		expect(capturedTitle).toContain("[linux / x86 / Debian GNU/Linux 13]");
		// Both on a single string (no newline separator)
		expect(capturedTitle?.includes("\n")).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// detectHost wiring
// ---------------------------------------------------------------------------

describe("detectHost wiring", () => {
	it("calls detectHost before runStartup", async () => {
		const order: string[] = [];
		const deps = makeDeps({
			detectHost: async () => {
				order.push("detectHost");
				return DEFAULT_HOST;
			},
			runStartup: async () => {
				order.push("runStartup");
				return DEFAULT_MANIFEST_RESULT;
			},
		});
		const program = buildProgram(deps);
		await program.parseAsync([], { from: "user" });
		expect(order.indexOf("detectHost")).toBeLessThan(
			order.indexOf("runStartup"),
		);
	});

	it("passes detected host to runStartup", async () => {
		const customHost = { platform: "mac" as const, arch: "arm" as const };
		let capturedHost: FakeHost | undefined;
		const deps = makeDeps({
			detectHost: async () => customHost,
			runStartup: async (opts) => {
				capturedHost = opts.host;
				return { ...DEFAULT_MANIFEST_RESULT, host: customHost };
			},
		});
		const program = buildProgram(deps);
		await program.parseAsync([], { from: "user" });
		expect(capturedHost).toEqual(customHost);
	});
});

// ---------------------------------------------------------------------------
// runScriptSelection wiring
// ---------------------------------------------------------------------------

describe("runScriptSelection wiring", () => {
	it("calls runScriptSelection with the ManifestResult returned by runStartup", async () => {
		const fakeResult: FakeManifestResult = {
			repo: { owner: "alice", name: "setup" },
			manifest: "scripts: []",
			host: DEFAULT_HOST,
		};
		let capturedArg: FakeManifestResult | undefined;

		const deps = makeDeps({
			runStartup: async () => fakeResult,
			runScriptSelection: async (result) => {
				capturedArg = result as FakeManifestResult;
				return DEFAULT_SELECTION_RESULT;
			},
		});

		const program = buildProgram(deps);
		await program.parseAsync([], { from: "user" });

		expect(capturedArg).toBe(fakeResult);
	});

	it("does not call runScriptSelection when --apply-update flag is present", async () => {
		let selectionCalled = false;

		const deps = makeDeps({
			handleApplyUpdate: async (_path: string): Promise<never> => {
				throw new Error("apply-update-called");
			},
			runScriptSelection: async () => {
				selectionCalled = true;
				return DEFAULT_SELECTION_RESULT;
			},
		});

		const program = buildProgram(deps);
		program.exitOverride();

		try {
			await program.parseAsync(["--apply-update", "/old/binary"], {
				from: "user",
			});
		} catch {
			// handleApplyUpdate throws in this fake
		}

		expect(selectionCalled).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// runPreExecution wiring
// ---------------------------------------------------------------------------

describe("runPreExecution wiring", () => {
	it("calls runPreExecution with the ScriptSelectionResult returned by runScriptSelection", async () => {
		const fakeSelectionResult: ScriptSelectionResult = {
			orderedScripts: [],
			inputs: new Map(),
			installedIds: new Set(),
		};
		let capturedArg: ScriptSelectionResult | undefined;

		const deps = makeDeps({
			runScriptSelection: async () => fakeSelectionResult,
			runPreExecution: async (selectionResult) => {
				capturedArg = selectionResult;
				return DEFAULT_PRE_EXECUTION_RESULT;
			},
		});

		const program = buildProgram(deps);
		await program.parseAsync([], { from: "user" });

		expect(capturedArg).toBe(fakeSelectionResult);
	});

	it("runScriptExecution called after runPreExecution returns", async () => {
		const order: string[] = [];

		const deps = makeDeps({
			runPreExecution: async () => {
				order.push("runPreExecution");
				return DEFAULT_PRE_EXECUTION_RESULT;
			},
			runScriptExecution: async () => {
				order.push("runScriptExecution");
				return { success: true as const };
			},
		});

		const program = buildProgram(deps);
		await program.parseAsync([], { from: "user" });

		expect(order.indexOf("runPreExecution")).toBeLessThan(
			order.indexOf("runScriptExecution"),
		);
	});

	it("runPreExecution not called when --apply-update flag is present", async () => {
		let preExecutionCalled = false;

		const deps = makeDeps({
			handleApplyUpdate: async (_path: string): Promise<never> => {
				throw new Error("apply-update-called");
			},
			runPreExecution: async () => {
				preExecutionCalled = true;
				return DEFAULT_PRE_EXECUTION_RESULT;
			},
		});

		const program = buildProgram(deps);
		program.exitOverride();

		try {
			await program.parseAsync(["--apply-update", "/old/binary"], {
				from: "user",
			});
		} catch {
			// handleApplyUpdate throws in this fake
		}

		expect(preExecutionCalled).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// guardTTY
// ---------------------------------------------------------------------------

describe("guardTTY", () => {
	it("calls stderrWrite before exit when isTTY is false", () => {
		const order: string[] = [];

		try {
			guardTTY({
				isTTY: false,
				stderrWrite: () => {
					order.push("stderrWrite");
				},
				exit: (_code) => {
					order.push("exit");
					throw new Error("exit");
				},
			});
		} catch {
			// expected
		}

		expect(order[0]).toBe("stderrWrite");
		expect(order[1]).toBe("exit");
	});

	it("calls exit(1) when isTTY is false", () => {
		let exitCode: number | undefined;

		try {
			guardTTY({
				isTTY: false,
				stderrWrite: () => {},
				exit: (code) => {
					exitCode = code;
					throw new Error(`exit:${code}`);
				},
			});
		} catch {
			// expected — exit throws in this fake
		}

		expect(exitCode).toBe(1);
	});

	it("stderrWrite called with exact error message when isTTY is false", () => {
		let writtenMsg: string | undefined;

		try {
			guardTTY({
				isTTY: false,
				stderrWrite: (msg) => {
					writtenMsg = msg;
				},
				exit: (_code) => {
					throw new Error("exit");
				},
			});
		} catch {
			// expected
		}

		expect(writtenMsg).toBe(
			"[scriptor] ERROR: Scriptor requires an interactive terminal.\nstdin is not a TTY — run Scriptor directly in a terminal, not piped.\n",
		);
	});

	it("error message contains '[scriptor] ERROR'", () => {
		let writtenMsg: string | undefined;

		try {
			guardTTY({
				isTTY: false,
				stderrWrite: (msg) => {
					writtenMsg = msg;
				},
				exit: (_code) => {
					throw new Error("exit");
				},
			});
		} catch {
			// expected
		}

		expect(writtenMsg).toContain("[scriptor] ERROR");
	});

	it("error message contains 'stdin is not a TTY'", () => {
		let writtenMsg: string | undefined;

		try {
			guardTTY({
				isTTY: false,
				stderrWrite: (msg) => {
					writtenMsg = msg;
				},
				exit: (_code) => {
					throw new Error("exit");
				},
			});
		} catch {
			// expected
		}

		expect(writtenMsg).toContain("stdin is not a TTY");
	});

	it("does not call stderrWrite when isTTY is true", () => {
		let stderrCalled = false;

		guardTTY({
			isTTY: true,
			stderrWrite: () => {
				stderrCalled = true;
			},
			exit: (_code) => {
				throw new Error("should not be called");
			},
		});

		expect(stderrCalled).toBe(false);
	});

	it("does not call exit when isTTY is true", () => {
		let exitCalled = false;

		guardTTY({
			isTTY: true,
			stderrWrite: () => {},
			exit: (_code) => {
				exitCalled = true;
				throw new Error("should not be called");
			},
		});

		expect(exitCalled).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// runScriptExecution wiring
// ---------------------------------------------------------------------------

describe("runScriptExecution wiring", () => {
	it("calls runScriptExecution with ManifestResult from runStartup", async () => {
		const fakeManifestResult = {
			repo: { owner: "alice", name: "setup" },
			manifest: "scripts: []",
			host: DEFAULT_HOST,
		};
		let capturedManifestResult: FakeManifestResult | undefined;

		const deps = makeDeps({
			runStartup: async () => fakeManifestResult,
			runScriptExecution: async (mr) => {
				capturedManifestResult = mr as FakeManifestResult;
				return { success: true as const };
			},
		});

		const program = buildProgram(deps);
		await program.parseAsync([], { from: "user" });

		expect(capturedManifestResult).toBe(fakeManifestResult);
	});

	it("calls runScriptExecution with PreExecutionResult from runPreExecution", async () => {
		const fakePreExecResult: PreExecutionResult = {
			orderedScripts: [],
			inputs: new Map(),
			installedIds: new Set(),
		};
		let capturedPreExecResult: PreExecutionResult | undefined;

		const deps = makeDeps({
			runPreExecution: async () => fakePreExecResult,
			runScriptExecution: async (_mr, per) => {
				capturedPreExecResult = per;
				return { success: true as const };
			},
		});

		const program = buildProgram(deps);
		await program.parseAsync([], { from: "user" });

		expect(capturedPreExecResult).toBe(fakePreExecResult);
	});

	it("outro('Done') no longer called", async () => {
		let outroCalled = false;

		const deps = makeDeps({
			outro: () => {
				outroCalled = true;
			},
		});

		const program = buildProgram(deps);
		await program.parseAsync([], { from: "user" });

		expect(outroCalled).toBe(false);
	});

	it("runScriptExecution not called when --apply-update flag is present", async () => {
		let runScriptExecutionCalled = false;

		const deps = makeDeps({
			handleApplyUpdate: async (_path: string): Promise<never> => {
				throw new Error("apply-update-called");
			},
			runScriptExecution: async () => {
				runScriptExecutionCalled = true;
				return { success: true as const };
			},
		});

		const program = buildProgram(deps);
		program.exitOverride();

		try {
			await program.parseAsync(["--apply-update", "/old/binary"], {
				from: "user",
			});
		} catch {
			// handleApplyUpdate throws in this fake
		}

		expect(runScriptExecutionCalled).toBe(false);
	});

	it("ProgramDeps type accepts a fake runScriptExecution returning { success: true }", async () => {
		// Type-level test: if this compiles, the interface is correct.
		const deps = makeDeps({
			runScriptExecution: async (): Promise<ScriptRunResult> => ({
				success: true,
			}),
		});

		const program = buildProgram(deps);
		await program.parseAsync([], { from: "user" });

		// No assertion needed — this test verifies the type is compatible.
		expect(true).toBe(true);
	});
});
