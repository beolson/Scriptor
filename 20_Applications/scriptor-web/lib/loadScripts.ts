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
	/** Yields relative paths (from scriptsDir) of all .sh and .ps1 files under scripts/ */
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
	group?: unknown;
	group_order?: unknown;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Derive the script id from a relative script path (strips .sh or .ps1 extension) */
function idFromRelPath(relPath: string): string {
	return relPath.replace(/\.(sh|ps1)$/, "");
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
 * Split text into frontmatter YAML string and body text.
 * Returns null if the text does not start with a `---` fence.
 */
function splitFrontmatter(
	text: string,
): { yamlStr: string; body: string } | null {
	const fencePattern = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
	const match = text.match(fencePattern);
	if (!match) return null;
	return { yamlStr: match[1], body: match[2] };
}

/**
 * Extract the embedded spec from a .sh script file.
 *
 * Expects a block of `# ` line comments starting with `# ---` immediately
 * after the optional shebang line. Strips the `# ` prefix from each line and
 * returns the result ready for splitFrontmatter(), or null if no spec block
 * is found.
 */
function extractShSpec(content: string): string | null {
	const lines = content.split("\n");
	let i = 0;

	// Skip shebang
	if (lines[0]?.startsWith("#!")) i = 1;

	// Must start with `# ---`
	if (lines[i] !== "# ---") return null;

	const specLines: string[] = [];
	while (i < lines.length) {
		const line = lines[i];
		if (line.startsWith("# ")) {
			specLines.push(line.slice(2));
			i++;
		} else if (line === "#") {
			specLines.push("");
			i++;
		} else {
			break;
		}
	}

	return specLines.join("\n");
}

/**
 * Extract the embedded spec from a .ps1 script file.
 *
 * Expects a `<# ... #>` block comment at the top of the file. Returns the
 * block content trimmed and ready for splitFrontmatter(), or null if no block
 * comment is found at the start.
 */
function extractPs1Spec(content: string): string | null {
	if (!content.startsWith("<#")) return null;
	const end = content.indexOf("#>");
	if (end === -1) return null;
	return content.slice(2, end).trim();
}

/**
 * Dispatch to the correct spec extractor based on file extension.
 */
function extractEmbeddedSpec(
	content: string,
	ext: ".sh" | ".ps1",
): string | null {
	return ext === ".ps1" ? extractPs1Spec(content) : extractShSpec(content);
}

// ─── Real-filesystem deps ─────────────────────────────────────────────────────

/**
 * Recursively collect all .sh and .ps1 files under a directory, yielding paths
 * relative to that base directory.
 */
async function* collectScriptFiles(
	baseDir: string,
	subDir = "",
): AsyncIterable<string> {
	const entries = await readdir(join(baseDir, subDir), {
		withFileTypes: true,
	});
	for (const entry of entries) {
		const rel = subDir ? `${subDir}/${entry.name}` : entry.name;
		if (entry.isDirectory()) {
			yield* collectScriptFiles(baseDir, rel);
		} else if (entry.name.endsWith(".sh") || entry.name.endsWith(".ps1")) {
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
		yield* collectScriptFiles(dir);
	},
});

// ─── loadScripts ─────────────────────────────────────────────────────────────

/**
 * Reads all script files from the `scripts/` directory at build time.
 * Parses the embedded spec block (comment at the top of each file) for metadata.
 * Skips scripts with no spec block or missing required frontmatter fields.
 * Returns Script[] sorted by platform, then title.
 *
 * Pass `deps` to override filesystem behaviour in unit tests.
 * When called without `deps`, uses Bun-native APIs against the real
 * `scripts/` folder at the repo root (3 levels above this module).
 */
// Navigate from lib/ → scriptor-web/ → 20_Applications/ → repo root
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

// Allow SCRIPTS_DIR env var to override the default scripts/ folder (e.g. for testing)
// process.env is used (not Bun.env) because this module also runs under Vitest/Node.
const defaultScriptsDir = process.env.SCRIPTS_DIR
	? resolve(repoRoot, process.env.SCRIPTS_DIR)
	: resolve(repoRoot, "scripts");

export async function loadScripts(deps?: LoadScriptsDeps): Promise<Script[]> {
	const resolvedDeps = deps ?? defaultDeps(defaultScriptsDir);

	const { glob, readFile, scriptsDir } = resolvedDeps;

	const scripts: Script[] = [];

	let paths: AsyncIterable<string>;
	try {
		paths = glob("**/*.{sh,ps1}", scriptsDir);
	} catch {
		console.warn("[loadScripts] scripts/ directory not found — returning []");
		return [];
	}

	for await (const relPath of paths) {
		const ext: ".sh" | ".ps1" = relPath.endsWith(".ps1") ? ".ps1" : ".sh";
		const absPath = `${scriptsDir}/${relPath}`;

		let content: string;
		try {
			content = await readFile(absPath);
		} catch (err) {
			console.warn(
				`[loadScripts] Could not read ${absPath}: ${(err as Error).message}`,
			);
			continue;
		}

		const specText = extractEmbeddedSpec(content, ext);
		if (!specText) {
			console.warn(
				`[loadScripts] No embedded spec block found in ${relPath} — skipping`,
			);
			continue;
		}

		let fm: SpecFrontmatter;
		let body: string;
		try {
			const split = splitFrontmatter(specText);
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

		// Parse optional group field — must be a non-empty string
		let group: string | undefined;
		if (fm.group !== undefined) {
			if (typeof fm.group === "string" && fm.group.length > 0) {
				group = fm.group;
			} else {
				console.warn(
					`[loadScripts] Script ${relPath}: 'group' field is not a string — ignoring`,
				);
			}
		}

		// Parse optional group_order field — must be a finite integer
		let groupOrder: number | undefined;
		if (fm.group_order !== undefined) {
			const raw = fm.group_order;
			if (
				typeof raw === "number" &&
				Number.isFinite(raw) &&
				Number.isInteger(raw)
			) {
				groupOrder = raw;
			}
			// Non-integer or non-number values silently default to undefined (sorts last)
		}

		scripts.push({
			id,
			title: fm.title,
			description: typeof fm.description === "string" ? fm.description : "",
			platform: fm.platform,
			body,
			source: content,
			runCommand: buildRunCommand(id, ext),
			...(group !== undefined ? { group } : {}),
			...(groupOrder !== undefined ? { groupOrder } : {}),
		});
	}

	// Sort by platform, then title
	scripts.sort((a, b) => {
		if (a.platform !== b.platform) return a.platform.localeCompare(b.platform);
		return a.title.localeCompare(b.title);
	});

	return scripts;
}
