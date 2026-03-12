import type { ScriptEntry } from "../manifest/parseManifest";

export interface SudoDeps {
	spawnSync: (cmd: string[]) => { exitCode: number };
	spawnBackground: (cmd: string[]) => void;
	spawnAsync?: (cmd: string[]) => Promise<{ exitCode: number }>;
	spawnWithStdin?: (
		cmd: string[],
		stdinData: string,
	) => Promise<{ exitCode: number }>;
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

/**
 * Checks whether sudo credentials are already cached (non-interactive).
 * Runs `sudo -n -v` which fails immediately if no cached credentials.
 */
export async function checkSudoCached(
	deps: SudoDeps = defaultDeps,
): Promise<boolean> {
	const spawnAsync =
		deps.spawnAsync ??
		(async (cmd: string[]) => {
			const proc = Bun.spawn(cmd, {
				stdin: "ignore",
				stdout: "ignore",
				stderr: "ignore",
			});
			const exitCode = await proc.exited;
			return { exitCode };
		});

	try {
		const result = await spawnAsync(["sudo", "-n", "-v"]);
		return result.exitCode === 0;
	} catch {
		return false;
	}
}

/**
 * Validates sudo credentials by piping a password to `sudo -S -v`.
 * Suitable for use inside the TUI where stdin is in raw mode.
 */
export async function validateSudoWithPassword(
	password: string,
	deps: SudoDeps = defaultDeps,
): Promise<{ ok: true } | { ok: false; reason: string }> {
	const spawnWithStdin =
		deps.spawnWithStdin ??
		(async (cmd: string[], stdinData: string) => {
			const proc = Bun.spawn(cmd, {
				stdin: "pipe",
				stdout: "ignore",
				stderr: "ignore",
			});
			proc.stdin.write(`${stdinData}\n`);
			proc.stdin.end();
			const exitCode = await proc.exited;
			return { exitCode };
		});

	try {
		const result = await spawnWithStdin(["sudo", "-S", "-v"], password);
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

/**
 * Revokes the cached sudo timestamp by running `sudo -k`.
 * Safe to call unconditionally — no-op if no credentials are cached.
 */
export async function invalidateSudo(
	deps: SudoDeps = defaultDeps,
): Promise<void> {
	const spawnAsync =
		deps.spawnAsync ??
		(async (cmd: string[]) => {
			const proc = Bun.spawn(cmd, {
				stdin: "ignore",
				stdout: "ignore",
				stderr: "ignore",
			});
			const exitCode = await proc.exited;
			return { exitCode };
		});

	await spawnAsync(["sudo", "-k"]);
}
