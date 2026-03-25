// ---------------------------------------------------------------------------
// Script Runner
//
// Helper functions and the main sequential execution loop:
//   - buildArgList: pure argument array builder
//   - runScripts: sequential execution loop for all selected scripts
//
// stdout/stderr are inherited from the parent process — script output goes
// directly to the terminal without buffering or indentation.
// ---------------------------------------------------------------------------

import type {
	ScriptEntry,
	ScriptInputs,
	ScriptRunResult,
} from "../manifest/types.js";

// ---------------------------------------------------------------------------
// SpawnOpts / SpawnResult
// ---------------------------------------------------------------------------

export interface SpawnOpts {
	stdout?: "pipe" | "ignore" | "inherit";
	stderr?: "pipe" | "ignore" | "inherit";
	stdin?: "pipe" | "ignore" | "inherit";
}

export interface SpawnResult {
	exited: Promise<number>;
}

// ---------------------------------------------------------------------------
// ScriptRunnerDeps
// ---------------------------------------------------------------------------

export interface ScriptRunnerDeps {
	platform: string;
	readScript: (entry: ScriptEntry) => Promise<string>;
	spawn: (cmd: string[], opts: SpawnOpts) => SpawnResult;
	stdoutWrite: (msg: string) => void;
	startKeepalive: () => NodeJS.Timeout;
	stopKeepalive: (timer: NodeJS.Timeout) => void;
	now: () => Date;
	tmpdir: () => string;
	writeFile: (path: string, data: string) => Promise<void>;
	unlink: (path: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// buildArgList
// ---------------------------------------------------------------------------

/**
 * Builds the positional argument array for a script invocation.
 *
 * For each input definition (in declaration order) the collected value is
 * appended, falling back to `""` when no value was collected.
 *
 * The final element is always the installed-items string:
 * `[...installedIds].join(":")` or `""` when the set is empty.
 */
export function buildArgList(
	script: ScriptEntry,
	inputs: ScriptInputs,
	installedIds: Set<string>,
): string[] {
	const args: string[] = [];

	for (const def of script.inputs) {
		args.push(inputs.get(def.id)?.value ?? "");
	}

	args.push([...installedIds].join(":"));

	return args;
}

// ---------------------------------------------------------------------------
// runScripts
// ---------------------------------------------------------------------------

/**
 * Sequentially executes all scripts, inheriting stdout/stderr so output goes
 * directly to the terminal. Halts on the first failure and returns a
 * `ScriptRunResult`.
 *
 * - Unix: invokes via `sh -c <content> sh ...args`
 * - Windows: writes a temp `.ps1` file and invokes via `powershell.exe`
 * - Elevation scripts (Unix only): wrapped in sudo keepalive
 */
export async function runScripts(
	scripts: ScriptEntry[],
	inputs: ScriptInputs,
	installedIds: Set<string>,
	deps?: Partial<ScriptRunnerDeps>,
): Promise<ScriptRunResult> {
	const resolved = { ...makeDefaultDeps(), ...deps };

	for (const entry of scripts) {
		resolved.stdoutWrite(`Running: ${entry.name}\n`);

		const args = buildArgList(entry, inputs, installedIds);
		const content = await resolved.readScript(entry);

		const isWindows = resolved.platform === "win32";

		let exitCode: number;

		if (!isWindows) {
			// ------------------------------------------------------------------
			// Unix invocation
			// ------------------------------------------------------------------
			const runScript = async (): Promise<number> => {
				const proc = resolved.spawn(["sh", "-c", content, "sh", ...args], {
					stdout: "inherit",
					stderr: "inherit",
					stdin: "inherit",
				});
				return await proc.exited;
			};

			if (entry.requires_elevation) {
				const timer = resolved.startKeepalive();
				try {
					exitCode = await runScript();
				} finally {
					resolved.stopKeepalive(timer);
				}
			} else {
				exitCode = await runScript();
			}
		} else {
			// ------------------------------------------------------------------
			// Windows invocation — write temp .ps1 file
			// ------------------------------------------------------------------
			const timestamp = resolved.now().getTime();
			const random = Math.floor(Math.random() * 0xffff)
				.toString(16)
				.padStart(4, "0");
			const tmpFile = `${resolved.tmpdir()}/scriptor-${timestamp}-${random}.ps1`;

			// Prepend UTF-8 BOM + encoding directive for PowerShell
			const ps1Content = `\ufeff# -*- coding: utf-8 -*-\n${content}`;

			try {
				await resolved.writeFile(tmpFile, ps1Content);

				const proc = resolved.spawn(
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
					{ stdout: "inherit", stderr: "inherit", stdin: "inherit" },
				);

				exitCode = await proc.exited;
			} finally {
				await resolved.unlink(tmpFile).catch(() => {});
			}
		}

		if (exitCode !== 0) {
			resolved.stdoutWrite(`✗ ${entry.name} failed (exit code ${exitCode})\n`);
			return { success: false, failedScript: entry, exitCode };
		}
	}

	return { success: true };
}

// ---------------------------------------------------------------------------
// Default deps (wired to real implementations)
// ---------------------------------------------------------------------------

function makeDefaultDeps(): ScriptRunnerDeps {
	return {
		platform: process.platform,
		readScript: async (entry: ScriptEntry) => {
			// Implemented in execution/index.ts via injection; this default is a fallback
			throw new Error(`readScript not wired for entry: ${entry.id}`);
		},
		spawn: (cmd: string[], opts: SpawnOpts) => {
			const proc = Bun.spawn(cmd, opts as Parameters<typeof Bun.spawn>[1]);
			return { exited: proc.exited };
		},
		stdoutWrite: (msg: string) => {
			process.stdout.write(msg);
		},
		startKeepalive: () => {
			const { startKeepalive } =
				require("./keepalive.js") as typeof import("./keepalive.js");
			return startKeepalive();
		},
		stopKeepalive: (timer: NodeJS.Timeout) => {
			const { stopKeepalive } =
				require("./keepalive.js") as typeof import("./keepalive.js");
			stopKeepalive(timer);
		},
		now: () => new Date(),
		tmpdir: () => {
			const { tmpdir } = require("node:os") as typeof import("node:os");
			return tmpdir();
		},
		writeFile: async (path: string, data: string) => {
			const { writeFile } =
				require("node:fs/promises") as typeof import("node:fs/promises");
			await writeFile(path, data, "utf8");
		},
		unlink: async (path: string) => {
			const { unlink } =
				require("node:fs/promises") as typeof import("node:fs/promises");
			await unlink(path);
		},
	};
}
