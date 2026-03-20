import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CORE_SCHEMA, load } from "js-yaml";
import type { Input, Script } from "./types";

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
	inputs?: unknown;
};

/**
 * Parse and validate the inputs array from a raw YAML entry.
 * Skips entries that are missing required fields (id, type, label).
 */
function parseInputs(raw: unknown): Input[] | undefined {
	if (!Array.isArray(raw)) return undefined;

	const valid = raw
		.filter((item): item is Record<string, unknown> => {
			if (item === null || typeof item !== "object") return false;
			const obj = item as Record<string, unknown>;
			return (
				typeof obj.id === "string" &&
				obj.id !== "" &&
				typeof obj.type === "string" &&
				obj.type !== "" &&
				typeof obj.label === "string" &&
				obj.label !== ""
			);
		})
		.map((item): Input => {
			const input: Input = {
				id: String(item.id),
				type: String(item.type),
				label: String(item.label),
			};
			if (item.required !== undefined) input.required = Boolean(item.required);
			if (item.default !== undefined) input.default = String(item.default);
			if (item.download_path !== undefined)
				input.download_path = String(item.download_path);
			if (item.format !== undefined) input.format = String(item.format);
			return input;
		});

	return valid.length > 0 ? valid : undefined;
}

/**
 * Read the contents of a file, returning undefined if it does not exist.
 */
function readFileIfExists(filePath: string): string | undefined {
	if (existsSync(filePath)) {
		return readFileSync(filePath, "utf-8");
	}
	return undefined;
}

/**
 * Parse a YAML string and return a typed Script array.
 * Accepts an optional yaml string for testing; reads from disk when omitted.
 * When basePath is provided, .spec.md and script source files are resolved
 * relative to it. Otherwise they are resolved relative to the repo root.
 */
export function loadScripts(yamlContent?: string, basePath?: string): Script[] {
	if (yamlContent === undefined && _cache) return _cache;

	let content: string;
	let resolvedBasePath: string;

	if (yamlContent !== undefined) {
		content = yamlContent;
		resolvedBasePath = basePath ?? "";
	} else {
		const yamlPath = resolve(process.cwd(), "../scriptor.yaml");
		content = readFileSync(yamlPath, "utf-8");
		resolvedBasePath = basePath ?? resolve(process.cwd(), "..");
	}

	const parsed = load(content, { schema: CORE_SCHEMA });

	if (!Array.isArray(parsed)) {
		return [];
	}

	const result = parsed
		.filter(
			(entry): entry is RawEntry => entry !== null && typeof entry === "object",
		)
		.map((entry): Script => {
			const scriptPath = String(entry.script ?? "");

			// Read .spec.md file from disk (ignoring YAML spec field)
			let spec: string | undefined;
			let scriptSource: string | undefined;
			if (resolvedBasePath && scriptPath) {
				const fullScriptPath = resolve(resolvedBasePath, scriptPath);
				const specFilePath = `${fullScriptPath}.spec.md`;
				spec = readFileIfExists(specFilePath);
				scriptSource = readFileIfExists(fullScriptPath);
			}

			return {
				id: String(entry.id ?? ""),
				name: String(entry.name ?? ""),
				description: String(entry.description ?? ""),
				spec,
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
				script: scriptPath,
				scriptSource,
				inputs: parseInputs(entry.inputs),
			};
		});

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
