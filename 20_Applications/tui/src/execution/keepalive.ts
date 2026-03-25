// ---------------------------------------------------------------------------
// Keepalive
//
// Per-elevation-script sudo credential refresh timer.
// Starts a setInterval that calls `sudo -v` every 4 minutes to prevent
// sudo credentials from expiring during a long-running script.
// Stopped via clearInterval + `sudo -k` (invalidate) in the finally block
// after each elevation script completes.
//
// All deps are injectable for testability.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KeepaliveDeps {
	setInterval: (fn: () => void, ms: number) => NodeJS.Timeout;
	clearInterval: (timer: NodeJS.Timeout) => void;
	spawn: (cmd: string[], opts: object) => void;
}

// ---------------------------------------------------------------------------
// startKeepalive
// ---------------------------------------------------------------------------

/**
 * Starts a keepalive timer that refreshes sudo credentials every 4 minutes.
 * Returns the timer handle so it can be stopped later via `stopKeepalive`.
 */
export function startKeepalive(deps?: KeepaliveDeps): NodeJS.Timeout {
	const { setInterval, spawn } = deps ?? makeDefaultDeps();

	return setInterval(
		() => {
			spawn(["sudo", "-v"], { stdout: "ignore", stderr: "ignore" });
		},
		4 * 60 * 1000,
	);
}

// ---------------------------------------------------------------------------
// stopKeepalive
// ---------------------------------------------------------------------------

/**
 * Stops the keepalive timer and invalidates the sudo credentials.
 * Always calls clearInterval then spawns `sudo -k` regardless of timer state.
 */
export function stopKeepalive(
	timer: NodeJS.Timeout,
	deps?: KeepaliveDeps,
): void {
	const { clearInterval, spawn } = deps ?? makeDefaultDeps();

	clearInterval(timer);
	spawn(["sudo", "-k"], { stdout: "ignore", stderr: "ignore" });
}

// ---------------------------------------------------------------------------
// Default deps (wired to real implementations)
// ---------------------------------------------------------------------------

function makeDefaultDeps(): KeepaliveDeps {
	return {
		setInterval: (fn, ms) => setInterval(fn, ms),
		clearInterval: (timer) => clearInterval(timer),
		spawn: (cmd, opts) => {
			Bun.spawn(cmd, opts as Parameters<typeof Bun.spawn>[1]);
		},
	};
}
