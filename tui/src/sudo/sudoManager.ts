import type { ScriptEntry } from "../manifest/parseManifest";

export interface SudoDeps {
	spawnSync: (cmd: string[]) => { exitCode: number };
	spawnBackground: (cmd: string[]) => void;
}

const defaultDeps: SudoDeps = {
	spawnSync: (cmd) => {
		const result = Bun.spawnSync(cmd, {
			stdin: "inherit",
			stdout: "inherit",
			stderr: "inherit",
		});
		return { exitCode: result.exitCode };
	},
	spawnBackground: (cmd) => {
		Bun.spawn(cmd, {
			stdin: "ignore",
			stdout: "ignore",
			stderr: "ignore",
		});
	},
};

/**
 * Returns true if any script in the list has `requires_sudo: true`.
 */
export function needsSudo(scripts: ScriptEntry[]): boolean {
	return scripts.some((s) => s.requires_sudo);
}

/**
 * Validates sudo credentials by running `sudo -v` with inherited stdio
 * so the user can enter their password at the terminal.
 */
export async function validateSudo(
	deps: SudoDeps = defaultDeps,
): Promise<{ ok: true } | { ok: false; reason: string }> {
	try {
		const result = deps.spawnSync(["sudo", "-v"]);
		if (result.exitCode !== 0) {
			return { ok: false, reason: "sudo authentication failed" };
		}
		return { ok: true };
	} catch (err) {
		return {
			ok: false,
			reason: err instanceof Error ? err.message : String(err),
		};
	}
}

const KEEPALIVE_INTERVAL_MS = 4 * 60 * 1000; // 4 minutes

/**
 * Starts a background keepalive that runs `sudo -v` every 4 minutes
 * to prevent the sudo timestamp from expiring.
 *
 * Returns a cleanup function that stops the keepalive.
 */
export function startKeepalive(deps: SudoDeps = defaultDeps): () => void {
	const timer = setInterval(() => {
		deps.spawnBackground(["sudo", "-v"]);
	}, KEEPALIVE_INTERVAL_MS);

	return () => clearInterval(timer);
}
