import { describe, expect, it } from "bun:test";
import type { ApplyUpdateHandlerDeps } from "./applyUpdateHandler.js";
import { handleApplyUpdate } from "./applyUpdateHandler.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

interface TestState {
	exitCode: number | null;
	spawnedArgs: string[];
}

function makeDeps(overrides: Partial<ApplyUpdateHandlerDeps> = {}): {
	deps: ApplyUpdateHandlerDeps;
	state: TestState;
} {
	const state: TestState = {
		exitCode: null,
		spawnedArgs: [],
	};

	const deps: ApplyUpdateHandlerDeps = {
		rename: async (_src, _dest) => {},
		spawn: (cmd, args) => {
			state.spawnedArgs = [cmd, ...args];
			return { exited: Promise.resolve(0) };
		},
		exit: (code) => {
			state.exitCode = code;
			throw new Error(`process.exit(${code})`);
		},
		execPath: "/new/path/scriptor",
		...overrides,
	};

	return { deps, state };
}

// ---------------------------------------------------------------------------
// handleApplyUpdate
// ---------------------------------------------------------------------------

describe("handleApplyUpdate — moves binary then relaunches", () => {
	it("calls rename to move the new binary over the old path", async () => {
		const renames: Array<{ src: string; dest: string }> = [];
		const { deps } = makeDeps({
			rename: async (src, dest) => {
				renames.push({ src, dest });
			},
		});

		try {
			await handleApplyUpdate("/old/path/scriptor", deps);
		} catch {
			// process.exit throws in tests
		}

		expect(renames).toHaveLength(1);
		// biome-ignore lint/style/noNonNullAssertion: length asserted above
		expect(renames[0]!.src).toBe("/new/path/scriptor");
		// biome-ignore lint/style/noNonNullAssertion: length asserted above
		expect(renames[0]!.dest).toBe("/old/path/scriptor");
	});

	it("spawns the old path (which is now the updated binary)", async () => {
		const { deps, state } = makeDeps();

		try {
			await handleApplyUpdate("/old/path/scriptor", deps);
		} catch {
			// process.exit throws in tests
		}

		expect(state.spawnedArgs[0]).toBe("/old/path/scriptor");
	});

	it("calls process.exit(0) after spawning", async () => {
		const { deps, state } = makeDeps();

		try {
			await handleApplyUpdate("/old/path/scriptor", deps);
		} catch (err) {
			expect((err as Error).message).toContain("process.exit(0)");
		}

		expect(state.exitCode).toBe(0);
	});

	it("uses execPath as the source for the rename", async () => {
		const renames: Array<{ src: string; dest: string }> = [];
		const { deps } = makeDeps({
			execPath: "/custom/exec/path",
			rename: async (src, dest) => {
				renames.push({ src, dest });
			},
		});

		try {
			await handleApplyUpdate("/somewhere/old", deps);
		} catch {
			// process.exit throws in tests
		}

		// biome-ignore lint/style/noNonNullAssertion: rename was called, so index 0 exists
		expect(renames[0]!.src).toBe("/custom/exec/path");
	});
});
