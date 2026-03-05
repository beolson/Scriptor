import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CORE_SCHEMA, load } from "js-yaml";
import type { Script } from "./types";

const PLATFORMS = ["windows", "linux", "mac"] as const;
const ARCHES = ["x86", "arm"] as const;

let _cache: Script[] | null = null;

type RawEntry = {
	id?: unknown;
	name?: unknown;
	description?: unknown;
	spec?: unknown;
	platform?: unknown;
	arch?: unknown;
	distro?: unknown;
	version?: unknown;
	dependencies?: unknown;
	script?: unknown;
};

/**
 * Parse a YAML string and return a typed Script array.
 * Accepts an optional yaml string for testing; reads from disk when omitted.
 */
export function loadScripts(yamlContent?: string): Script[] {
	if (yamlContent === undefined && _cache) return _cache;

	let content: string;

	if (yamlContent !== undefined) {
		content = yamlContent;
	} else {
		const yamlPath = resolve(process.cwd(), "../scriptor.yaml");
		content = readFileSync(yamlPath, "utf-8");
	}

	const parsed = load(content, { schema: CORE_SCHEMA });

	if (!Array.isArray(parsed)) {
		return [];
	}

	const result = parsed
		.filter(
			(entry): entry is RawEntry => entry !== null && typeof entry === "object",
		)
		.map(
			(entry): Script => ({
				id: String(entry.id ?? ""),
				name: String(entry.name ?? ""),
				description: String(entry.description ?? ""),
				spec: entry.spec !== undefined ? String(entry.spec) : undefined,
				platform: PLATFORMS.includes(entry.platform as Script["platform"])
					? (entry.platform as Script["platform"])
					: "linux",
				arch: ARCHES.includes(entry.arch as Script["arch"])
					? (entry.arch as Script["arch"])
					: "x86",
				distro: entry.distro !== undefined ? String(entry.distro) : undefined,
				version:
					entry.version !== undefined ? String(entry.version) : undefined,
				dependencies: Array.isArray(entry.dependencies)
					? (entry.dependencies as unknown[]).map(String)
					: undefined,
				script: String(entry.script ?? ""),
			}),
		);

	if (yamlContent === undefined) _cache = result;
	return result;
}

export function getScriptsByPlatform(
	scripts: Script[],
	platform: Script["platform"],
): Script[] {
	return scripts.filter((s) => s.platform === platform);
}

export function getScriptById(
	scripts: Script[],
	id: string,
): Script | undefined {
	return scripts.find((s) => s.id === id);
}
