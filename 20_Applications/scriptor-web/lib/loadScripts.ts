import { readFile as fsReadFile, readdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import type { Arch, Platform, Script } from "./types.js";

// ─── Dependency injection types ───────────────────────────────────────────────

/**
 * Injectable dependencies for loadScripts — allows unit tests to supply
 * in-memory fixtures instead of hitting the real filesystem.
 */
export interface LoadScriptsDeps {
	/** Returns relative paths (from scriptsDir) of all .md files under scripts/ */
	glob: (pattern: string) => Promise<string[]>;
	/** Reads a file by absolute path and returns its text contents */
	readFile: (absolutePath: string) => Promise<string>;
	/** Returns true if a file exists at the given absolute path */
	fileExists: (absolutePath: string) => Promise<boolean>;
	/** Absolute path to the scripts root directory */
	scriptsDir: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RAW_BASE =
	"https://raw.githubusercontent.com/beolson/Scriptor/main/scripts";

// ─── Frontmatter shape ────────────────────────────────────────────────────────

interface SpecFrontmatter {
	platform?: unknown;
	os?: unknown;
	arch?: unknown;
	title?: unknown;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Derive the script id from a relative spec path (strips .md extension) */
function idFromRelPath(relPath: string): string {
	return relPath.replace(/\.md$/, "");
}

/** Return the extension for the script source file based on platform */
function sourceExt(platform: Platform): string {
	return platform === "windows" ? ".ps1" : ".sh";
}

/** Build the one-liner run command for a given script id and platform */
function buildRunCommand(id: string, platform: Platform): string {
	const ext = sourceExt(platform);
	const url = `${RAW_BASE}/${id}${ext}`;
	if (platform === "windows") {
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
 * Recursively collect all .md files under a directory, returning paths
 * relative to that base directory. Uses Node.js fs APIs so it works in both
 * Bun and the Vitest/Node environment used for integration tests.
 */
async function collectMdFiles(baseDir: string, subDir = ""): Promise<string[]> {
	const results: string[] = [];
	const entries = await readdir(join(baseDir, subDir), {
		withFileTypes: true,
	});
	for (const entry of entries) {
		const rel = subDir ? `${subDir}/${entry.name}` : entry.name;
		if (entry.isDirectory()) {
			const nested = await collectMdFiles(baseDir, rel);
			results.push(...nested);
		} else if (entry.name.endsWith(".md")) {
			results.push(rel);
		}
	}
	return results;
}

/** Build the real filesystem deps using Node.js APIs (works in Bun and Node) */
function makeNodeDeps(scriptsDir: string): LoadScriptsDeps {
	return {
		scriptsDir,
		glob: (_pattern: string) => collectMdFiles(scriptsDir),
		readFile: async (absolutePath: string) => fsReadFile(absolutePath, "utf8"),
		fileExists: async (absolutePath: string) => {
			try {
				await stat(absolutePath);
				return true;
			} catch {
				return false;
			}
		},
	};
}

// ─── loadScripts ─────────────────────────────────────────────────────────────

/**
 * Reads all spec files from the `scripts/` directory at build time.
 * Skips specs with missing required frontmatter fields (no build error).
 * Returns Script[] sorted by platform, then os, then title.
 *
 * Pass `deps` to override filesystem behaviour in unit tests.
 * When called without `deps`, uses Node.js fs APIs against the real
 * `scripts/` folder at the repo root (3 levels above this module).
 */
export async function loadScripts(deps?: LoadScriptsDeps): Promise<Script[]> {
	const resolvedDeps =
		deps ??
		makeNodeDeps(
			// Navigate from lib/ → scriptor-web/ → 20_Applications/ → repo root → scripts/
			resolve(dirname(fileURLToPath(import.meta.url)), "../../..", "scripts"),
		);

	const { glob, readFile, fileExists, scriptsDir } = resolvedDeps;

	let relPaths: string[];
	try {
		relPaths = await glob("**/*.md");
	} catch {
		console.warn("[loadScripts] scripts/ directory not found — returning []");
		return [];
	}

	const scripts: Script[] = [];

	for (const relPath of relPaths) {
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
		if (
			typeof fm.platform !== "string" ||
			typeof fm.os !== "string" ||
			typeof fm.title !== "string" ||
			!fm.platform ||
			!fm.os ||
			!fm.title
		) {
			console.warn(
				`[loadScripts] Missing required frontmatter fields in ${relPath} — skipping`,
			);
			continue;
		}

		const platform = fm.platform as Platform;
		const id = idFromRelPath(relPath);
		const ext = sourceExt(platform);
		const absSourcePath = `${scriptsDir}/${id}${ext}`;

		let source = "";
		let runCommand = "";

		const sourceExists = await fileExists(absSourcePath);
		if (sourceExists) {
			try {
				source = await readFile(absSourcePath);
				runCommand = buildRunCommand(id, platform);
			} catch (err) {
				console.warn(
					`[loadScripts] Could not read source ${absSourcePath}: ${(err as Error).message}`,
				);
			}
		}

		const arch =
			typeof fm.arch === "string" && fm.arch ? (fm.arch as Arch) : undefined;

		scripts.push({
			id,
			title: fm.title,
			platform,
			os: fm.os,
			...(arch !== undefined ? { arch } : {}),
			body,
			source,
			runCommand,
		});
	}

	// Sort by platform, then os, then title
	scripts.sort((a, b) => {
		if (a.platform !== b.platform) return a.platform.localeCompare(b.platform);
		if (a.os !== b.os) return a.os.localeCompare(b.os);
		return a.title.localeCompare(b.title);
	});

	return scripts;
}
