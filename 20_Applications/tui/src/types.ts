export interface HostInfo {
	osName?: string;
	osVersion?: string;
	arch: "x64" | "arm";
}

export interface Os {
	name: string;
	version?: string;
	arch: "x64" | "arm";
}

export interface InputDef {
	id: string;
	type: "string" | "number" | "ssl-cert";
	label: string;
	required?: boolean;
	default?: string;
	download_path?: string;
	format?: string;
	[key: string]: unknown;
}

export interface ScriptEntry {
	id: string;
	name: string;
	description: string;
	os: Os;
	script: string;
	requires_elevation?: boolean;
	dependencies?: string[];
	run_after?: string[];
	run_if?: string[];
	creates?: string[];
	inputs?: InputDef[];
}

export interface GroupEntry {
	id: string;
	name: string;
	description: string;
	scripts: string[];
}

export interface Repo {
	owner: string;
	name: string;
}

export interface Config {
	repo?: string;
}

export interface CollectedInput {
	value: string;
	certCN?: string;
}

export type ScriptInputs = Map<string, CollectedInput>;

export interface ManifestResult {
	repo: Repo;
	manifest: string;
	host: HostInfo;
	localRoot?: string;
}

export interface ScriptSelectionResult {
	orderedScripts: ScriptEntry[];
	inputs: ScriptInputs;
	installedIds: Set<string>;
}

export type PreExecutionResult = ScriptSelectionResult;

export type ScriptRunResult =
	| { success: true }
	| { success: false; failedScript: ScriptEntry; exitCode: number };

export class ManifestValidationError extends Error {
	readonly errors: string[];

	constructor(errors: string[]) {
		super(`Manifest validation failed with ${errors.length} error(s)`);
		this.errors = errors;
		this.name = "ManifestValidationError";
		Object.setPrototypeOf(this, new.target.prototype);
	}
}
