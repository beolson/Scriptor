// ---------------------------------------------------------------------------
// Pre-Execution Orchestrator
//
// Sequences input collection → confirmation → elevation pre-flight and
// returns a PreExecutionResult. N/Esc at confirmation exits immediately.
//
// All deps are injectable for testability.
// ---------------------------------------------------------------------------

import type {
	PreExecutionResult,
	ScriptEntry,
	ScriptInputs,
	ScriptSelectionResult,
} from "../manifest/types.js";

// ---------------------------------------------------------------------------
// PreExecutionDeps
// ---------------------------------------------------------------------------

/** Injectable dependencies for `runPreExecution`. */
export interface PreExecutionDeps {
	/** Collect all declared inputs from the selected scripts. */
	collectInputs: (scripts: ScriptEntry[]) => Promise<ScriptInputs>;
	/** Display the execution plan and prompt to confirm. N/Esc exits the process. */
	showConfirmation: (
		scripts: ScriptEntry[],
		inputs: ScriptInputs,
	) => Promise<"confirm">;
	/** Windows-only admin check; exits via process.exit if not elevated. */
	checkWindowsElevation: (scripts: ScriptEntry[]) => Promise<"ok">;
}

// ---------------------------------------------------------------------------
// Default deps (wired to real implementations via lazy require/import)
// ---------------------------------------------------------------------------

function makeDefaultDeps(): PreExecutionDeps {
	return {
		collectInputs: async (scripts: ScriptEntry[]) => {
			const { collectInputs } =
				require("./inputCollection.js") as typeof import("./inputCollection.js");
			return collectInputs(scripts);
		},
		showConfirmation: async (scripts: ScriptEntry[], inputs: ScriptInputs) => {
			const { showConfirmation } =
				require("./confirmation.js") as typeof import("./confirmation.js");
			return showConfirmation(scripts, inputs);
		},
		checkWindowsElevation: async (scripts: ScriptEntry[]) => {
			const { checkWindowsElevation } =
				require("./elevationPreFlight.js") as typeof import("./elevationPreFlight.js");
			return checkWindowsElevation(scripts);
		},
	};
}

// ---------------------------------------------------------------------------
// runPreExecution
// ---------------------------------------------------------------------------

/**
 * Runs the pre-execution phase:
 *   1. Collect inputs from the user (N/Esc during input exits immediately).
 *   2. Show the execution plan confirmation (N/Esc exits immediately).
 *   3. After confirmation, run the Windows elevation pre-flight.
 *   4. Return the PreExecutionResult.
 */
export async function runPreExecution(
	selectionResult: ScriptSelectionResult,
	deps: PreExecutionDeps = makeDefaultDeps(),
): Promise<PreExecutionResult> {
	const { orderedScripts } = selectionResult;

	// Step 1: Collect inputs (or skip if no scripts have inputs)
	const inputs = await deps.collectInputs(orderedScripts);

	// Step 2: Show confirmation (exits process on N/Esc)
	await deps.showConfirmation(orderedScripts, inputs);

	// Step 3: Elevation pre-flight (Windows only)
	await deps.checkWindowsElevation(orderedScripts);

	return { orderedScripts, inputs, installedIds: selectionResult.installedIds };
}
