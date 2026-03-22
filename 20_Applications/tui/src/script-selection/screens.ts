// ---------------------------------------------------------------------------
// Script Selection Screens
//
// Thin wrappers around @clack/prompts for the script selection phase.
// All clack calls are injectable via `deps` for testability.
// No business logic lives here — the orchestrator drives all decisions.
// ---------------------------------------------------------------------------

import * as clackPrompts from "@clack/prompts";
import type { ScriptEntry } from "../manifest/types.js";

// ---------------------------------------------------------------------------
// Injectable deps type
// ---------------------------------------------------------------------------

/** Minimal subset of @clack/prompts used by this module. */
export interface ClackDeps {
	select: <Value>(opts: {
		message: string;
		options: Array<{ value: Value; label?: string; hint?: string }>;
	}) => Promise<Value | symbol>;
	multiselect: <Value>(opts: {
		message: string;
		options: Array<{ value: Value; label?: string; hint?: string }>;
		initialValues?: Value[];
	}) => Promise<Value[] | symbol>;
	log: {
		warn: (message: string) => void;
		info: (message: string) => void;
	};
}

export interface ScreensDeps {
	clack?: ClackDeps;
	/** Defaults to `process.exit`. Injectable for testability. */
	exit?: (code: number) => never;
}

// ---------------------------------------------------------------------------
// Internal option value constants
// ---------------------------------------------------------------------------

const INDIVIDUAL_VALUE = "individual";
const SETTINGS_VALUE = "settings";

// ---------------------------------------------------------------------------
// Default clack dep
// ---------------------------------------------------------------------------

const defaultClack: ClackDeps = {
	select: clackPrompts.select as ClackDeps["select"],
	multiselect: clackPrompts.multiselect as ClackDeps["multiselect"],
	log: {
		warn: clackPrompts.log.warn,
		info: clackPrompts.log.info,
	},
};

function resolveClack(deps?: ScreensDeps): ClackDeps {
	return deps?.clack ?? defaultClack;
}

// ---------------------------------------------------------------------------
// showNoScripts
// ---------------------------------------------------------------------------

/**
 * Warns the user that no scripts are available for their host and exits.
 *
 * This function never returns.
 */
export function showNoScripts(hostLabel: string, deps?: ScreensDeps): never {
	const clack = resolveClack(deps);
	const exit = deps?.exit ?? ((code: number) => process.exit(code));
	clack.log.warn(`No scripts available for ${hostLabel}`);
	return exit(0) as never;
}

// ---------------------------------------------------------------------------
// showMainMenu
// ---------------------------------------------------------------------------

/**
 * Presents the main menu with group options, "Individual scripts", and
 * "Settings". Loops internally if Settings is chosen. Returns the selected
 * group name or `"individual"`.
 */
export async function showMainMenu(
	groups: string[],
	deps?: ScreensDeps,
): Promise<"individual" | string> {
	const clack = resolveClack(deps);

	const options: Array<{ value: string; label: string }> = [
		...groups.map((g) => ({ value: g, label: g })),
		{ value: INDIVIDUAL_VALUE, label: "Individual scripts" },
		{ value: SETTINGS_VALUE, label: "Settings" },
	];

	// Loop until the user chooses something other than Settings.
	while (true) {
		const result = await clack.select({
			message: "What would you like to install?",
			options,
		});

		const selection = typeof result === "symbol" ? INDIVIDUAL_VALUE : result;

		if (selection === SETTINGS_VALUE) {
			clack.log.info("Settings coming soon.");
			continue;
		}

		return selection as "individual" | string;
	}
}

// ---------------------------------------------------------------------------
// showIndividualSelect
// ---------------------------------------------------------------------------

/**
 * Presents a multi-select list of all available scripts. Installed scripts
 * are labelled with `[installed]`; none are pre-checked. Returns the IDs of
 * the selected scripts.
 */
export async function showIndividualSelect(
	scripts: ScriptEntry[],
	deps?: ScreensDeps,
): Promise<string[]> {
	const clack = resolveClack(deps);

	const options = scripts.map((s) => ({
		value: s.id,
		label: s.installed ? `${s.name} [installed]` : s.name,
		hint: s.description,
	}));

	const result = await clack.multiselect({
		message: "Select scripts to install:",
		options,
		initialValues: [],
	});

	if (typeof result === "symbol") {
		return [];
	}

	return result;
}
