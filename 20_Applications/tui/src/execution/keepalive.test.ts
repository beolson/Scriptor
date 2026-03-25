// ---------------------------------------------------------------------------
// Keepalive Tests
//
// Tests exercise `startKeepalive` and `stopKeepalive` with all side-effectful
// deps injected as fakes. No real timers or processes are created.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "bun:test";
import { startKeepalive, stopKeepalive } from "./keepalive.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * A fake timer handle — just a plain object that can be tracked by reference.
 * NodeJS.Timeout is opaque in tests, so we use `unknown` cast.
 */
function makeFakeTimer(): NodeJS.Timeout {
	return {} as NodeJS.Timeout;
}

interface SpawnCall {
	cmd: string[];
	opts: object;
}

// ---------------------------------------------------------------------------
// startKeepalive
// ---------------------------------------------------------------------------

describe("startKeepalive", () => {
	it("calls setInterval with 240000ms interval", () => {
		let capturedMs: number | undefined;
		const timer = makeFakeTimer();

		startKeepalive({
			setInterval: (_fn, ms) => {
				capturedMs = ms;
				return timer;
			},
			clearInterval: () => {},
			spawn: () => {},
		});

		expect(capturedMs).toBe(240000);
	});

	it("returns the timer handle from setInterval", () => {
		const timer = makeFakeTimer();

		const result = startKeepalive({
			setInterval: (_fn, _ms) => timer,
			clearInterval: () => {},
			spawn: () => {},
		});

		expect(result).toBe(timer);
	});

	it("interval callback spawns ['sudo', '-v']", () => {
		const spawnCalls: SpawnCall[] = [];
		let capturedFn: (() => void) | undefined;
		const timer = makeFakeTimer();

		startKeepalive({
			setInterval: (fn, _ms) => {
				capturedFn = fn;
				return timer;
			},
			clearInterval: () => {},
			spawn: (cmd, opts) => {
				spawnCalls.push({ cmd, opts });
			},
		});

		// Simulate the interval firing
		capturedFn?.();

		expect(spawnCalls).toHaveLength(1);
		// biome-ignore lint/style/noNonNullAssertion: length asserted above
		expect(spawnCalls[0]!.cmd).toEqual(["sudo", "-v"]);
	});

	it("interval callback ignores stdout and stderr", () => {
		const spawnCalls: SpawnCall[] = [];
		let capturedFn: (() => void) | undefined;
		const timer = makeFakeTimer();

		startKeepalive({
			setInterval: (fn, _ms) => {
				capturedFn = fn;
				return timer;
			},
			clearInterval: () => {},
			spawn: (cmd, opts) => {
				spawnCalls.push({ cmd, opts });
			},
		});

		capturedFn?.();

		// biome-ignore lint/style/noNonNullAssertion: callback was invoked above
		const opts = spawnCalls[0]!.opts as Record<string, unknown>;
		expect(opts.stdout).toBe("ignore");
		expect(opts.stderr).toBe("ignore");
	});

	it("interval callback can fire multiple times (no closure issues)", () => {
		const spawnCalls: SpawnCall[] = [];
		let capturedFn: (() => void) | undefined;
		const timer = makeFakeTimer();

		startKeepalive({
			setInterval: (fn, _ms) => {
				capturedFn = fn;
				return timer;
			},
			clearInterval: () => {},
			spawn: (cmd, opts) => {
				spawnCalls.push({ cmd, opts });
			},
		});

		capturedFn?.();
		capturedFn?.();
		capturedFn?.();

		expect(spawnCalls).toHaveLength(3);
	});
});

// ---------------------------------------------------------------------------
// stopKeepalive
// ---------------------------------------------------------------------------

describe("stopKeepalive", () => {
	it("calls clearInterval with the given timer", () => {
		let clearedTimer: NodeJS.Timeout | undefined;
		const timer = makeFakeTimer();

		stopKeepalive(timer, {
			setInterval: (_fn, _ms) => makeFakeTimer(),
			clearInterval: (t) => {
				clearedTimer = t;
			},
			spawn: () => {},
		});

		expect(clearedTimer).toBe(timer);
	});

	it("spawns ['sudo', '-k'] after clearing", () => {
		const order: string[] = [];
		const spawnCalls: SpawnCall[] = [];
		const timer = makeFakeTimer();

		stopKeepalive(timer, {
			setInterval: (_fn, _ms) => makeFakeTimer(),
			clearInterval: (_t) => {
				order.push("clearInterval");
			},
			spawn: (cmd, opts) => {
				order.push("spawn");
				spawnCalls.push({ cmd, opts });
			},
		});

		expect(order[0]).toBe("clearInterval");
		expect(order[1]).toBe("spawn");
		// biome-ignore lint/style/noNonNullAssertion: spawn was called, array is populated
		expect(spawnCalls[0]!.cmd).toEqual(["sudo", "-k"]);
	});

	it("spawns ['sudo', '-k'] with stdout and stderr ignored", () => {
		const spawnCalls: SpawnCall[] = [];
		const timer = makeFakeTimer();

		stopKeepalive(timer, {
			setInterval: (_fn, _ms) => makeFakeTimer(),
			clearInterval: () => {},
			spawn: (cmd, opts) => {
				spawnCalls.push({ cmd, opts });
			},
		});

		// biome-ignore lint/style/noNonNullAssertion: spawn was called, array is populated
		const opts = spawnCalls[0]!.opts as Record<string, unknown>;
		expect(opts.stdout).toBe("ignore");
		expect(opts.stderr).toBe("ignore");
	});

	it("spawns ['sudo', '-k'] even if the timer was already elapsed", () => {
		// This test asserts the same behaviour regardless of timer state —
		// stopKeepalive always calls clearInterval then spawns sudo -k.
		const spawnCalls: SpawnCall[] = [];
		const timer = makeFakeTimer();

		stopKeepalive(timer, {
			setInterval: (_fn, _ms) => makeFakeTimer(),
			clearInterval: () => {}, // silently no-ops (timer already done)
			spawn: (cmd, opts) => {
				spawnCalls.push({ cmd, opts });
			},
		});

		expect(spawnCalls).toHaveLength(1);
		// biome-ignore lint/style/noNonNullAssertion: length asserted above
		expect(spawnCalls[0]!.cmd).toEqual(["sudo", "-k"]);
	});
});
