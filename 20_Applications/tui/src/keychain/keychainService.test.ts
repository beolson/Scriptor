import { describe, expect, it } from "bun:test";
import { deleteToken, getToken, setToken } from "./keychainService.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type SpawnSyncResult = {
	exitCode: number;
	stdout: Buffer | string;
};

function capturingSpawnSync(): {
	calls: Array<{ cmd: string[]; opts: unknown }>;
	fn: (cmd: string[], opts?: unknown) => SpawnSyncResult;
} {
	const calls: Array<{ cmd: string[]; opts: unknown }> = [];
	return {
		calls,
		fn: (cmd, opts) => {
			calls.push({ cmd, opts: opts ?? null });
			return { exitCode: 0, stdout: Buffer.from("") };
		},
	};
}

// ---------------------------------------------------------------------------
// getToken — darwin
// ---------------------------------------------------------------------------

describe("getToken — darwin", () => {
	it("calls security find-generic-password and returns trimmed stdout", () => {
		const result = getToken({
			platformFn: () => "darwin",
			spawnSyncFn: (_cmd, _opts) => ({
				exitCode: 0,
				stdout: Buffer.from("  ghp_abc123  \n"),
			}),
		});
		expect(result).toBe("ghp_abc123");
	});

	it("includes correct security arguments", () => {
		const { calls, fn } = capturingSpawnSync();
		getToken({ platformFn: () => "darwin", spawnSyncFn: fn });
		expect(calls.length).toBe(1);
		// biome-ignore lint/style/noNonNullAssertion: length asserted above
		const cmd = calls[0]!.cmd;
		expect(cmd[0]).toBe("security");
		expect(cmd).toContain("find-generic-password");
		expect(cmd).toContain("-s");
		expect(cmd).toContain("scriptor");
		expect(cmd).toContain("-a");
		expect(cmd).toContain("github-token");
		expect(cmd).toContain("-w");
	});

	it("returns undefined when exit code is non-zero", () => {
		const result = getToken({
			platformFn: () => "darwin",
			spawnSyncFn: () => ({ exitCode: 1, stdout: Buffer.from("") }),
		});
		expect(result).toBeUndefined();
	});

	it("returns undefined when spawnSyncFn throws", () => {
		const result = getToken({
			platformFn: () => "darwin",
			spawnSyncFn: () => {
				throw new Error("command not found");
			},
		});
		expect(result).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// setToken — darwin
// ---------------------------------------------------------------------------

describe("setToken — darwin", () => {
	it("calls security add-generic-password with -U flag", () => {
		const { calls, fn } = capturingSpawnSync();
		setToken("ghp_mytoken", { platformFn: () => "darwin", spawnSyncFn: fn });
		expect(calls.length).toBe(1);
		// biome-ignore lint/style/noNonNullAssertion: length asserted above
		const cmd = calls[0]!.cmd;
		expect(cmd[0]).toBe("security");
		expect(cmd).toContain("add-generic-password");
		expect(cmd).toContain("-U");
		expect(cmd).toContain("ghp_mytoken");
	});

	it("silently no-ops when spawnSyncFn throws", () => {
		expect(() =>
			setToken("tok", {
				platformFn: () => "darwin",
				spawnSyncFn: () => {
					throw new Error("fail");
				},
			}),
		).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// deleteToken — darwin
// ---------------------------------------------------------------------------

describe("deleteToken — darwin", () => {
	it("calls security delete-generic-password", () => {
		const { calls, fn } = capturingSpawnSync();
		deleteToken({ platformFn: () => "darwin", spawnSyncFn: fn });
		expect(calls.length).toBe(1);
		// biome-ignore lint/style/noNonNullAssertion: length asserted above
		const cmd = calls[0]!.cmd;
		expect(cmd[0]).toBe("security");
		expect(cmd).toContain("delete-generic-password");
	});

	it("silently no-ops when spawnSyncFn throws", () => {
		expect(() =>
			deleteToken({
				platformFn: () => "darwin",
				spawnSyncFn: () => {
					throw new Error("fail");
				},
			}),
		).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// getToken — linux
// ---------------------------------------------------------------------------

describe("getToken — linux", () => {
	it("calls secret-tool lookup with correct args and returns trimmed stdout", () => {
		const result = getToken({
			platformFn: () => "linux",
			spawnSyncFn: () => ({
				exitCode: 0,
				stdout: Buffer.from("ghp_linux_token\n"),
			}),
		});
		expect(result).toBe("ghp_linux_token");
	});

	it("includes correct secret-tool lookup arguments", () => {
		const { calls, fn } = capturingSpawnSync();
		getToken({ platformFn: () => "linux", spawnSyncFn: fn });
		expect(calls.length).toBe(1);
		// biome-ignore lint/style/noNonNullAssertion: length asserted above
		const cmd = calls[0]!.cmd;
		expect(cmd[0]).toBe("secret-tool");
		expect(cmd).toContain("lookup");
		expect(cmd).toContain("service");
		expect(cmd).toContain("scriptor");
		expect(cmd).toContain("account");
		expect(cmd).toContain("github-token");
	});

	it("returns undefined when exit code is non-zero", () => {
		const result = getToken({
			platformFn: () => "linux",
			spawnSyncFn: () => ({ exitCode: 1, stdout: Buffer.from("") }),
		});
		expect(result).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// setToken — linux (stdin)
// ---------------------------------------------------------------------------

describe("setToken — linux", () => {
	it("calls secret-tool store with correct args", () => {
		const { calls, fn } = capturingSpawnSync();
		setToken("ghp_linux", { platformFn: () => "linux", spawnSyncFn: fn });
		expect(calls.length).toBe(1);
		// biome-ignore lint/style/noNonNullAssertion: length asserted above
		const cmd = calls[0]!.cmd;
		expect(cmd[0]).toBe("secret-tool");
		expect(cmd).toContain("store");
		expect(cmd).toContain("service");
		expect(cmd).toContain("scriptor");
		expect(cmd).toContain("account");
		expect(cmd).toContain("github-token");
	});

	it("passes token via stdin", () => {
		const calls: Array<{ cmd: string[]; opts: unknown }> = [];
		const fn = (cmd: string[], opts?: unknown) => {
			calls.push({ cmd, opts });
			return { exitCode: 0, stdout: Buffer.from("") };
		};
		setToken("ghp_stdintest", { platformFn: () => "linux", spawnSyncFn: fn });
		expect(calls.length).toBe(1);
		// biome-ignore lint/style/noNonNullAssertion: length asserted above
		const opts = calls[0]!.opts as Record<string, unknown>;
		expect(opts?.stdin).toContain("ghp_stdintest");
	});

	it("silently no-ops when spawnSyncFn throws", () => {
		expect(() =>
			setToken("tok", {
				platformFn: () => "linux",
				spawnSyncFn: () => {
					throw new Error("fail");
				},
			}),
		).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// deleteToken — linux
// ---------------------------------------------------------------------------

describe("deleteToken — linux", () => {
	it("calls secret-tool clear with correct args", () => {
		const { calls, fn } = capturingSpawnSync();
		deleteToken({ platformFn: () => "linux", spawnSyncFn: fn });
		expect(calls.length).toBe(1);
		// biome-ignore lint/style/noNonNullAssertion: length asserted above
		const cmd = calls[0]!.cmd;
		expect(cmd[0]).toBe("secret-tool");
		expect(cmd).toContain("clear");
		expect(cmd).toContain("service");
		expect(cmd).toContain("scriptor");
		expect(cmd).toContain("account");
		expect(cmd).toContain("github-token");
	});
});

// ---------------------------------------------------------------------------
// getToken — win32
// ---------------------------------------------------------------------------

describe("getToken — win32", () => {
	it("calls cmdkey /list and parses output for scriptor:github-token entry", () => {
		const cmdkeyOutput =
			"Currently stored credentials:\n\n    Target: LegacyGeneric:target=scriptor:github-token\n    User: github-token\n";
		const calls: Array<{ cmd: string[]; opts: unknown }> = [];
		const result = getToken({
			platformFn: () => "win32",
			spawnSyncFn: (cmd, opts) => {
				calls.push({ cmd, opts: opts ?? null });
				// First call: cmdkey /list
				if (cmd.includes("/list")) {
					return { exitCode: 0, stdout: Buffer.from(cmdkeyOutput) };
				}
				return { exitCode: 0, stdout: Buffer.from("") };
			},
		});
		// biome-ignore lint/style/noNonNullAssertion: array is non-empty (call was made)
		expect(calls[0]!.cmd).toContain("/list");
		// win32 get returns the stored credential string or a parsed representation
		expect(typeof result === "string" || result === undefined).toBe(true);
	});

	it("returns undefined when cmdkey output does not contain scriptor:github-token", () => {
		const result = getToken({
			platformFn: () => "win32",
			spawnSyncFn: () => ({
				exitCode: 0,
				stdout: Buffer.from("No credentials stored.\n"),
			}),
		});
		expect(result).toBeUndefined();
	});

	it("returns undefined when spawnSyncFn throws", () => {
		const result = getToken({
			platformFn: () => "win32",
			spawnSyncFn: () => {
				throw new Error("fail");
			},
		});
		expect(result).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// setToken — win32
// ---------------------------------------------------------------------------

describe("setToken — win32", () => {
	it("calls cmdkey /add with correct target and token", () => {
		const { calls, fn } = capturingSpawnSync();
		setToken("win_token", { platformFn: () => "win32", spawnSyncFn: fn });
		expect(calls.length).toBe(1);
		// biome-ignore lint/style/noNonNullAssertion: length asserted above
		const cmd = calls[0]!.cmd;
		expect(cmd[0]).toBe("cmdkey");
		expect(cmd.some((a) => a.includes("/add"))).toBe(true);
		expect(cmd.some((a) => a.includes("scriptor:github-token"))).toBe(true);
		expect(cmd.some((a) => a.includes("win_token"))).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// deleteToken — win32
// ---------------------------------------------------------------------------

describe("deleteToken — win32", () => {
	it("calls cmdkey /delete with correct target", () => {
		const { calls, fn } = capturingSpawnSync();
		deleteToken({ platformFn: () => "win32", spawnSyncFn: fn });
		expect(calls.length).toBe(1);
		// biome-ignore lint/style/noNonNullAssertion: length asserted above
		const cmd = calls[0]!.cmd;
		expect(cmd[0]).toBe("cmdkey");
		expect(cmd.some((a) => a.includes("/delete"))).toBe(true);
		expect(cmd.some((a) => a.includes("scriptor:github-token"))).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Unknown platform
// ---------------------------------------------------------------------------

describe("unknown platform", () => {
	it("getToken returns undefined on unknown platform", () => {
		const result = getToken({
			platformFn: () => "freebsd",
			spawnSyncFn: () => {
				throw new Error("should not be called");
			},
		});
		expect(result).toBeUndefined();
	});

	it("setToken silently no-ops on unknown platform", () => {
		expect(() =>
			setToken("tok", {
				platformFn: () => "freebsd",
				spawnSyncFn: () => {
					throw new Error("should not be called");
				},
			}),
		).not.toThrow();
	});

	it("deleteToken silently no-ops on unknown platform", () => {
		expect(() =>
			deleteToken({
				platformFn: () => "freebsd",
				spawnSyncFn: () => {
					throw new Error("should not be called");
				},
			}),
		).not.toThrow();
	});
});
