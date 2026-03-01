import type { LogService } from "../log/logService";
import type { ScriptEntry } from "../manifest/parseManifest";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Progress event emitted by ScriptRunner as it works through the script queue.
 *
 * - `pending`  — emitted once for every script in the queue before any script
 *               starts, so the TUI can render the full list up-front.
 * - `running`  — emitted immediately before a script's child process is spawned.
 * - `done`     — emitted when a script exits with code 0.
 * - `failed`   — emitted when a script exits with a non-zero code; includes the
 *               exit code so the TUI can display a summary.
 */
export type ProgressEvent =
	| { status: "pending"; scriptId: string }
	| { status: "running"; scriptId: string }
	| { status: "done"; scriptId: string }
	| { status: "failed"; scriptId: string; exitCode: number };

/** Result returned when all scripts complete successfully. */
export interface ScriptSuccessResult {
	success: true;
	logFile: string;
}

/** Result returned when a script exits with a non-zero exit code. */
export interface ScriptFailureResult {
	success: false;
	logFile: string;
	failedScript: ScriptEntry;
	exitCode: number;
}

export type ScriptRunResult = ScriptSuccessResult | ScriptFailureResult;

// ---------------------------------------------------------------------------
// Spawner type
// ---------------------------------------------------------------------------

/**
 * Injectable function that spawns a script as a child process.
 *
 * @param script    The shell command / script path to run.
 * @param onStdout  Callback invoked with each stdout chunk.
 * @param onStderr  Callback invoked with each stderr chunk.
 * @returns         The process exit code once it exits.
 */
export type Spawner = (
	script: string,
	onStdout: (chunk: string) => void,
	onStderr: (chunk: string) => void,
) => Promise<number>;

// ---------------------------------------------------------------------------
// Default real spawner using Bun
// ---------------------------------------------------------------------------

/**
 * Production spawner that uses Bun's `$` shell to run the script and streams
 * stdout/stderr to the provided callbacks.
 */
const defaultSpawner: Spawner = async (
	script: string,
	onStdout: (chunk: string) => void,
	onStderr: (chunk: string) => void,
): Promise<number> => {
	const proc = Bun.spawn(["sh", "-c", script], {
		stdout: "pipe",
		stderr: "pipe",
	});

	// Stream stdout
	const stdoutReader = proc.stdout.getReader();
	const stderrReader = proc.stderr.getReader();
	const decoder = new TextDecoder();

	const drainStdout = async () => {
		while (true) {
			const { done, value } = await stdoutReader.read();
			if (done) break;
			onStdout(decoder.decode(value));
		}
	};

	const drainStderr = async () => {
		while (true) {
			const { done, value } = await stderrReader.read();
			if (done) break;
			onStderr(decoder.decode(value));
		}
	};

	await Promise.all([drainStdout(), drainStderr()]);
	return proc.exitCode ?? (await proc.exited);
};

// ---------------------------------------------------------------------------
// ScriptRunner options
// ---------------------------------------------------------------------------

export interface ScriptRunnerOptions {
	/** Log service used to write banners, output, and footers. */
	logService: Pick<
		LogService,
		"writeScriptBanner" | "appendOutput" | "writeScriptFooter"
	>;
	/** Injectable spawner (defaults to the real Bun spawner). */
	spawner?: Spawner;
}

// ---------------------------------------------------------------------------
// ScriptRunner
// ---------------------------------------------------------------------------

type ProgressListener = (event: ProgressEvent) => void;

/**
 * Executes a list of scripts sequentially, capturing output to a log file and
 * emitting progress events so the TUI can react in real time.
 *
 * Usage:
 * ```ts
 * const runner = new ScriptRunner({ logService });
 * runner.on("progress", (event) => { ... });
 * const result = await runner.runScripts(scripts, logFilePath);
 * ```
 */
export class ScriptRunner {
	private readonly logService: ScriptRunnerOptions["logService"];
	private readonly spawner: Spawner;
	private readonly listeners: ProgressListener[] = [];

	constructor(options: ScriptRunnerOptions) {
		this.logService = options.logService;
		this.spawner = options.spawner ?? defaultSpawner;
	}

	// -------------------------------------------------------------------------
	// Event emitter (minimal — no external dependency needed)
	// -------------------------------------------------------------------------

	/** Register a listener for progress events. */
	on(_event: "progress", listener: ProgressListener): void {
		this.listeners.push(listener);
	}

	private emit(event: ProgressEvent): void {
		for (const listener of this.listeners) {
			listener(event);
		}
	}

	// -------------------------------------------------------------------------
	// Core execution
	// -------------------------------------------------------------------------

	/**
	 * Runs `scripts` sequentially.
	 *
	 * - Emits a `pending` event for every script up-front.
	 * - For each script: emits `running`, spawns the child process (piping
	 *   stdout/stderr to the log), then emits `done` or `failed`.
	 * - Halts immediately on the first non-zero exit code.
	 *
	 * @param scripts  Ordered list of scripts to run (dependency-resolved order).
	 * @param logFile  Absolute path to the log file created by LogService.
	 */
	async runScripts(
		scripts: ScriptEntry[],
		logFile: string,
	): Promise<ScriptRunResult> {
		// Emit pending for every script so the TUI can render the full queue.
		for (const script of scripts) {
			this.emit({ status: "pending", scriptId: script.id });
		}

		for (const script of scripts) {
			this.emit({ status: "running", scriptId: script.id });

			const startTime = new Date();
			await this.logService.writeScriptBanner(logFile, script.name, startTime);

			const exitCode = await this.spawner(
				script.script,
				async (chunk) => {
					await this.logService.appendOutput(logFile, chunk);
				},
				async (chunk) => {
					await this.logService.appendOutput(logFile, chunk);
				},
			);

			const endTime = new Date();
			await this.logService.writeScriptFooter(logFile, exitCode, endTime);

			if (exitCode !== 0) {
				this.emit({ status: "failed", scriptId: script.id, exitCode });
				return { success: false, logFile, failedScript: script, exitCode };
			}

			this.emit({ status: "done", scriptId: script.id });
		}

		return { success: true, logFile };
	}
}
