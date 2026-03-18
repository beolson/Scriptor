import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { ScriptEntry } from "../manifest/parseManifest";
import {
	checkSudoCached,
	invalidateSudo,
	needsSudo,
	type SudoDeps,
	startKeepalive,
	validateSudo,
	validateSudoWithPassword,
} from "./sudoManager";

function makeEntry(overrides: Partial<ScriptEntry> = {}): ScriptEntry {
	return {
		id: "test-script",
		name: "Test Script",
		description: "A test script",
		platform: "linux",
		arch: "x86",
		script: "scripts/test.sh",
		dependencies: [],
		inputs: [],
		requires_sudo: false,
		requires_admin: false,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// needsSudo
// ---------------------------------------------------------------------------

describe("needsSudo", () => {
	test("returns false for empty list", () => {
		expect(needsSudo([])).toBe(false);
	});

	test("returns false when no scripts require sudo", () => {
		const scripts = [makeEntry({ id: "a" }), makeEntry({ id: "b" })];
		expect(needsSudo(scripts)).toBe(false);
	});

	test("returns true when at least one script requires sudo", () => {
		const scripts = [
			makeEntry({ id: "a" }),
			makeEntry({ id: "b", requires_sudo: true }),
		];
		expect(needsSudo(scripts)).toBe(true);
	});

	test("returns true when all scripts require sudo", () => {
		const scripts = [
			makeEntry({ id: "a", requires_sudo: true }),
			makeEntry({ id: "b", requires_sudo: true }),
		];
		expect(needsSudo(scripts)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// validateSudo
// ---------------------------------------------------------------------------

describe("validateSudo", () => {
	test("returns ok: true when sudo -v exits 0", async () => {
		const deps: SudoDeps = {
			spawnSync: () => ({ exitCode: 0 }),
			spawnBackground: () => {},
		};
		const result = await validateSudo(deps);
		expect(result).toEqual({ ok: true });
	});

	test("returns ok: false when sudo -v exits non-zero", async () => {
		const deps: SudoDeps = {
			spawnSync: () => ({ exitCode: 1 }),
			spawnBackground: () => {},
		};
		const result = await validateSudo(deps);
		expect(result).toEqual({ ok: false, reason: "sudo authentication failed" });
	});

	test("returns ok: false when spawn throws", async () => {
		const deps: SudoDeps = {
			spawnSync: () => {
				throw new Error("command not found");
			},
			spawnBackground: () => {},
		};
		const result = await validateSudo(deps);
		expect(result).toEqual({ ok: false, reason: "command not found" });
	});

	test("passes correct command to spawnSync", async () => {
		let capturedCmd: string[] = [];
		const deps: SudoDeps = {
			spawnSync: (cmd) => {
				capturedCmd = cmd;
				return { exitCode: 0 };
			},
			spawnBackground: () => {},
		};
		await validateSudo(deps);
		expect(capturedCmd).toEqual(["sudo", "-v"]);
	});
});

// ---------------------------------------------------------------------------
// checkSudoCached
// ---------------------------------------------------------------------------

describe("checkSudoCached", () => {
	test("returns true when sudo -n -v exits 0", async () => {
		const deps: SudoDeps = {
			spawnSync: () => ({ exitCode: 0 }),
			spawnBackground: () => {},
			spawnAsync: async () => ({ exitCode: 0 }),
		};
		expect(await checkSudoCached(deps)).toBe(true);
	});

	test("returns false when sudo -n -v exits non-zero", async () => {
		const deps: SudoDeps = {
			spawnSync: () => ({ exitCode: 0 }),
			spawnBackground: () => {},
			spawnAsync: async () => ({ exitCode: 1 }),
		};
		expect(await checkSudoCached(deps)).toBe(false);
	});

	test("returns false when spawnAsync throws", async () => {
		const deps: SudoDeps = {
			spawnSync: () => ({ exitCode: 0 }),
			spawnBackground: () => {},
			spawnAsync: async () => {
				throw new Error("spawn failed");
			},
		};
		expect(await checkSudoCached(deps)).toBe(false);
	});

	test("passes correct command to spawnAsync", async () => {
		let capturedCmd: string[] = [];
		const deps: SudoDeps = {
			spawnSync: () => ({ exitCode: 0 }),
			spawnBackground: () => {},
			spawnAsync: async (cmd) => {
				capturedCmd = cmd;
				return { exitCode: 0 };
			},
		};
		await checkSudoCached(deps);
		expect(capturedCmd).toEqual(["sudo", "-n", "-v"]);
	});
});

// ---------------------------------------------------------------------------
// validateSudoWithPassword
// ---------------------------------------------------------------------------

describe("validateSudoWithPassword", () => {
	test("returns ok: true when sudo -S -v exits 0", async () => {
		const deps: SudoDeps = {
			spawnSync: () => ({ exitCode: 0 }),
			spawnBackground: () => {},
			spawnWithStdin: async () => ({ exitCode: 0 }),
		};
		const result = await validateSudoWithPassword("secret", deps);
		expect(result).toEqual({ ok: true });
	});

	test("returns ok: false when sudo -S -v exits non-zero", async () => {
		const deps: SudoDeps = {
			spawnSync: () => ({ exitCode: 0 }),
			spawnBackground: () => {},
			spawnWithStdin: async () => ({ exitCode: 1 }),
		};
		const result = await validateSudoWithPassword("wrong", deps);
		expect(result).toEqual({ ok: false, reason: "sudo authentication failed" });
	});

	test("returns ok: false when spawnWithStdin throws", async () => {
		const deps: SudoDeps = {
			spawnSync: () => ({ exitCode: 0 }),
			spawnBackground: () => {},
			spawnWithStdin: async () => {
				throw new Error("pipe broken");
			},
		};
		const result = await validateSudoWithPassword("secret", deps);
		expect(result).toEqual({ ok: false, reason: "pipe broken" });
	});

	test("passes correct command to spawnWithStdin", async () => {
		let capturedCmd: string[] = [];
		const deps: SudoDeps = {
			spawnSync: () => ({ exitCode: 0 }),
			spawnBackground: () => {},
			spawnWithStdin: async (cmd) => {
				capturedCmd = cmd;
				return { exitCode: 0 };
			},
		};
		await validateSudoWithPassword("secret", deps);
		expect(capturedCmd).toEqual(["sudo", "-S", "-v"]);
	});

	test("pipes password to spawnWithStdin", async () => {
		let capturedStdin = "";
		const deps: SudoDeps = {
			spawnSync: () => ({ exitCode: 0 }),
			spawnBackground: () => {},
			spawnWithStdin: async (_cmd, stdinData) => {
				capturedStdin = stdinData;
				return { exitCode: 0 };
			},
		};
		await validateSudoWithPassword("myPassword123", deps);
		expect(capturedStdin).toBe("myPassword123");
	});
});

// ---------------------------------------------------------------------------
// invalidateSudo
// ---------------------------------------------------------------------------

describe("invalidateSudo", () => {
	test("spawns sudo -k", async () => {
		let capturedCmd: string[] = [];
		const deps: SudoDeps = {
			spawnSync: () => ({ exitCode: 0 }),
			spawnBackground: () => {},
			spawnAsync: async (cmd) => {
				capturedCmd = cmd;
				return { exitCode: 0 };
			},
		};
		await invalidateSudo(deps);
		expect(capturedCmd).toEqual(["sudo", "-k"]);
	});

	test("resolves without error", async () => {
		const deps: SudoDeps = {
			spawnSync: () => ({ exitCode: 0 }),
			spawnBackground: () => {},
			spawnAsync: async () => ({ exitCode: 0 }),
		};
		await expect(invalidateSudo(deps)).resolves.toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// startKeepalive
// ---------------------------------------------------------------------------

describe("startKeepalive", () => {
	let originalSetInterval: typeof globalThis.setInterval;
	let originalClearInterval: typeof globalThis.clearInterval;

	beforeEach(() => {
		originalSetInterval = globalThis.setInterval;
		originalClearInterval = globalThis.clearInterval;
	});

	afterEach(() => {
		globalThis.setInterval = originalSetInterval;
		globalThis.clearInterval = originalClearInterval;
	});

	test("schedules sudo -v on an interval", () => {
		const calls: string[][] = [];
		const deps: SudoDeps = {
			spawnSync: () => ({ exitCode: 0 }),
			spawnBackground: (cmd) => {
				calls.push(cmd);
			},
		};

		let capturedCallback: (() => void) | null = null;
		let capturedInterval = 0;

		globalThis.setInterval = ((cb: () => void, ms: number) => {
			capturedCallback = cb;
			capturedInterval = ms;
			return 42 as unknown as ReturnType<typeof setInterval>;
		}) as typeof setInterval;

		globalThis.clearInterval = (() => {}) as typeof clearInterval;

		const cleanup = startKeepalive(deps);

		expect(capturedInterval).toBe(4 * 60 * 1000);
		expect(capturedCallback).not.toBeNull();

		// Simulate a tick
		(capturedCallback as (() => void) | null)?.();
		expect(calls).toEqual([["sudo", "-v"]]);

		cleanup();
	});

	test("cleanup stops the interval", () => {
		const deps: SudoDeps = {
			spawnSync: () => ({ exitCode: 0 }),
			spawnBackground: () => {},
		};

		let clearedId: unknown = null;

		globalThis.setInterval = (() => {
			return 99 as unknown as ReturnType<typeof setInterval>;
		}) as typeof setInterval;

		globalThis.clearInterval = ((id: unknown) => {
			clearedId = id;
		}) as typeof clearInterval;

		const cleanup = startKeepalive(deps);
		cleanup();

		expect(clearedId).toBe(99);
	});
});
