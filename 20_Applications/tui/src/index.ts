import { log } from "@clack/prompts";
import { Command } from "commander";

export interface RunDeps {
	isTTY?: boolean;
	exit?: (code: number) => never;
	spawnSync?: typeof Bun.spawnSync;
	argv?: string[];
	/** Test hook: called with the resolved repo value before orchestration begins. */
	onRepo?: (repo: string) => void;
	/** Test hook: called with the stub name each time an orchestrator stub is invoked. */
	onStubCalled?: (name: string) => void;
}

// --- Orchestrator stubs ---

async function runStartup(
	onStubCalled?: (name: string) => void,
): Promise<void> {
	onStubCalled?.("runStartup");
	throw new Error("not implemented");
}

async function runScriptSelection(
	onStubCalled?: (name: string) => void,
): Promise<void> {
	onStubCalled?.("runScriptSelection");
	throw new Error("not implemented");
}

async function runInputCollection(
	onStubCalled?: (name: string) => void,
): Promise<void> {
	onStubCalled?.("runInputCollection");
	throw new Error("not implemented");
}

async function runConfirmation(
	onStubCalled?: (name: string) => void,
): Promise<void> {
	onStubCalled?.("runConfirmation");
	throw new Error("not implemented");
}

async function runSudo(onStubCalled?: (name: string) => void): Promise<void> {
	onStubCalled?.("runSudo");
	throw new Error("not implemented");
}

async function runExecution(
	onStubCalled?: (name: string) => void,
): Promise<void> {
	onStubCalled?.("runExecution");
	throw new Error("not implemented");
}

export async function run(deps?: RunDeps): Promise<void> {
	const isTTY = deps?.isTTY ?? process.stdin.isTTY;
	const exit = deps?.exit ?? ((code: number) => process.exit(code));
	const spawnSyncFn = deps?.spawnSync ?? Bun.spawnSync;
	const argv = deps?.argv ?? process.argv;
	const onRepo = deps?.onRepo;
	const onStubCalled = deps?.onStubCalled;

	// TTY guard — runs first
	if (!isTTY) {
		log.error("Scriptor requires an interactive terminal.");
		exit(1);
		return;
	}

	// Set up Commander
	const program = new Command();
	program.exitOverride(); // prevent Commander from calling process.exit directly

	program
		.option(
			"--repo <owner/repo|local>",
			"Repository to use",
			"beolson/Scriptor",
		)
		.addOption(
			program
				.createOption(
					"--apply-update <old-path>",
					"Apply a self-update (internal)",
				)
				.hideHelp(),
		);

	program.parse(argv);

	const opts = program.opts<{ repo: string; applyUpdate?: string }>();

	// --apply-update handler
	if (opts.applyUpdate !== undefined) {
		throw new Error("not implemented");
	}

	// --repo=local guard
	const repo = opts.repo;
	if (repo === "local") {
		const result = spawnSyncFn(["git", "rev-parse", "--show-toplevel"]);
		if (result.exitCode !== 0) {
			log.error(
				"Not inside a git repository. --repo=local requires a git root.",
			);
			exit(1);
			return;
		}
	}

	onRepo?.(repo);

	// Orchestration sequence — wrapped in async IIFE with error boundary
	await (async () => {
		await runStartup(onStubCalled);
		await runScriptSelection(onStubCalled);
		await runInputCollection(onStubCalled);
		await runConfirmation(onStubCalled);
		await runSudo(onStubCalled);
		await runExecution(onStubCalled);
	})().catch((err: unknown) => {
		log.error(String(err));
		exit(1);
	});
}

// Module-level execution — only runs when this file is the entrypoint
if (import.meta.main) {
	run();
}
