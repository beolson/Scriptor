// ---------------------------------------------------------------------------
// Scriptor CLI — Entry Point
//
// Wires Commander, the startup orchestrator, and the apply-update handler
// into the binary's main() function. This is the only place that calls
// process.exit (via the default exit dep in buildProgram).
// ---------------------------------------------------------------------------

import * as clack from "@clack/prompts";
import { buildProgram } from "./program.js";
import { runStartup } from "./startup/orchestrator.js";
import { handleApplyUpdate } from "./update/applyUpdateHandler.js";

// ---------------------------------------------------------------------------
// TTY Guard
// ---------------------------------------------------------------------------

export interface GuardTTYDeps {
	isTTY: boolean;
	stderrWrite: (msg: string) => void;
	exit: (code: number) => never;
}

export function guardTTY(deps?: GuardTTYDeps): void {
	const resolved: GuardTTYDeps = deps ?? {
		isTTY: process.stdin.isTTY,
		stderrWrite: (m) => process.stderr.write(m),
		exit: process.exit,
	};

	if (!resolved.isTTY) {
		resolved.stderrWrite(
			"[scriptor] ERROR: Scriptor requires an interactive terminal.\nstdin is not a TTY — run Scriptor directly in a terminal, not piped.\n",
		);
		resolved.exit(1);
	}
}

async function main(): Promise<void> {
	guardTTY();

	const program = buildProgram({
		detectHost: async () => {
			const { detectHost } = await import("./host/detectHost.js");
			return detectHost();
		},
		runStartup,
		runScriptSelection: async (result) => {
			const { runScriptSelection } = await import(
				"./script-selection/index.js"
			);
			return runScriptSelection(result);
		},
		runPreExecution: async (selectionResult) => {
			const { runPreExecution } = await import("./pre-execution/index.js");
			return runPreExecution(selectionResult);
		},
		runScriptExecution: async (manifestResult, preExecResult) => {
			const { runScriptExecution } = await import("./execution/index.js");
			return runScriptExecution(manifestResult, preExecResult);
		},
		handleApplyUpdate,
		intro: clack.intro,
		outro: clack.outro,
		log: {
			success: clack.log.success,
		},
		exit: (code) => process.exit(code),
	});

	await program.parseAsync(process.argv);
}

if (import.meta.main) {
	main().catch((err) => {
		// Unhandled rejection — print and exit 1.
		// eslint-disable-next-line no-console
		console.error(err instanceof Error ? err.message : String(err));
		process.exit(1);
	});
}
