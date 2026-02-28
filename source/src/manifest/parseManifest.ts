import { load } from "js-yaml";

export interface ScriptEntry {
	id: string;
	name: string;
	description: string;
	platform: "windows" | "linux" | "mac";
	arch: "x86" | "arm";
	script: string;
	distro?: string;
	version?: string;
	dependencies: string[];
}

const VALID_PLATFORMS = new Set(["windows", "linux", "mac"]);
const VALID_ARCHES = new Set(["x86", "arm"]);

function validateEntry(raw: unknown, index: number): ScriptEntry {
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
		throw new Error(`Entry at index ${index} must be an object`);
	}

	const entry = raw as Record<string, unknown>;

	// Required string fields
	for (const field of ["id", "name", "description", "script"] as const) {
		if (typeof entry[field] !== "string" || entry[field] === "") {
			throw new Error(
				`Entry at index ${index} is missing required field: "${field}"`,
			);
		}
	}

	// platform enum
	if (!VALID_PLATFORMS.has(entry.platform as string)) {
		throw new Error(
			`Entry at index ${index} has invalid platform: "${entry.platform}". Must be one of: windows, linux, mac`,
		);
	}

	// arch enum
	if (!VALID_ARCHES.has(entry.arch as string)) {
		throw new Error(
			`Entry at index ${index} has invalid arch: "${entry.arch}". Must be one of: x86, arm`,
		);
	}

	const platform = entry.platform as "windows" | "linux" | "mac";
	const hasDistro = "distro" in entry && entry.distro !== undefined;
	const hasVersion = "version" in entry && entry.version !== undefined;

	if (platform === "linux") {
		if (!hasDistro) {
			throw new Error(
				`Entry at index ${index} (platform: linux) is missing required field: "distro"`,
			);
		}
		if (!hasVersion) {
			throw new Error(
				`Entry at index ${index} (platform: linux) is missing required field: "version"`,
			);
		}
	} else {
		if (hasDistro) {
			throw new Error(
				`Entry at index ${index} (platform: ${platform}) must not have "distro" — it is Linux-only`,
			);
		}
		if (hasVersion) {
			throw new Error(
				`Entry at index ${index} (platform: ${platform}) must not have "version" — it is Linux-only`,
			);
		}
	}

	// dependencies — optional, defaults to []
	let dependencies: string[] = [];
	if ("dependencies" in entry && entry.dependencies !== undefined) {
		if (!Array.isArray(entry.dependencies)) {
			throw new Error(
				`Entry at index ${index} field "dependencies" must be a list of id strings`,
			);
		}
		dependencies = entry.dependencies as string[];
	}

	const result: ScriptEntry = {
		id: entry.id as string,
		name: entry.name as string,
		description: entry.description as string,
		platform,
		arch: entry.arch as "x86" | "arm",
		script: entry.script as string,
		dependencies,
	};

	if (platform === "linux") {
		result.distro = entry.distro as string;
		result.version = String(entry.version);
	}

	return result;
}

/**
 * Parses a `scriptor.yaml` string into a validated array of ScriptEntry objects.
 *
 * Throws a descriptive error for any schema violation.
 */
export function parseManifest(yaml: string): ScriptEntry[] {
	const parsed = load(yaml);

	if (!Array.isArray(parsed)) {
		throw new Error(
			`scriptor.yaml must contain a YAML array at the top level, got: ${typeof parsed}`,
		);
	}

	return parsed.map((entry, i) => validateEntry(entry, i));
}
