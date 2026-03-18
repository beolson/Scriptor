import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import type { ScriptInputs } from "../inputs/inputSchema";
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
 * - `output`   — emitted for each non-blank line written to stdout or stderr.
 * - `done`     — emitted when a script exits with code 0.
 * - `failed`   — emitted when a script exits with a non-zero code; includes the
 *               exit code so the TUI can display a summary.
 */
export type ProgressEvent =
	| { status: "pending"; scriptId: string }
	| { status: "running"; scriptId: string }
	| { status: "output"; scriptId: string; line: string }
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
 * @param scriptContent  The raw script text to execute.
 * @param args           Positional arguments passed to the script ($1, $2, …).
 * @param onStdout       Callback invoked with each stdout chunk.
 * @param onStderr       Callback invoked with each stderr chunk.
 * @returns              The process exit code once it exits.
 */
export type Spawner = (
	scriptContent: string,
	args: string[],
	onStdout: (chunk: string) => void,
	onStderr: (chunk: string) => void,
) => Promise<number>;

// ---------------------------------------------------------------------------
// Internal helper: drain stdout/stderr from a spawned process
// ---------------------------------------------------------------------------

async function streamProcess(
	proc: ReturnType<typeof Bun.spawn>,
	onStdout: (chunk: string) => void,
	onStderr: (chunk: string) => void,
): Promise<number> {
	// stdout/stderr are always ReadableStream when spawned with stdout/stderr: "pipe".
	const stdoutReader = (proc.stdout as ReadableStream<Uint8Array>).getReader();
	const stderrReader = (proc.stderr as ReadableStream<Uint8Array>).getReader();
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
}

// ---------------------------------------------------------------------------
// Default real spawner using Bun
// ---------------------------------------------------------------------------

/**
 * Production spawner that runs the script in the platform-appropriate shell
 * and streams stdout/stderr to the provided callbacks.
 *
 * - Windows: writes the script to a temp `.ps1` file and invokes
 *   `powershell.exe -NonInteractive -NoProfile -ExecutionPolicy Bypass -File
 *   <tmpfile> [args…]`. The temp file is deleted after the process exits.
 * - Unix: invokes `sh -c <scriptContent> sh [args…]`, where `$1`, `$2`, …
 *   correspond to the positional args.
 */
const defaultSpawner: Spawner = async (
	scriptContent: string,
	args: string[],
	onStdout: (chunk: string) => void,
	onStderr: (chunk: string) => void,
): Promise<number> => {
	if (process.platform === "win32") {
		const tmpFile = join(
			tmpdir(),
			`scriptor-${Date.now()}-${Math.random().toString(36).slice(2)}.ps1`,
		);
		// Prepend UTF-8 output encoding so PowerShell's own Write-Host/Write-Output
		// is correctly encoded when piped to Bun. Native Windows commands (e.g.
		// wsl --install) write UTF-16 LE directly to the pipe and bypass this
		// setting; they must suppress or re-encode their output in the script.
		const ps1Content =
			"[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\n" +
			"$OutputEncoding = [System.Text.Encoding]::UTF8\n\n" +
			scriptContent;
		await Bun.write(tmpFile, ps1Content);
		try {
			const proc = Bun.spawn(
				[
					"powershell.exe",
					"-NonInteractive",
					"-NoProfile",
					"-ExecutionPolicy",
					"Bypass",
					"-File",
					tmpFile,
					...args,
				],
				{ stdout: "pipe", stderr: "pipe" },
			);
			return await streamProcess(proc, onStdout, onStderr);
		} finally {
			try {
				await unlink(tmpFile);
			} catch {
				// Ignore cleanup errors — best effort.
			}
		}
	}

	// Unix: pass script content to sh; positional args become $1, $2, …
	const proc = Bun.spawn(["sh", "-c", scriptContent, "sh", ...args], {
		stdout: "pipe",
		stderr: "pipe",
	});
	return streamProcess(proc, onStdout, onStderr);
};

// ---------------------------------------------------------------------------
// ScriptRunner options
// ---------------------------------------------------------------------------

export interface ScriptRunnerOptions {
	/** Log service used to write banners, output, and footers. */
	logService: Pick<
		LogService,
		| "writeScriptBanner"
		| "appendOutput"
		| "writeScriptFooter"
		| "writeScriptInputs"
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
	 * @param scripts       Ordered list of scripts to run (dependency-resolved order).
	 * @param logFile       Absolute path to the log file created by LogService.
	 * @param scriptInputs  Optional map of collected inputs keyed by script id.
	 *                      Input values are passed as positional args (FR-3-030,
	 *                      FR-3-031, FR-3-032).
	 */
	async runScripts(
		scripts: ScriptEntry[],
		logFile: string,
		scriptInputs?: ScriptInputs,
	): Promise<ScriptRunResult> {
		// Emit pending for every script so the TUI can render the full queue.
		for (const script of scripts) {
			this.emit({ status: "pending", scriptId: script.id });
		}

		for (const script of scripts) {
			this.emit({ status: "running", scriptId: script.id });

			// Extract collected input values as positional args in declaration order
			// (FR-3-030, FR-3-031, FR-3-032).
			const collectedInputs = scriptInputs?.get(script.id) ?? [];
			const args = collectedInputs.map((i) => i.value);

			const startTime = new Date();
			await this.logService.writeScriptBanner(logFile, script.name, startTime);
			await this.logService.writeScriptInputs(logFile, collectedInputs);

			// Separate line buffers for stdout and stderr prevent partial lines from
			// one stream from being merged with lines from the other.
			const makeLineEmitter = (scriptId: string) => {
				let buf = "";
				return {
					push: (chunk: string) => {
						buf += chunk;
						const parts = buf.split("\n");
						buf = parts.pop() ?? "";
						for (const raw of parts) {
							const line = raw.replace(/\r$/, "");
							if (line.length > 0) {
								this.emit({ status: "output", scriptId, line });
							}
						}
					},
					flush: () => {
						const line = buf.trim();
						if (line.length > 0) {
							this.emit({ status: "output", scriptId, line });
							buf = "";
						}
					},
				};
			};
			const stdoutLines = makeLineEmitter(script.id);
			const stderrLines = makeLineEmitter(script.id);

			const exitCode = await this.spawner(
				script.script,
				args,
				async (chunk) => {
					stdoutLines.push(chunk);
					await this.logService.appendOutput(logFile, chunk);
				},
				async (chunk) => {
					stderrLines.push(chunk);
					await this.logService.appendOutput(logFile, chunk);
				},
			);
			stdoutLines.flush();
			stderrLines.flush();

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
