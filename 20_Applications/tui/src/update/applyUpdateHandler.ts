// ---------------------------------------------------------------------------
// Apply-Update Handler
//
// When the new binary is launched with `--apply-update <old-path>`, this
// handler moves the new binary into place and relaunches normally.
//
// Flow:
//   1. Rename process.execPath (this binary) → oldPath
//   2. Spawn oldPath (which is now the updated binary) with no special flags
//   3. Exit this process immediately
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Injectable deps
// ---------------------------------------------------------------------------

export interface ApplyUpdateHandlerDeps {
	rename: (src: string, dest: string) => Promise<void>;
	spawn: (cmd: string, args: string[]) => { exited: Promise<number> };
	exit: (code: number) => never;
	execPath: string;
}

const defaultDeps: ApplyUpdateHandlerDeps = {
	rename: async (src: string, dest: string) => {
		const fs = await import("node:fs/promises");
		await fs.rename(src, dest);
	},
	spawn: (cmd: string, args: string[]) => {
		return Bun.spawn([cmd, ...args], {
			stdio: ["inherit", "inherit", "inherit"],
		});
	},
	exit: (code: number): never => {
		process.exit(code);
	},
	execPath: process.execPath,
};

// ---------------------------------------------------------------------------
// handleApplyUpdate
// ---------------------------------------------------------------------------

/**
 * Moves this binary (process.execPath) to `oldPath`, then relaunches
 * `oldPath` (the now-updated binary) with no flags, and exits.
 *
 * This function never returns (`never`).
 */
export async function handleApplyUpdate(
	oldPath: string,
	deps?: Partial<ApplyUpdateHandlerDeps>,
): Promise<never> {
	const resolved = { ...defaultDeps, ...deps };

	// Move this binary over the old path so it is now the live binary
	await resolved.rename(resolved.execPath, oldPath);

	// Relaunch the updated binary at the original location
	resolved.spawn(oldPath, []);

	// Exit this (old) process
	return resolved.exit(0);
}
