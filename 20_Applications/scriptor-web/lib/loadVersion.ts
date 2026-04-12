import { readFile as fsReadFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Injectable dependencies for loadVersion — allows unit tests to supply in-memory fixtures */
export interface LoadVersionDeps {
	/** Reads a file by path and returns its text contents */
	readFile: () => Promise<string>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Read a file as text. Uses Bun.file() when available, falls back to node:fs */
function readFileCompat(path: string): Promise<string> {
	if (typeof Bun !== "undefined") {
		return Bun.file(path).text();
	}
	return fsReadFile(path, "utf8");
}

/** Resolve the absolute path to the scriptor-web package.json (one level up from lib/) */
function packageJsonPath(): string {
	return resolve(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
}

// ─── loadVersion ─────────────────────────────────────────────────────────────

/**
 * Reads `version` from the scriptor-web package.json and returns it as a string.
 *
 * Returns `undefined` in all error cases:
 * - File not found
 * - JSON parse failure
 * - `version` field missing, not a string, or empty
 *
 * Never throws.
 *
 * Pass `deps` to override filesystem behaviour in unit tests.
 */
export async function loadVersion(
	deps?: Partial<LoadVersionDeps>,
): Promise<string | undefined> {
	const pkgPath = packageJsonPath();
	const readFile = deps?.readFile ?? (() => readFileCompat(pkgPath));

	let parsed: unknown;
	try {
		const text = await readFile();
		parsed = JSON.parse(text);
	} catch {
		return undefined;
	}

	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		return undefined;
	}

	const obj = parsed as Record<string, unknown>;
	const version = obj.version;

	if (typeof version !== "string" || version.length === 0) {
		return undefined;
	}

	return version;
}
