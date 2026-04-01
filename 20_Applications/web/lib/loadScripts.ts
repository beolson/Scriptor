import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "js-yaml";
import type { Input, Script } from "./types";

// ---------------------------------------------------------------------------
// Internal YAML shape (mirrors TUI manifest schema)
// ---------------------------------------------------------------------------

interface YamlInputDef {
	id: string;
	type: string;
	label: string;
	required?: boolean;
	default?: string;
	[key: string]: unknown;
}

interface YamlOs {
	name: string;
	version?: string;
	arch: string;
}

interface YamlScriptEntry {
	id: string;
	name: string;
	description: string;
	os: YamlOs;
	script: string;
	requires_elevation?: boolean;
	dependencies?: string[];
	inputs?: YamlInputDef[];
}

interface YamlManifest {
	scripts: YamlScriptEntry[];
}

// ---------------------------------------------------------------------------
// Platform derivation
// ---------------------------------------------------------------------------

/**
 * Derive the display `platform` string from `os.name`.
 * Defaults to "linux" for unrecognised values.
 */
function derivePlatform(osName: string): string {
	const lower = osName.toLowerCase();
	if (lower === "windows") return "windows";
	if (lower === "mac" || lower === "macos" || lower === "darwin") return "mac";
	if (
		lower.includes("linux") ||
		lower.includes("debian") ||
		lower.includes("ubuntu") ||
		lower.includes("fedora") ||
		lower.includes("arch") ||
		lower.includes("centos") ||
		lower.includes("rhel")
	) {
		return "linux";
	}
	return "linux";
}

/**
 * Normalise the `arch` value.
 * Defaults to "x86" for unrecognised values.
 */
function normaliseArch(arch: string): string {
	if (arch === "x64" || arch === "arm") return arch;
	return "x86";
}

// ---------------------------------------------------------------------------
// Deps type
// ---------------------------------------------------------------------------

export interface LoadScriptsDeps {
	/** Absolute path to the manifest YAML file. Defaults to <monorepo-root>/scriptor.yaml */
	manifestPath?: string;
	/** Absolute path to the repo root used to resolve script paths. Defaults to monorepo root. */
	repoRoot?: string;
}

/** Resolve the monorepo root relative to this file (web/lib → web → monorepo root). */
function defaultRepoRoot(): string {
	// This file lives at web/lib/loadScripts.ts → ../../ is the monorepo root
	const thisDir = dirname(fileURLToPath(import.meta.url));
	return join(thisDir, "..", "..");
}

// ---------------------------------------------------------------------------
// Core loader
// ---------------------------------------------------------------------------

async function loadAllScripts(deps: LoadScriptsDeps = {}): Promise<Script[]> {
	const repoRoot = deps.repoRoot ?? defaultRepoRoot();
	const manifestPath = deps.manifestPath ?? join(repoRoot, "scriptor.yaml");

	const yamlText = await readFile(manifestPath, "utf-8");
	const raw = load(yamlText) as YamlManifest;

	if (!raw || !Array.isArray(raw.scripts)) {
		return [];
	}

	const results: Script[] = [];

	for (const entry of raw.scripts) {
		// Basic shape guard — silently skip malformed entries
		if (
			typeof entry !== "object" ||
			entry === null ||
			typeof entry.id !== "string" ||
			typeof entry.name !== "string" ||
			typeof entry.description !== "string" ||
			typeof entry.script !== "string" ||
			typeof entry.os !== "object" ||
			entry.os === null ||
			typeof entry.os.name !== "string" ||
			typeof entry.os.arch !== "string"
		) {
			continue;
		}

		const scriptFilePath = join(repoRoot, entry.script);

		// Script file is required — throw with clear message if missing
		let scriptSource: string;
		try {
			scriptSource = await readFile(scriptFilePath, "utf-8");
		} catch {
			throw new Error(
				`Scriptor build error: script file not found: ${scriptFilePath} (referenced by manifest entry "${entry.id}")`,
			);
		}

		// Spec file is optional
		let spec: string | undefined;
		try {
			spec = await readFile(`${scriptFilePath}.spec.md`, "utf-8");
		} catch {
			spec = undefined;
		}

		// Map inputs — malformed entries silently skipped
		const inputs: Input[] = [];
		if (Array.isArray(entry.inputs)) {
			for (const raw of entry.inputs) {
				if (
					typeof raw === "object" &&
					raw !== null &&
					typeof raw.id === "string" &&
					typeof raw.type === "string" &&
					typeof raw.label === "string"
				) {
					inputs.push({
						id: raw.id,
						type: raw.type,
						label: raw.label,
						required:
							typeof raw.required === "boolean" ? raw.required : undefined,
						default: typeof raw.default === "string" ? raw.default : undefined,
					});
				}
			}
		}

		results.push({
			id: entry.id,
			name: entry.name,
			description: entry.description,
			platform: derivePlatform(entry.os.name),
			arch: normaliseArch(entry.os.arch),
			distro: entry.os.name,
			version: entry.os.version,
			script: entry.script,
			requires_elevation: entry.requires_elevation,
			dependencies: entry.dependencies,
			inputs,
			spec,
			scriptSource,
		});
	}

	return results;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns all scripts whose derived `platform` matches the given platform string.
 * If the platform is not recognised, returns linux scripts (default).
 */
export async function getScriptsByPlatform(
	platform: string,
	deps: LoadScriptsDeps = {},
): Promise<Script[]> {
	const all = await loadAllScripts(deps);
	const known = ["linux", "windows", "mac"];
	const effectivePlatform = known.includes(platform) ? platform : "linux";
	return all.filter((s) => s.platform === effectivePlatform);
}

/**
 * Returns the script with the given id, or undefined if not found.
 */
export async function getScriptById(
	id: string,
	deps: LoadScriptsDeps = {},
): Promise<Script | undefined> {
	const all = await loadAllScripts(deps);
	return all.find((s) => s.id === id);
}
