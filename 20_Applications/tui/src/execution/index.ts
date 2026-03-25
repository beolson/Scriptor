// ---------------------------------------------------------------------------
// Execution Orchestrator
//
// Top-level coordinator for the script execution phase:
//   1. Determines whether the sudo screen is needed (Unix + any elevation script).
//   2. Shows the sudo screen if required.
//   3. Delegates to runScripts and returns the ScriptRunResult.
//
// All deps are injectable for testability.
// ---------------------------------------------------------------------------

import type {
	PreExecutionResult,
	ScriptEntry,
	ScriptInputs,
	ScriptRunResult,
} from "../manifest/types.js";
import type { ManifestResult } from "../startup/orchestrator.js";

// ---------------------------------------------------------------------------
// ExecutionDeps
// ---------------------------------------------------------------------------

export interface ExecutionDeps {
	platform: string;
	showSudoScreen: () => Promise<void>;
	runScripts: (
		scripts: ScriptEntry[],
		inputs: ScriptInputs,
		installedIds: Set<string>,
	) => Promise<ScriptRunResult>;
	readScript: (entry: ScriptEntry) => Promise<string>;
}

// ---------------------------------------------------------------------------
// Default deps (wired to real implementations via lazy import)
// ---------------------------------------------------------------------------

function makeDefaultDeps(manifestResult: ManifestResult): ExecutionDeps {
	const readScript = async (entry: ScriptEntry): Promise<string> => {
		if (manifestResult.localRoot) {
			// Local mode: read directly from the git root
			const { readFile } =
				require("node:fs/promises") as typeof import("node:fs/promises");
			return readFile(`${manifestResult.localRoot}/${entry.script}`, "utf8");
		}
		// Cached mode: read from ~/.scriptor/cache/<owner>/<repo>/scripts/<key>
		// Strip leading "scripts/" from entry.script so the cache path matches
		// what cacheService writes.
		const { homedir } = require("node:os") as typeof import("node:os");
		const key = entry.script.replace(/^scripts\//, "");
		const cachePath = `${homedir()}/.scriptor/cache/${manifestResult.repo.owner}/${manifestResult.repo.name}/scripts/${key}`;
		const { readFile } =
			require("node:fs/promises") as typeof import("node:fs/promises");
		return readFile(cachePath, "utf8");
	};

	return {
		platform: process.platform,
		showSudoScreen: async () => {
			const { showSudoScreen } = await import("./sudoScreen.js");
			return showSudoScreen();
		},
		runScripts: async (scripts, inputs, installedIds) => {
			const { runScripts } = await import("./scriptRunner.js");
			return runScripts(scripts, inputs, installedIds, { readScript });
		},
		readScript,
	};
}

// ---------------------------------------------------------------------------
// runScriptExecution
// ---------------------------------------------------------------------------

/**
 * Coordinates the script execution phase:
 *   1. Decides whether a Unix sudo screen is needed.
 *   2. Shows it if required (elevation script present + not Windows).
 *   3. Delegates to runScripts and returns the ScriptRunResult.
 */
export async function runScriptExecution(
	manifestResult: ManifestResult,
	preExecResult: PreExecutionResult,
	deps?: ExecutionDeps,
): Promise<ScriptRunResult> {
	const resolved = deps ?? makeDefaultDeps(manifestResult);

	const needsSudo =
		resolved.platform !== "win32" &&
		preExecResult.orderedScripts.some((s) => s.requires_elevation);

	if (needsSudo) {
		await resolved.showSudoScreen();
	}

	return resolved.runScripts(
		preExecResult.orderedScripts,
		preExecResult.inputs,
		preExecResult.installedIds,
	);
}
