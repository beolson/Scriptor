import { load } from "js-yaml";
import { type InputDef, InputDefArraySchema } from "../inputs/inputSchema";

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
	inputs: InputDef[];
	requires_sudo: boolean;
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

	// requires_sudo — optional, defaults to false
	let requires_sudo = false;
	if ("requires_sudo" in entry && entry.requires_sudo !== undefined) {
		if (typeof entry.requires_sudo !== "boolean") {
			throw new Error(
				`Entry at index ${index} field "requires_sudo" must be a boolean`,
			);
		}
		if (entry.requires_sudo === true && platform === "windows") {
			throw new Error(
				`Entry at index ${index} must not use "requires_sudo" on platform: windows (use #Requires -RunAsAdministrator instead)`,
			);
		}
		requires_sudo = entry.requires_sudo;
	}

	// inputs — optional, defaults to []; validated via Zod
	let inputs: InputDef[] = [];
	if ("inputs" in entry && entry.inputs !== undefined) {
		const parsed = InputDefArraySchema.safeParse(entry.inputs);
		if (!parsed.success) {
			throw new Error(
				`Entry at index ${index} has invalid "inputs": ${parsed.error.message}`,
			);
		}
		inputs = parsed.data;

		// Detect duplicate input ids within this script (FR-3-033)
		const seenIds = new Set<string>();
		for (const input of inputs) {
			if (seenIds.has(input.id)) {
				throw new Error(
					`Entry at index ${index} has duplicate input id: "${input.id}"`,
				);
			}
			seenIds.add(input.id);
		}
	}

	const result: ScriptEntry = {
		id: entry.id as string,
		name: entry.name as string,
		description: entry.description as string,
		platform,
		arch: entry.arch as "x86" | "arm",
		script: entry.script as string,
		dependencies,
		inputs,
		requires_sudo,
	};

	if (platform === "linux") {
		result.distro = entry.distro as string;
		result.version = String(entry.version);
	}

	return result;
}

/**
 * Returns the `InputDef[]` for a given script id from a parsed manifest.
 * Returns an empty array if the script is not found or has no inputs.
 */
export function getInputsForScript(
	scriptId: string,
	entries: ScriptEntry[],
): InputDef[] {
	const entry = entries.find((e) => e.id === scriptId);
	return entry?.inputs ?? [];
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
