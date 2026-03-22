// ---------------------------------------------------------------------------
// Local Repo Reader
//
// Reads scriptor.yaml and scripts directly from the local git repository
// instead of fetching from GitHub. Used when --repo=local is passed.
//
// No caching, no network calls, no OAuth.
// ---------------------------------------------------------------------------

import * as nodePath from "node:path";

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

/**
 * Thrown when the local repo cannot be used — e.g. not in a git repo,
 * git is not installed, or scriptor.yaml is not found at the git root.
 */
export class LocalRepoError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "LocalRepoError";
	}
}

// ---------------------------------------------------------------------------
// Injectable deps
// ---------------------------------------------------------------------------

export interface LocalRepoDeps {
	/** Spawn a subprocess and return { exitCode, stdout }. */
	spawn: (
		cmd: string[],
	) => Promise<{ exitCode: number | null; stdout: string }>;
	/** Read a file from disk and return its text content. */
	readFile: (path: string) => Promise<string>;
}

const defaultDeps: LocalRepoDeps = {
	spawn: async (cmd) => {
		const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
		const stdout = await new Response(proc.stdout).text();
		const exitCode = await proc.exited;
		return { exitCode, stdout };
	},
	readFile: async (path) => {
		const file = Bun.file(path);
		const exists = await file.exists();
		if (!exists) {
			throw new LocalRepoError(`File not found: ${path}`);
		}
		return file.text();
	},
};

// ---------------------------------------------------------------------------
// findGitRoot
// ---------------------------------------------------------------------------

/**
 * Returns the absolute path to the root of the current git repository by
 * running `git rev-parse --show-toplevel`.
 *
 * Throws `LocalRepoError` if the current directory is not inside a git repo
 * or if git is not installed.
 */
export async function findGitRoot(
	deps?: Partial<LocalRepoDeps>,
): Promise<string> {
	const resolved = { ...defaultDeps, ...deps };

	let result: { exitCode: number | null; stdout: string };
	try {
		result = await resolved.spawn(["git", "rev-parse", "--show-toplevel"]);
	} catch (err) {
		throw new LocalRepoError(
			`Failed to run git: ${err instanceof Error ? err.message : String(err)}`,
		);
	}

	if (result.exitCode !== 0) {
		throw new LocalRepoError(
			"Not inside a git repository (git rev-parse --show-toplevel failed)",
		);
	}

	return result.stdout.trim();
}

// ---------------------------------------------------------------------------
// readLocalManifest
// ---------------------------------------------------------------------------

/**
 * Reads `scriptor.yaml` from the root of the current git repository.
 *
 * Returns the raw YAML manifest string and the absolute path to the git root.
 * Throws `LocalRepoError` if not in a git repo or if `scriptor.yaml` does
 * not exist at the git root.
 */
export async function readLocalManifest(
	deps?: Partial<LocalRepoDeps>,
): Promise<{ manifest: string; gitRoot: string }> {
	const resolved = { ...defaultDeps, ...deps };

	const gitRoot = await findGitRoot(resolved);
	const manifestPath = nodePath.join(gitRoot, "scriptor.yaml");

	let manifest: string;
	try {
		manifest = await resolved.readFile(manifestPath);
	} catch (err) {
		if (err instanceof LocalRepoError) {
			throw new LocalRepoError(
				`scriptor.yaml not found at git root (${gitRoot})`,
			);
		}
		throw err;
	}

	return { manifest, gitRoot };
}
