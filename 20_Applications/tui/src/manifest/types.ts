// ---------------------------------------------------------------------------
// Manifest Types
//
// Shared TypeScript types and error classes for the manifest module.
// Pure types only — no side effects, no external dependencies.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// InputDef
// ---------------------------------------------------------------------------

export interface InputDef {
	id: string;
	type: "string" | "number" | "ssl-cert";
	label: string;
	required?: boolean;
	default?: string;
	// Additional fields (e.g. download_path, format on ssl-cert) are preserved
	// via Zod .passthrough() — not validated, not typed here.
	[key: string]: unknown;
}

// ---------------------------------------------------------------------------
// ScriptEntry
// ---------------------------------------------------------------------------

export interface ScriptEntry {
	id: string;
	name: string;
	description: string;
	platform: "linux" | "mac" | "windows";
	arch: "x86" | "arm";
	script: string;
	/** Linux only. */
	distro?: string;
	/** Linux only. */
	version?: string;
	group?: string;
	/** Hard-ordered prerequisites. Default []. */
	dependencies: string[];
	/** Soft ordering — only applied if dependency is also in the run set. Default []. */
	optional_dependencies: string[];
	/** Default false. */
	requires_elevation: boolean;
	/** ~-expanded path for installed-status detection. */
	creates?: string;
	inputs: InputDef[];
	/**
	 * Set at runtime by the orchestrator after checking whether the `creates`
	 * path exists on disk. Not present in scriptor.yaml.
	 */
	installed?: boolean;
}

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

export type Manifest = ScriptEntry[];

// ---------------------------------------------------------------------------
// ScriptInputs (placeholder)
// ---------------------------------------------------------------------------

/** Placeholder for the future input-collection epic. */
export type ScriptInputs = Map<string, string>;

// ---------------------------------------------------------------------------
// ScriptSelectionResult
// ---------------------------------------------------------------------------

export interface ScriptSelectionResult {
	orderedScripts: ScriptEntry[];
	/** Always an empty Map in this epic. */
	inputs: ScriptInputs;
	/** IDs of all filtered entries whose creates path exists on disk. */
	installedIds: Set<string>;
}

// ---------------------------------------------------------------------------
// Error Classes
// ---------------------------------------------------------------------------

/**
 * Thrown when a `dependencies` entry references an ID not present in the
 * available script list (e.g. filtered out for this host).
 */
export class MissingDependencyError extends Error {
	override readonly name = "MissingDependencyError";

	constructor(message: string) {
		super(message);
		this.name = "MissingDependencyError";
	}
}

/**
 * Thrown when a cycle is detected in the `dependencies` graph.
 * Message format: `Circular dependency detected: A → B → A`
 */
export class CircularDependencyError extends Error {
	override readonly name = "CircularDependencyError";

	constructor(message: string) {
		super(message);
		this.name = "CircularDependencyError";
	}
}
