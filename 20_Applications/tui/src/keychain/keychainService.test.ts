import { describe, expect, it } from "bun:test";
import type { KeychainDeps } from "./keychainService.js";
import { keychainGet, keychainSet } from "./keychainService.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const KEY = "scriptor-token";
const VALUE = "gho_TestAccessToken12345";

/**
 * Build a fake spawn dep that records calls and returns canned results.
 */
function makeSpawn(
	exitCode: number,
	stdout: string,
): KeychainDeps["spawn"] & { calls: string[][] } {
	const calls: string[][] = [];
	const spawn: KeychainDeps["spawn"] & { calls: string[][] } = Object.assign(
		async (cmd: string[], _stdin?: string) => {
			calls.push(cmd);
			return { exitCode, stdout };
		},
		{ calls },
	);
	return spawn;
}

function deps(
	platform: NodeJS.Platform,
	exitCode: number,
	stdout: string,
): KeychainDeps & { spawnCalls: string[][] } {
	const spawnFake = makeSpawn(exitCode, stdout);
	return {
		platform,
		spawn: spawnFake,
		get spawnCalls() {
			return spawnFake.calls;
		},
	};
}

// ---------------------------------------------------------------------------
// keychainGet — macOS (darwin)
// ---------------------------------------------------------------------------

describe("keychainGet — macOS", () => {
	it("returns the stored value on success", async () => {
		const d = deps("darwin", 0, VALUE);
		const result = await keychainGet(KEY, d);
		expect(result).toBe(VALUE);
	});

	it("calls security find-generic-password with correct args", async () => {
		const d = deps("darwin", 0, VALUE);
		await keychainGet(KEY, d);
		expect(d.spawnCalls[0]).toEqual([
			"security",
			"find-generic-password",
			"-s",
			KEY,
			"-w",
		]);
	});

	it("returns null when exit code is non-zero", async () => {
		const d = deps("darwin", 44, "");
		const result = await keychainGet(KEY, d);
		expect(result).toBeNull();
	});

	it("returns null when tool not found (exit 127)", async () => {
		const d = deps("darwin", 127, "");
		const result = await keychainGet(KEY, d);
		expect(result).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// keychainSet — macOS (darwin)
// ---------------------------------------------------------------------------

describe("keychainSet — macOS", () => {
	it("calls security add-generic-password with correct args", async () => {
		const d = deps("darwin", 0, "");
		await keychainSet(KEY, VALUE, d);
		expect(d.spawnCalls[0]).toEqual([
			"security",
			"add-generic-password",
			"-s",
			KEY,
			"-w",
			VALUE,
			"-U",
		]);
	});

	it("silently no-ops when exit code is non-zero", async () => {
		const d = deps("darwin", 1, "");
		await expect(keychainSet(KEY, VALUE, d)).resolves.toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// keychainGet — Linux
// ---------------------------------------------------------------------------

describe("keychainGet — Linux", () => {
	it("returns the stored value on success", async () => {
		const d = deps("linux", 0, VALUE);
		const result = await keychainGet(KEY, d);
		expect(result).toBe(VALUE);
	});

	it("calls secret-tool lookup with correct args", async () => {
		const d = deps("linux", 0, VALUE);
		await keychainGet(KEY, d);
		expect(d.spawnCalls[0]).toEqual(["secret-tool", "lookup", "service", KEY]);
	});

	it("returns null when exit code is non-zero", async () => {
		const d = deps("linux", 1, "");
		const result = await keychainGet(KEY, d);
		expect(result).toBeNull();
	});

	it("returns null when secret-tool is missing (exit 127)", async () => {
		const d = deps("linux", 127, "");
		const result = await keychainGet(KEY, d);
		expect(result).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// keychainSet — Linux
// ---------------------------------------------------------------------------

describe("keychainSet — Linux", () => {
	it("calls secret-tool store with correct args", async () => {
		const d = deps("linux", 0, "");
		await keychainSet(KEY, VALUE, d);
		expect(d.spawnCalls[0]).toEqual([
			"secret-tool",
			"store",
			"--label",
			KEY,
			"service",
			KEY,
		]);
	});

	it("silently no-ops when exit code is non-zero", async () => {
		const d = deps("linux", 1, "");
		await expect(keychainSet(KEY, VALUE, d)).resolves.toBeUndefined();
	});

	it("silently no-ops when tool missing (exit 127)", async () => {
		const d = deps("linux", 127, "");
		await expect(keychainSet(KEY, VALUE, d)).resolves.toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// keychainGet — Windows
// ---------------------------------------------------------------------------

describe("keychainGet — Windows", () => {
	it("returns the stored value on success", async () => {
		const d = deps("win32", 0, VALUE);
		const result = await keychainGet(KEY, d);
		expect(result).toBe(VALUE);
	});

	it("calls powershell with correct script fragment", async () => {
		const d = deps("win32", 0, VALUE);
		await keychainGet(KEY, d);
		// biome-ignore lint/style/noNonNullAssertion: spawn was called, so index 0 exists
		const call = d.spawnCalls[0]!;
		expect(call[0]).toBe("powershell");
		expect(call.join(" ")).toContain(KEY);
	});

	it("returns null when exit code is non-zero", async () => {
		const d = deps("win32", 1, "");
		const result = await keychainGet(KEY, d);
		expect(result).toBeNull();
	});

	it("returns null when tool not found (exit 127)", async () => {
		const d = deps("win32", 127, "");
		const result = await keychainGet(KEY, d);
		expect(result).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// keychainSet — Windows
// ---------------------------------------------------------------------------

describe("keychainSet — Windows", () => {
	it("calls powershell with correct script fragment", async () => {
		const d = deps("win32", 0, "");
		await keychainSet(KEY, VALUE, d);
		// biome-ignore lint/style/noNonNullAssertion: spawn was called, so index 0 exists
		const call = d.spawnCalls[0]!;
		expect(call[0]).toBe("powershell");
		expect(call.join(" ")).toContain(KEY);
	});

	it("silently no-ops when exit code is non-zero", async () => {
		const d = deps("win32", 1, "");
		await expect(keychainSet(KEY, VALUE, d)).resolves.toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// keychainGet — unknown platform
// ---------------------------------------------------------------------------

describe("keychainGet — unknown platform", () => {
	it("returns null for an unsupported platform", async () => {
		const d = deps("freebsd" as NodeJS.Platform, 0, VALUE);
		const result = await keychainGet(KEY, d);
		expect(result).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// keychainSet — unknown platform
// ---------------------------------------------------------------------------

describe("keychainSet — unknown platform", () => {
	it("silently no-ops for an unsupported platform", async () => {
		const d = deps("freebsd" as NodeJS.Platform, 0, "");
		await expect(keychainSet(KEY, VALUE, d)).resolves.toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// spawn throws (process failure / ENOENT)
// ---------------------------------------------------------------------------

describe("keychainGet — spawn throws", () => {
	it("returns null when spawn itself throws", async () => {
		const throwingDeps: KeychainDeps = {
			platform: "darwin",
			spawn: async (_cmd: string[], _stdin?: string) => {
				throw new Error("ENOENT: spawn failed");
			},
		};
		const result = await keychainGet(KEY, throwingDeps);
		expect(result).toBeNull();
	});
});

describe("keychainSet — spawn throws", () => {
	it("silently swallows error when spawn throws", async () => {
		const throwingDeps: KeychainDeps = {
			platform: "linux",
			spawn: async (_cmd: string[], _stdin?: string) => {
				throw new Error("ENOENT: spawn failed");
			},
		};
		await expect(
			keychainSet(KEY, VALUE, throwingDeps),
		).resolves.toBeUndefined();
	});
});
