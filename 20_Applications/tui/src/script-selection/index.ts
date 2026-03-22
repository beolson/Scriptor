// ---------------------------------------------------------------------------
// Script Selection Orchestrator
//
// Sequences the full script-selection phase:
//   1. Parse manifest YAML → Manifest
//   2. Filter by host → ScriptEntry[]
//   3. If empty → showNoScripts (exits)
//   4. Check installed status via creates field
//   5. Build group list
//   6. Show main menu → get selection
//   7. If group → run set = non-installed entries in that group
//      If "individual" → showIndividualSelect → run set = user-picked entries
//   8. Resolve dependencies → ordered IDs
//   9. On MissingDependencyError/CircularDependencyError → log.error + exit(1)
//  10. Return ScriptSelectionResult
//
// All deps are injectable for testability.
// ---------------------------------------------------------------------------

import type { HostInfo } from "../host/types.js";
import type {
	Manifest,
	ScriptEntry,
	ScriptSelectionResult,
} from "../manifest/types.js";
import {
	CircularDependencyError,
	MissingDependencyError,
} from "../manifest/types.js";
import type { ManifestResult } from "../startup/orchestrator.js";

// ---------------------------------------------------------------------------
// Injectable deps
// ---------------------------------------------------------------------------

export interface ScriptSelectionDeps {
	/** Parse raw YAML into a Manifest array. */
	parseManifest: (rawYaml: string) => Manifest;
	/** Filter manifest entries to only those compatible with the host. */
	filterManifest: (manifest: Manifest, host: HostInfo) => ScriptEntry[];
	/** Resolve and topologically sort the selected script IDs. */
	resolveDependencies: (
		selectedIds: string[],
		available: ScriptEntry[],
	) => string[];
	/** Warn + exit when no scripts match the host. Never returns. */
	showNoScripts: (hostLabel: string) => never;
	/** Present the main menu; returns group name or "individual". */
	showMainMenu: (groups: string[]) => Promise<"individual" | string>;
	/** Present the multi-select list; returns selected IDs. */
	showIndividualSelect: (scripts: ScriptEntry[]) => Promise<string[]>;
	/** Synchronous filesystem existence check. */
	existsSync: (path: string) => boolean;
	/** Returns the current user's home directory path. */
	homedir: () => string;
	/** Logging interface. */
	log: {
		error: (message: string) => void;
	};
	/** Process exit, injectable for tests. */
	exit: (code: number) => never;
}

// ---------------------------------------------------------------------------
// Default deps (wired to real implementations)
// ---------------------------------------------------------------------------

function makeDefaultDeps(): ScriptSelectionDeps {
	return {
		parseManifest: (rawYaml: string) => {
			const { parseManifest } =
				require("../manifest/parseManifest.js") as typeof import("../manifest/parseManifest.js");
			return parseManifest(rawYaml);
		},
		filterManifest: (manifest: Manifest, host: HostInfo) => {
			const { filterManifest } =
				require("../manifest/filterManifest.js") as typeof import("../manifest/filterManifest.js");
			return filterManifest(manifest, host);
		},
		resolveDependencies: (selectedIds: string[], available: ScriptEntry[]) => {
			const { resolveDependencies } =
				require("../manifest/resolveDependencies.js") as typeof import("../manifest/resolveDependencies.js");
			return resolveDependencies(selectedIds, available);
		},
		showNoScripts: (hostLabel: string): never => {
			const { showNoScripts } =
				require("./screens.js") as typeof import("./screens.js");
			return showNoScripts(hostLabel);
		},
		showMainMenu: async (groups: string[]) => {
			const { showMainMenu } = await import("./screens.js");
			return showMainMenu(groups);
		},
		showIndividualSelect: async (scripts: ScriptEntry[]) => {
			const { showIndividualSelect } = await import("./screens.js");
			return showIndividualSelect(scripts);
		},
		existsSync: (path: string) => {
			const { existsSync } = require("node:fs") as typeof import("node:fs");
			return existsSync(path);
		},
		homedir: () => {
			const { homedir } = require("node:os") as typeof import("node:os");
			return homedir();
		},
		log: {
			error: (message: string) => {
				console.error(message);
			},
		},
		exit: (code: number): never => process.exit(code),
	};
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Expands a leading `~` in `path` to the user's home directory.
 */
function expandTilde(path: string, home: string): string {
	if (path === "~") return home;
	if (path.startsWith("~/")) return `${home}${path.slice(1)}`;
	return path;
}

/**
 * Returns a human-readable host label from the manifest result.
 */
function buildHostLabel(result: ManifestResult): string {
	const { platform, arch, distro, version } = result.host;
	const parts: string[] = [`${platform}/${arch}`];
	if (distro) parts.push(distro);
	if (version) parts.push(version);
	return parts.join("/");
}

// ---------------------------------------------------------------------------
// runScriptSelection
// ---------------------------------------------------------------------------

/**
 * Runs the full script-selection sequence and returns a `ScriptSelectionResult`.
 *
 * Exits via `deps.exit(1)` on unrecoverable errors (missing dep, circular dep).
 * Exits via `deps.showNoScripts()` when no scripts match the host.
 */
export async function runScriptSelection(
	manifestResult: ManifestResult,
	deps: ScriptSelectionDeps = makeDefaultDeps(),
): Promise<ScriptSelectionResult> {
	// -------------------------------------------------------------------------
	// Step 1: Parse manifest YAML
	// -------------------------------------------------------------------------
	const manifest = deps.parseManifest(manifestResult.manifest);

	// -------------------------------------------------------------------------
	// Step 2: Filter by host
	// -------------------------------------------------------------------------
	const filtered = deps.filterManifest(manifest, manifestResult.host);

	// -------------------------------------------------------------------------
	// Step 3: If empty → show no-scripts warning and exit
	// -------------------------------------------------------------------------
	if (filtered.length === 0) {
		const hostLabel = buildHostLabel(manifestResult);
		deps.showNoScripts(hostLabel);
		// showNoScripts never returns — this line is unreachable
	}

	// -------------------------------------------------------------------------
	// Step 4: Check installed status for entries with a `creates` field
	// -------------------------------------------------------------------------
	const home = deps.homedir();
	const installedIds = new Set<string>();

	for (const entry of filtered) {
		if (entry.creates !== undefined) {
			const expanded = expandTilde(entry.creates, home);
			const exists = deps.existsSync(expanded);
			entry.installed = exists;
			if (exists) {
				installedIds.add(entry.id);
			}
		}
	}

	// -------------------------------------------------------------------------
	// Step 5: Build deduplicated group list (preserving insertion order)
	// -------------------------------------------------------------------------
	const groups: string[] = [];
	const seenGroups = new Set<string>();
	for (const entry of filtered) {
		if (entry.group && !seenGroups.has(entry.group)) {
			seenGroups.add(entry.group);
			groups.push(entry.group);
		}
	}

	// -------------------------------------------------------------------------
	// Step 6: Show main menu
	// -------------------------------------------------------------------------
	const menuSelection = await deps.showMainMenu(groups);

	// -------------------------------------------------------------------------
	// Step 7: Determine the run set
	// -------------------------------------------------------------------------
	let runSetIds: string[];

	if (menuSelection === "individual") {
		// User picks individual scripts; installed scripts may also be re-selected.
		runSetIds = await deps.showIndividualSelect(filtered);
	} else {
		// Group was chosen — run set is the non-installed entries in that group.
		runSetIds = filtered
			.filter((e) => e.group === menuSelection && !e.installed)
			.map((e) => e.id);
	}

	// -------------------------------------------------------------------------
	// Step 8+9: Resolve dependencies → ordered IDs; catch dep errors
	// -------------------------------------------------------------------------
	let orderedIds: string[];
	try {
		orderedIds = deps.resolveDependencies(runSetIds, filtered);
	} catch (err) {
		if (
			err instanceof MissingDependencyError ||
			err instanceof CircularDependencyError
		) {
			deps.log.error(err.message);
			deps.exit(1);
		}
		throw err;
	}

	// -------------------------------------------------------------------------
	// Step 10: Build ordered ScriptEntry array and return result
	// -------------------------------------------------------------------------
	const filteredById = new Map<string, ScriptEntry>(
		filtered.map((e) => [e.id, e]),
	);

	const orderedScripts: ScriptEntry[] = orderedIds
		.map((id) => filteredById.get(id))
		.filter((e): e is ScriptEntry => e !== undefined);

	return {
		orderedScripts,
		inputs: new Map(),
		installedIds,
	};
}
