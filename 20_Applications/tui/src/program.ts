// ---------------------------------------------------------------------------
// CLI Program Factory
//
// Builds and returns the Commander program. Separated from index.ts so that
// tests can call buildProgram() with injected fakes without executing main().
//
// This is the only file that imports Commander.
// ---------------------------------------------------------------------------

import { Command, Option } from "commander";
import type { HostInfo } from "./host/types.js";
import type {
	PreExecutionResult,
	ScriptRunResult,
	ScriptSelectionResult,
} from "./manifest/types.js";
import { parseRepo } from "./repo/parseRepo.js";
import type { Repo } from "./repo/types.js";
import type { ManifestResult } from "./startup/orchestrator.js";
import { formatHostInfo } from "./startup/screens.js";

// ---------------------------------------------------------------------------
// Injectable deps
// ---------------------------------------------------------------------------

export interface ProgramDeps {
	/** Detect the host platform/arch/distro before the intro title is shown. */
	detectHost: () => Promise<HostInfo>;
	/** Run the startup orchestration sequence. */
	runStartup: (opts: {
		host: HostInfo;
		repo?: Repo;
		localMode?: boolean;
	}) => Promise<ManifestResult>;
	/** Run the script-selection phase. */
	runScriptSelection: (
		result: ManifestResult,
	) => Promise<ScriptSelectionResult>;
	/** Run the pre-execution phase (input collection, confirmation, elevation check). */
	runPreExecution: (
		selectionResult: ScriptSelectionResult,
	) => Promise<PreExecutionResult>;
	/** Run the script execution phase. */
	runScriptExecution: (
		manifestResult: ManifestResult,
		preExecResult: PreExecutionResult,
	) => Promise<ScriptRunResult>;
	/** Apply a self-update from `oldPath` (called when --apply-update is set). */
	handleApplyUpdate: (oldPath: string) => Promise<never>;
	/** @clack/prompts intro() */
	intro: (title: string) => void;
	/** @clack/prompts outro() */
	outro: (message: string) => void;
	/** @clack/prompts log.success() */
	log: {
		success: (message: string) => void;
	};
	/** process.exit wrapper, injectable for tests. */
	exit: (code: number) => never;
}

// ---------------------------------------------------------------------------
// buildProgram
// ---------------------------------------------------------------------------

/**
 * Constructs the Commander program with all options and action handlers wired.
 * Accepts injectable deps so tests can exercise the program without real side
 * effects.
 */
export function buildProgram(deps: ProgramDeps): Command {
	const program = new Command();

	/**
	 * Parses the --repo argument. Passes "local" through as a raw string;
	 * delegates all other values to parseRepo (which throws InvalidArgumentError
	 * on invalid formats so Commander can print the error and exit 1).
	 */
	const parseRepoArg = (value: string): Repo | "local" => {
		if (value.trim() === "local") return "local";
		return parseRepo(value);
	};

	program
		.name("scriptor")
		.description("Fetch and run host-specific setup scripts from GitHub")
		.option(
			"--repo <owner/repo|local>",
			'GitHub repository to fetch scripts from (e.g. owner/repo), or "local" to read from the current git root',
			parseRepoArg,
		)
		.addOption(
			new Option(
				"--apply-update <old-path>",
				"Internal: apply self-update",
			).hideHelp(),
		)
		.action(
			async (options: { repo?: Repo | "local"; applyUpdate?: string }) => {
				// --apply-update must be handled before any other logic.
				if (options.applyUpdate !== undefined) {
					await deps.handleApplyUpdate(options.applyUpdate);
					// handleApplyUpdate never returns; unreachable:
					return;
				}

				const host = await deps.detectHost();
				deps.intro(`Scriptor ${formatHostInfo(host)}`);

				const isLocal = options.repo === "local";
				const result = await deps.runStartup({
					host,
					repo: isLocal ? undefined : (options.repo as Repo | undefined),
					localMode: isLocal || undefined,
				});

				const selectionResult = await deps.runScriptSelection(result);

				const preExecResult = await deps.runPreExecution(selectionResult);

				const runResult = await deps.runScriptExecution(result, preExecResult);
				deps.exit(runResult.success ? 0 : 1);
			},
		);

	return program;
}
