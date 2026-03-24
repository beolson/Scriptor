// ---------------------------------------------------------------------------
// Elevation Pre-Flight Tests
//
// Tests for the Windows-only admin check that runs before script execution.
// All deps are injected as fakes. No real process spawning or OS calls.
// TDD: tests were written before the implementation (RED → GREEN).
// ---------------------------------------------------------------------------

import { describe, expect, it } from "bun:test";
import type { ScriptEntry } from "../manifest/types.js";
import type { ElevationPreFlightDeps } from "./elevationPreFlight.js";
import { checkWindowsElevation } from "./elevationPreFlight.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(
	overrides: Partial<ScriptEntry> & { id: string; name: string },
): ScriptEntry {
	return {
		description: "A test script",
		platform: "windows",
		arch: "x86",
		script: "script.ps1",
		dependencies: [],
		optional_dependencies: [],
		requires_elevation: false,
		inputs: [],
		...overrides,
	};
}

function makeDeps(
	overrides: Partial<ElevationPreFlightDeps> = {},
): ElevationPreFlightDeps {
	return {
		platform: "win32",
		spawn: (_cmd: string[]) => ({ exited: Promise.resolve(0) }),
		log: {
			error: (_msg: string) => {},
		},
		exit: (_code: number): never => {
			throw new Error(`exit:${_code}`);
		},
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Non-Windows platform
// ---------------------------------------------------------------------------

describe("non-Windows platform", () => {
	it("returns 'ok' immediately on linux without spawning", async () => {
		let spawnCalled = false;
		const deps = makeDeps({
			platform: "linux",
			spawn: (_cmd: string[]) => {
				spawnCalled = true;
				return { exited: Promise.resolve(0) };
			},
		});
		const scripts = [
			makeEntry({ id: "a", name: "Alpha", requires_elevation: true }),
		];
		const result = await checkWindowsElevation(scripts, deps);
		expect(result).toBe("ok");
		expect(spawnCalled).toBe(false);
	});

	it("returns 'ok' immediately on darwin without spawning", async () => {
		let spawnCalled = false;
		const deps = makeDeps({
			platform: "darwin",
			spawn: (_cmd: string[]) => {
				spawnCalled = true;
				return { exited: Promise.resolve(0) };
			},
		});
		const scripts = [
			makeEntry({ id: "a", name: "Alpha", requires_elevation: true }),
		];
		const result = await checkWindowsElevation(scripts, deps);
		expect(result).toBe("ok");
		expect(spawnCalled).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// No scripts requiring elevation
// ---------------------------------------------------------------------------

describe("no scripts requiring elevation", () => {
	it("returns 'ok' immediately on Windows when no scripts require elevation", async () => {
		let spawnCalled = false;
		const deps = makeDeps({
			platform: "win32",
			spawn: (_cmd: string[]) => {
				spawnCalled = true;
				return { exited: Promise.resolve(0) };
			},
		});
		const scripts = [
			makeEntry({ id: "a", name: "Alpha", requires_elevation: false }),
		];
		const result = await checkWindowsElevation(scripts, deps);
		expect(result).toBe("ok");
		expect(spawnCalled).toBe(false);
	});

	it("returns 'ok' immediately on Windows with empty script list", async () => {
		let spawnCalled = false;
		const deps = makeDeps({
			platform: "win32",
			spawn: (_cmd: string[]) => {
				spawnCalled = true;
				return { exited: Promise.resolve(0) };
			},
		});
		const result = await checkWindowsElevation([], deps);
		expect(result).toBe("ok");
		expect(spawnCalled).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Windows elevation checks
// ---------------------------------------------------------------------------

describe("Windows elevation check — net session exit code 0", () => {
	it("returns 'ok' when net session exits with code 0", async () => {
		const deps = makeDeps({
			platform: "win32",
			spawn: (_cmd: string[]) => ({ exited: Promise.resolve(0) }),
		});
		const scripts = [
			makeEntry({ id: "a", name: "Alpha", requires_elevation: true }),
		];
		const result = await checkWindowsElevation(scripts, deps);
		expect(result).toBe("ok");
	});

	it("spawns 'net session' when on Windows with elevation-requiring scripts", async () => {
		const spawnedCmds: string[][] = [];
		const deps = makeDeps({
			platform: "win32",
			spawn: (cmd: string[]) => {
				spawnedCmds.push(cmd);
				return { exited: Promise.resolve(0) };
			},
		});
		const scripts = [
			makeEntry({ id: "a", name: "Alpha", requires_elevation: true }),
		];
		await checkWindowsElevation(scripts, deps);
		expect(spawnedCmds).toHaveLength(1);
		expect(spawnedCmds[0]).toEqual(["net", "session"]);
	});
});

describe("Windows elevation check — net session non-zero exit", () => {
	it("calls log.error then exit(1) when net session exits with code 1", async () => {
		let loggedMessage: string | undefined;
		let exitCode: number | undefined;

		const deps = makeDeps({
			platform: "win32",
			spawn: (_cmd: string[]) => ({ exited: Promise.resolve(1) }),
			log: {
				error: (msg: string) => {
					loggedMessage = msg;
				},
			},
			exit: (code: number): never => {
				exitCode = code;
				throw new Error(`exit:${code}`);
			},
		});

		const scripts = [
			makeEntry({ id: "a", name: "Alpha", requires_elevation: true }),
		];

		try {
			await checkWindowsElevation(scripts, deps);
		} catch (err) {
			if (!(err as Error).message.startsWith("exit:")) throw err;
		}

		expect(loggedMessage).toBeDefined();
		expect(exitCode).toBe(1);
	});

	it("calls log.error then exit(1) when net session exits with code 5 (access denied)", async () => {
		let loggedMessage: string | undefined;
		let exitCode: number | undefined;

		const deps = makeDeps({
			platform: "win32",
			spawn: (_cmd: string[]) => ({ exited: Promise.resolve(5) }),
			log: {
				error: (msg: string) => {
					loggedMessage = msg;
				},
			},
			exit: (code: number): never => {
				exitCode = code;
				throw new Error(`exit:${code}`);
			},
		});

		const scripts = [
			makeEntry({ id: "a", name: "Alpha", requires_elevation: true }),
		];

		try {
			await checkWindowsElevation(scripts, deps);
		} catch (err) {
			if (!(err as Error).message.startsWith("exit:")) throw err;
		}

		expect(loggedMessage).toBeDefined();
		expect(exitCode).toBe(1);
	});

	it("error message contains 'Administrator Privileges Required'", async () => {
		let loggedMessage: string | undefined;

		const deps = makeDeps({
			platform: "win32",
			spawn: (_cmd: string[]) => ({ exited: Promise.resolve(1) }),
			log: {
				error: (msg: string) => {
					loggedMessage = msg;
				},
			},
			exit: (_code: number): never => {
				throw new Error("exit:1");
			},
		});

		const scripts = [
			makeEntry({ id: "a", name: "Alpha", requires_elevation: true }),
		];

		try {
			await checkWindowsElevation(scripts, deps);
		} catch {
			// expected
		}

		expect(loggedMessage).toContain("Administrator Privileges Required");
	});

	it("error message contains relaunch instructions ('Run as administrator')", async () => {
		let loggedMessage: string | undefined;

		const deps = makeDeps({
			platform: "win32",
			spawn: (_cmd: string[]) => ({ exited: Promise.resolve(1) }),
			log: {
				error: (msg: string) => {
					loggedMessage = msg;
				},
			},
			exit: (_code: number): never => {
				throw new Error("exit:1");
			},
		});

		const scripts = [
			makeEntry({ id: "a", name: "Alpha", requires_elevation: true }),
		];

		try {
			await checkWindowsElevation(scripts, deps);
		} catch {
			// expected
		}

		expect(loggedMessage).toContain("Run as administrator");
	});

	it("log.error is called before exit(1)", async () => {
		const callOrder: string[] = [];

		const deps = makeDeps({
			platform: "win32",
			spawn: (_cmd: string[]) => ({ exited: Promise.resolve(1) }),
			log: {
				error: (_msg: string) => {
					callOrder.push("log.error");
				},
			},
			exit: (_code: number): never => {
				callOrder.push("exit");
				throw new Error("exit:1");
			},
		});

		const scripts = [
			makeEntry({ id: "a", name: "Alpha", requires_elevation: true }),
		];

		try {
			await checkWindowsElevation(scripts, deps);
		} catch {
			// expected
		}

		expect(callOrder).toEqual(["log.error", "exit"]);
	});
});

// ---------------------------------------------------------------------------
// Mixed script sets
// ---------------------------------------------------------------------------

describe("mixed script sets", () => {
	it("spawns net session when at least one script requires elevation", async () => {
		let spawnCalled = false;
		const deps = makeDeps({
			platform: "win32",
			spawn: (_cmd: string[]) => {
				spawnCalled = true;
				return { exited: Promise.resolve(0) };
			},
		});
		const scripts = [
			makeEntry({ id: "a", name: "Alpha", requires_elevation: false }),
			makeEntry({ id: "b", name: "Beta", requires_elevation: true }),
		];
		const result = await checkWindowsElevation(scripts, deps);
		expect(result).toBe("ok");
		expect(spawnCalled).toBe(true);
	});
});
