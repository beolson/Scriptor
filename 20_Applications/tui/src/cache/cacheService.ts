import path from "node:path";
import { CACHE_DIR } from "../config.js";
import type { Repo } from "../types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CacheServiceDeps {
	readFileFn?: (path: string) => Promise<string>;
	writeFileFn?: (path: string, content: string) => Promise<void>;
	existsFn?: (path: string) => Promise<boolean>;
	confirmFn?: (message: string) => Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cacheRoot(repo: Repo): string {
	return path.join(CACHE_DIR, repo.owner, repo.name);
}

function manifestPath(repo: Repo): string {
	return path.join(cacheRoot(repo), "manifest.yaml");
}

function scriptCachePath(repo: Repo, scriptPath: string): string {
	return path.join(cacheRoot(repo), scriptPath);
}

// ---------------------------------------------------------------------------
// cacheExists
// ---------------------------------------------------------------------------

export async function cacheExists(
	repo: Repo,
	deps?: CacheServiceDeps,
): Promise<boolean> {
	const existsFn =
		deps?.existsFn ??
		(async (p: string) => {
			const file = Bun.file(p);
			return file.exists();
		});

	return existsFn(manifestPath(repo));
}

// ---------------------------------------------------------------------------
// readCachedManifest
// ---------------------------------------------------------------------------

export async function readCachedManifest(
	repo: Repo,
	deps?: CacheServiceDeps,
): Promise<string | undefined> {
	const readFileFn = deps?.readFileFn ?? ((p: string) => Bun.file(p).text());

	try {
		return await readFileFn(manifestPath(repo));
	} catch {
		return undefined;
	}
}

// ---------------------------------------------------------------------------
// writeCachedManifest
// ---------------------------------------------------------------------------

export async function writeCachedManifest(
	repo: Repo,
	content: string,
	deps?: CacheServiceDeps,
): Promise<void> {
	const writeFileFn =
		deps?.writeFileFn ??
		(async (p: string, c: string) => {
			await Bun.write(p, c);
		});

	await writeFileFn(manifestPath(repo), content);
}

// ---------------------------------------------------------------------------
// readCachedScript
// ---------------------------------------------------------------------------

export async function readCachedScript(
	repo: Repo,
	scriptPath: string,
	deps?: CacheServiceDeps,
): Promise<string | undefined> {
	const readFileFn = deps?.readFileFn ?? ((p: string) => Bun.file(p).text());

	try {
		return await readFileFn(scriptCachePath(repo, scriptPath));
	} catch {
		return undefined;
	}
}

// ---------------------------------------------------------------------------
// writeCachedScript
// ---------------------------------------------------------------------------

export async function writeCachedScript(
	repo: Repo,
	scriptPath: string,
	content: string,
	deps?: CacheServiceDeps,
): Promise<void> {
	const writeFileFn =
		deps?.writeFileFn ??
		(async (p: string, c: string) => {
			await Bun.write(p, c);
		});

	await writeFileFn(scriptCachePath(repo, scriptPath), content);
}

// ---------------------------------------------------------------------------
// promptCacheUpdate
// ---------------------------------------------------------------------------

export async function promptCacheUpdate(
	deps?: CacheServiceDeps,
): Promise<boolean> {
	const confirmFn =
		deps?.confirmFn ??
		(async (_msg: string) => {
			const { confirm } = await import("@clack/prompts");
			return confirm({ message: _msg }) as Promise<boolean>;
		});

	return confirmFn("Cache found. Check for updates?");
}
