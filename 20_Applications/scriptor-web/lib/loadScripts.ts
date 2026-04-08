import { readFile as fsReadFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import type { Script } from "./types.js";

// ─── Dependency injection types ───────────────────────────────────────────────

/**
 * Injectable dependencies for loadScripts — allows unit tests to supply
 * in-memory fixtures instead of hitting the real filesystem.
 */
export interface LoadScriptsDeps {
	/** Yields relative paths (from scriptsDir) of all .md files under scripts/ */
	glob: (pattern: string, dir: string) => AsyncIterable<string>;
	/** Reads a file by absolute path and returns its text contents */
	readFile: (path: string) => Promise<string>;
	/** Absolute path to the scripts root directory */
	scriptsDir: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RAW_BASE =
	"https://raw.githubusercontent.com/beolson/Scriptor/main/scripts";

// ─── Frontmatter shape ────────────────────────────────────────────────────────

interface SpecFrontmatter {
	platform?: unknown;
	title?: unknown;
	description?: unknown;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Derive the script id from a relative spec path (strips .md extension) */
function idFromRelPath(relPath: string): string {
	return relPath.replace(/\.md$/, "");
}

/** Build the one-liner run command for a given script id and file extension */
function buildRunCommand(id: string, ext: ".sh" | ".ps1"): string {
	const url = `${RAW_BASE}/${id}${ext}`;
	if (ext === ".ps1") {
		return `irm ${url} | iex`;
	}
	return `curl -fsSL ${url} | bash`;
}

/**
 * Split a Markdown file into frontmatter YAML string and body text.
 * Returns null if the file does not start with a `---` fence.
 */
function splitFrontmatter(
	text: string,
): { yamlStr: string; body: string } | null {
	const fencePattern = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
	const match = text.match(fencePattern);
	if (!match) return null;
	return { yamlStr: match[1], body: match[2] };
}

// ─── Real-filesystem deps ─────────────────────────────────────────────────────

/**
 * Recursively collect all .md files under a directory, yielding paths
 * relative to that base directory.
 */
async function* collectMdFiles(
	baseDir: string,
	subDir = "",
): AsyncIterable<string> {
	const entries = await readdir(join(baseDir, subDir), {
		withFileTypes: true,
	});
	for (const entry of entries) {
		const rel = subDir ? `${subDir}/${entry.name}` : entry.name;
		if (entry.isDirectory()) {
			yield* collectMdFiles(baseDir, rel);
		} else if (entry.name.endsWith(".md")) {
			yield rel;
		}
	}
}

/**
 * Read a file as text. Uses Bun.file() when available (production / bun run),
 * falls back to node:fs/promises readFile when running under Vitest/Node.
 */
function readFileCompat(path: string): Promise<string> {
	if (typeof Bun !== "undefined") {
		return Bun.file(path).text();
	}
	return fsReadFile(path, "utf8");
}

/** Default production deps using Bun-native file I/O where available */
export const defaultDeps = (scriptsDir: string): LoadScriptsDeps => ({
	scriptsDir,
	readFile: readFileCompat,
	glob: async function* (_pattern: string, dir: string) {
		yield* collectMdFiles(dir);
	},
});

// ─── loadScripts ─────────────────────────────────────────────────────────────

/**
 * Reads all spec files from the `scripts/` directory at build time.
 * Skips specs with missing required frontmatter fields (no build error).
 * Returns Script[] sorted by platform, then title.
 *
 * Pass `deps` to override filesystem behaviour in unit tests.
 * When called without `deps`, uses Bun-native APIs against the real
 * `scripts/` folder at the repo root (3 levels above this module).
 */
export async function loadScripts(deps?: LoadScriptsDeps): Promise<Script[]> {
	const resolvedDeps =
		deps ??
		defaultDeps(
			// Navigate from lib/ → scriptor-web/ → 20_Applications/ → repo root → scripts/
			resolve(dirname(fileURLToPath(import.meta.url)), "../../..", "scripts"),
		);

	const { glob, readFile, scriptsDir } = resolvedDeps;

	const scripts: Script[] = [];

	let paths: AsyncIterable<string>;
	try {
		paths = glob("**/*.md", scriptsDir);
	} catch {
		console.warn("[loadScripts] scripts/ directory not found — returning []");
		return [];
	}

	for await (const relPath of paths) {
		const absSpecPath = `${scriptsDir}/${relPath}`;

		let text: string;
		try {
			text = await readFile(absSpecPath);
		} catch (err) {
			console.warn(
				`[loadScripts] Could not read ${absSpecPath}: ${(err as Error).message}`,
			);
			continue;
		}

		let fm: SpecFrontmatter;
		let body: string;
		try {
			const split = splitFrontmatter(text);
			if (!split) {
				console.warn(
					`[loadScripts] No frontmatter found in ${relPath} — skipping`,
				);
				continue;
			}
			fm = (yaml.load(split.yamlStr) as SpecFrontmatter) ?? {};
			body = split.body.trim();
		} catch (err) {
			console.warn(
				`[loadScripts] Failed to parse frontmatter in ${relPath}: ${(err as Error).message} — skipping`,
			);
			continue;
		}

		// Validate required fields
		if (typeof fm.platform !== "string" || !fm.platform) {
			console.warn(
				`[loadScripts] Skipping script ${relPath}: missing required field 'platform'`,
			);
			continue;
		}

		if (typeof fm.title !== "string" || !fm.title) {
			console.warn(
				`[loadScripts] Skipping script ${relPath}: missing required field 'title'`,
			);
			continue;
		}

		const id = idFromRelPath(relPath);

		let source = "";
		let runCommand = "";

		for (const ext of [".sh", ".ps1"] as const) {
			try {
				source = await readFile(`${scriptsDir}/${id}${ext}`);
				runCommand = buildRunCommand(id, ext);
				break;
			} catch {
				// Try next extension
			}
		}

		scripts.push({
			id,
			title: fm.title,
			description: typeof fm.description === "string" ? fm.description : "",
			platform: fm.platform,
			body,
			source,
			runCommand,
		});
	}

	// Sort by platform, then title
	scripts.sort((a, b) => {
		if (a.platform !== b.platform) return a.platform.localeCompare(b.platform);
		return a.title.localeCompare(b.title);
	});

	return scripts;
}
