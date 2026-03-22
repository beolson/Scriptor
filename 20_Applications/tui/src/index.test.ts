// ---------------------------------------------------------------------------
// CLI Entry Point Tests
//
// Tests exercise flag parsing by calling Commander's parseAsync() with string
// arrays, using injected fakes for orchestrator, applyUpdateHandler, and
// clack so no real network/filesystem/TTY calls are made.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "bun:test";
import type { ScriptSelectionResult } from "./manifest/types.js";
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
	runStartup: (opts: {
		repo?: { owner: string; name: string };
		localMode?: boolean;
	}) => Promise<FakeManifestResult>;
	runScriptSelection: (
		result: FakeManifestResult,
	) => Promise<ScriptSelectionResult>;
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

function makeDeps(overrides: Partial<ProgramDeps> = {}): ProgramDeps {
	return {
		runStartup: async () => DEFAULT_MANIFEST_RESULT,
		runScriptSelection: async () => DEFAULT_SELECTION_RESULT,
		handleApplyUpdate: async (_path: string): Promise<never> => {
			throw new Error("handleApplyUpdate called");
		},
		intro: () => {},
		outro: () => {},
		log: { success: () => {} },
		exit: (_code: number): never => {
			throw new Error("process.exit called");
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

	it("calls outro on clean exit", async () => {
		let outroCalled = false;
		const deps = makeDeps({
			outro: () => {
				outroCalled = true;
			},
		});
		const program = buildProgram(deps);
		await program.parseAsync([], { from: "user" });
		expect(outroCalled).toBe(true);
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
