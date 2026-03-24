// ---------------------------------------------------------------------------
// Elevation Pre-Flight
//
// Windows-only admin check that runs before script execution. Spawns
// `net session`; any non-zero exit code is treated as "not admin" — exits
// with instructions rather than returning "not-admin".
//
// All side effects are injectable so this module can be unit-tested without
// real process spawning.
// ---------------------------------------------------------------------------

import type { ScriptEntry } from "../manifest/types.js";

// ---------------------------------------------------------------------------
// SpawnOpts
// ---------------------------------------------------------------------------

/** Minimal spawn options type used by the injectable `spawn` dep. */
export interface SpawnOpts {
	stdout?: "ignore" | "pipe" | "inherit";
	stderr?: "ignore" | "pipe" | "inherit";
}

// ---------------------------------------------------------------------------
// ElevationPreFlightDeps
// ---------------------------------------------------------------------------

/** Injectable dependencies for `checkWindowsElevation`. */
export interface ElevationPreFlightDeps {
	/** The current process platform (e.g. "win32", "linux", "darwin"). */
	platform: string;
	/** Spawn a process and return an object with an `exited` promise. */
	spawn: (cmd: string[], opts?: SpawnOpts) => { exited: Promise<number> };
	/** Logging interface. */
	log: {
		error: (msg: string) => void;
	};
	/** Process exit, injectable for tests. Never returns. */
	exit: (code: number) => never;
}

// ---------------------------------------------------------------------------
// notAdminMessage
// ---------------------------------------------------------------------------

/**
 * Multi-line message displayed when Scriptor is not running as Administrator.
 * Matches the exact text from the functional spec.
 */
export const notAdminMessage = `Administrator Privileges Required
This script requires Administrator privileges.
Scriptor is not currently running as Administrator.

To fix this:
  1. Close Scriptor
  2. Right-click scriptor.exe
  3. Select "Run as administrator"`;

// ---------------------------------------------------------------------------
// Default deps (wired to real implementations)
// ---------------------------------------------------------------------------

function makeDefaultDeps(): ElevationPreFlightDeps {
	return {
		platform: process.platform,
		spawn: (cmd: string[], _opts?: SpawnOpts) => {
			const proc = Bun.spawn(cmd, {
				stdout: "ignore",
				stderr: "ignore",
			});
			return { exited: proc.exited };
		},
		log: {
			error: (msg: string) => {
				console.error(msg);
			},
		},
		exit: (code: number): never => process.exit(code),
	};
}

// ---------------------------------------------------------------------------
// checkWindowsElevation
// ---------------------------------------------------------------------------

/**
 * Checks whether the process is running with Administrator privileges on
 * Windows. Only runs the check when:
 * - The platform is `win32`, AND
 * - At least one script in `orderedScripts` has `requires_elevation: true`.
 *
 * If the `net session` command exits with code 0, returns `"ok"`.
 * If it exits with any other code, logs the admin instructions message and
 * exits via `deps.exit(1)` — this function never returns `"not-admin"`.
 *
 * On non-Windows platforms or when no elevation is required, returns `"ok"`
 * immediately without spawning.
 */
export async function checkWindowsElevation(
	orderedScripts: ScriptEntry[],
	deps: ElevationPreFlightDeps = makeDefaultDeps(),
): Promise<"ok"> {
	// Only run the check on Windows when at least one script requires elevation.
	if (deps.platform !== "win32") return "ok";
	if (!orderedScripts.some((s) => s.requires_elevation)) return "ok";

	// Spawn `net session` to test for admin privileges.
	const proc = deps.spawn(["net", "session"]);
	const exitCode = await proc.exited;

	if (exitCode === 0) return "ok";

	// Not admin — log instructions and exit.
	deps.log.error(notAdminMessage);
	deps.exit(1);
}
