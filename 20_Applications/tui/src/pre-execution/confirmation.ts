// ---------------------------------------------------------------------------
// Confirmation Screen
//
// Displays the execution plan (ordered scripts + collected inputs) and prompts
// the user to confirm or go back. Uses @clack/prompts confirm() under the hood.
//
// All @clack/prompts calls are injectable via `deps` for testability.
// ---------------------------------------------------------------------------

import * as clackPrompts from "@clack/prompts";
import type { ScriptEntry, ScriptInputs } from "../manifest/types.js";

// ---------------------------------------------------------------------------
// ConfirmationDeps
// ---------------------------------------------------------------------------

/** Injectable dependencies for `showConfirmation`. */
export interface ConfirmationDeps {
	/** Prompt the user to confirm or decline. Returns true, false, or a cancel symbol. */
	confirm: (opts: { message: string }) => Promise<boolean | symbol>;
	/** Returns true if the value is a cancel symbol from @clack/prompts. */
	isCancel: (val: unknown) => val is symbol;
	/** Prints a cancellation message to the terminal (clack cancel style). */
	cancel: (hint?: string) => void;
	/** Process exit, injectable for tests. Never returns. */
	exit: (code: number) => never;
}

// ---------------------------------------------------------------------------
// Default deps
// ---------------------------------------------------------------------------

function makeDefaultDeps(): ConfirmationDeps {
	return {
		confirm: clackPrompts.confirm,
		isCancel: clackPrompts.isCancel,
		cancel: clackPrompts.cancel,
		exit: (code: number): never => process.exit(code),
	};
}

// ---------------------------------------------------------------------------
// formatExecutionPlan (pure — no deps)
// ---------------------------------------------------------------------------

/**
 * Builds the multi-line execution plan string shown in the confirmation prompt.
 *
 * Format:
 *   The following scripts will run in order:
 *   1. {name} — {dim(description)}
 *     {label}: {value}          ← string/number inputs with non-empty value
 *     {label}: {path} ({certCN})← ssl-cert inputs with non-empty value
 *   ...
 *   Y / Enter — Run these scripts   N / Esc — Go back to the script list
 */
export function formatExecutionPlan(
	orderedScripts: ScriptEntry[],
	inputs: ScriptInputs,
): string {
	const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

	const lines: string[] = [];

	lines.push("The following scripts will run in order:");

	for (const [i, script] of orderedScripts.entries()) {
		lines.push(
			`${dim(`${i + 1}.`)} ${script.name} — ${dim(script.description)}`,
		);

		// Add indented input rows for non-empty collected inputs.
		for (const inputDef of script.inputs) {
			const collected = inputs.get(inputDef.id);
			if (!collected || collected.value === "") continue;

			if (inputDef.type === "ssl-cert" && collected.certCN !== undefined) {
				lines.push(
					`  ${inputDef.label}: ${collected.value} (${collected.certCN})`,
				);
			} else {
				lines.push(`  ${inputDef.label}: ${collected.value}`);
			}
		}
	}

	lines.push("Y / Enter — Run these scripts   N / Esc — Cancel");

	return lines.join("\n");
}

// ---------------------------------------------------------------------------
// showConfirmation
// ---------------------------------------------------------------------------

/**
 * Displays the execution plan as a confirmation prompt and returns the user's
 * decision.
 *
 * - Returns `"confirm"` if the user presses Y or Enter (confirm = true).
 * - Prints "User canceled." and exits immediately if the user presses N, Esc,
 *   or Ctrl+C (confirm = false or cancel symbol).
 */
export async function showConfirmation(
	orderedScripts: ScriptEntry[],
	inputs: ScriptInputs,
	deps: ConfirmationDeps = makeDefaultDeps(),
): Promise<"confirm"> {
	const message = formatExecutionPlan(orderedScripts, inputs);
	const result = await deps.confirm({ message });

	if (result === true) return "confirm";
	deps.cancel("User canceled.");
	return deps.exit(0);
}
