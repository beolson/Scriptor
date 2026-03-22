import * as nodePath from "node:path";
import type { Repo } from "../repo/types.js";

// ---------------------------------------------------------------------------
// Cache root
// ---------------------------------------------------------------------------

const CACHE_ROOT = nodePath.join(
	process.env.HOME ?? process.env.USERPROFILE ?? "~",
	".scriptor",
	"cache",
);

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/**
 * Returns the cache directory for the given repo.
 * e.g. ~/.scriptor/cache/<owner>/<repo>/
 */
function repoCacheDir(repo: Repo): string {
	return nodePath.join(CACHE_ROOT, repo.owner, repo.name);
}

/**
 * Returns the path to the cached manifest file for the given repo.
 */
function manifestPath(repo: Repo): string {
	return nodePath.join(repoCacheDir(repo), "manifest.yaml");
}

/**
 * Returns the path to a cached script file for the given repo.
 * scriptKey is the relative path within the scripts/ subdirectory
 * (e.g. "linux/ubuntu/install-git.sh").
 */
function scriptPath(repo: Repo, scriptKey: string): string {
	return nodePath.join(repoCacheDir(repo), "scripts", scriptKey);
}

// ---------------------------------------------------------------------------
// Injectable deps
// ---------------------------------------------------------------------------

export interface CacheDeps {
	fileExists: (path: string) => Promise<boolean>;
	readFile: (path: string) => Promise<string>;
	writeFile: (path: string, content: string) => Promise<void>;
	mkdir: (path: string) => Promise<void>;
}

const defaultDeps: CacheDeps = {
	fileExists: async (path: string) => {
		const file = Bun.file(path);
		return file.exists();
	},
	readFile: async (path: string) => {
		const file = Bun.file(path);
		const exists = await file.exists();
		if (!exists) {
			const err = new Error(
				`ENOENT: no such file: ${path}`,
			) as NodeJS.ErrnoException;
			err.code = "ENOENT";
			throw err;
		}
		return file.text();
	},
	writeFile: async (path: string, content: string) => {
		await Bun.write(path, content);
	},
	mkdir: async (dirPath: string) => {
		const fs = await import("node:fs/promises");
		await fs.mkdir(dirPath, { recursive: true });
	},
};

// ---------------------------------------------------------------------------
// cacheExists
// ---------------------------------------------------------------------------

/**
 * Returns `true` if a cached manifest exists for the given repo.
 * Checks for `~/.scriptor/cache/<owner>/<repo>/manifest.yaml`.
 */
export async function cacheExists(
	repo: Repo,
	deps?: Partial<CacheDeps>,
): Promise<boolean> {
	const resolved = { ...defaultDeps, ...deps };
	return resolved.fileExists(manifestPath(repo));
}

// ---------------------------------------------------------------------------
// readManifest
// ---------------------------------------------------------------------------

/**
 * Reads and returns the raw YAML manifest string from the cache for the given repo.
 * Throws if the manifest does not exist.
 */
export async function readManifest(
	repo: Repo,
	deps?: Partial<CacheDeps>,
): Promise<string> {
	const resolved = { ...defaultDeps, ...deps };
	return resolved.readFile(manifestPath(repo));
}

// ---------------------------------------------------------------------------
// writeCache
// ---------------------------------------------------------------------------

/**
 * Writes the manifest and all script files to the cache for the given repo.
 *
 * - Manifest is written to `~/.scriptor/cache/<owner>/<repo>/manifest.yaml`
 * - Scripts are written to `~/.scriptor/cache/<owner>/<repo>/scripts/<key>`
 *   where `key` is the relative path (e.g. "linux/ubuntu/install-git.sh")
 *
 * Parent directories are created as needed.
 */
export async function writeCache(
	repo: Repo,
	manifest: string,
	scripts: Map<string, string>,
	deps?: Partial<CacheDeps>,
): Promise<void> {
	const resolved = { ...defaultDeps, ...deps };

	// Ensure the repo cache directory exists
	const cacheDir = repoCacheDir(repo);
	await resolved.mkdir(cacheDir);

	// Write manifest
	await resolved.writeFile(manifestPath(repo), manifest);

	// Write each script file, creating subdirectories as needed
	for (const [key, content] of scripts) {
		const dest = scriptPath(repo, key);
		const dir = nodePath.dirname(dest);
		await resolved.mkdir(dir);
		await resolved.writeFile(dest, content);
	}
}
