import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ScriptInputs } from "../inputs/inputSchema";
import { LogService } from "../log/logService";
import type { ScriptEntry } from "../manifest/parseManifest";
import { type ProgressEvent, ScriptRunner } from "./scriptRunner";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(
	overrides: Partial<ScriptEntry> & { id: string },
): ScriptEntry {
	return {
		id: overrides.id,
		name: overrides.name ?? overrides.id,
		description: overrides.description ?? `Script ${overrides.id}`,
		platform: overrides.platform ?? "linux",
		arch: overrides.arch ?? "x86",
		script: overrides.script ?? "echo hello",
		dependencies: overrides.dependencies ?? [],
		distro: overrides.distro ?? "Ubuntu",
		version: overrides.version ?? "24.04",
		inputs: overrides.inputs ?? [],
		requires_sudo: overrides.requires_sudo ?? false,
	};
}

/** A no-op spawner that always exits with code 0 and emits no output. */
function makeSpawner(
	results: Record<
		string,
		{ exitCode: number; stdout?: string; stderr?: string }
	>,
) {
	return async (
		script: string,
		onStdout: (chunk: string) => void,
		onStderr: (chunk: string) => void,
	): Promise<number> => {
		const result = results[script];
		if (!result) {
			throw new Error(`No mock result registered for script: ${script}`);
		}
		if (result.stdout) onStdout(result.stdout);
		if (result.stderr) onStderr(result.stderr);
		return result.exitCode;
	};
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

let testDir: string;
let logService: LogService;
let logFile: string;

beforeEach(async () => {
	testDir = join(tmpdir(), `scriptor-exec-test-${Date.now()}`);
	mkdirSync(testDir, { recursive: true });
	logService = new LogService(testDir);
	logFile = await logService.createLogFile();
});

afterEach(() => {
	rmSync(testDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// ScriptRunResult shape
// ---------------------------------------------------------------------------

describe("ScriptSuccessResult", () => {
	test("returns success result with log file path on all scripts exiting 0", async () => {
		const scripts = [makeEntry({ id: "a", script: "echo a" })];
		const spawner = makeSpawner({ "echo a": { exitCode: 0 } });
		const runner = new ScriptRunner({ logService, spawner });

		const result = await runner.runScripts(scripts, logFile);

		expect(result.success).toBe(true);
		expect(result.logFile).toBe(logFile);
	});

	test("returns success result for multiple scripts all exiting 0", async () => {
		const scripts = [
			makeEntry({ id: "a", script: "echo a" }),
			makeEntry({ id: "b", script: "echo b" }),
		];
		const spawner = makeSpawner({
			"echo a": { exitCode: 0 },
			"echo b": { exitCode: 0 },
		});
		const runner = new ScriptRunner({ logService, spawner });

		const result = await runner.runScripts(scripts, logFile);

		expect(result.success).toBe(true);
	});
});

describe("ScriptFailureResult", () => {
	test("returns failure result when a script exits with non-zero code", async () => {
		const scripts = [makeEntry({ id: "a", script: "bad" })];
		const spawner = makeSpawner({ bad: { exitCode: 1 } });
		const runner = new ScriptRunner({ logService, spawner });

		const result = await runner.runScripts(scripts, logFile);

		expect(result.success).toBe(false);
	});

	test("failure result includes the failing script entry", async () => {
		const entry = makeEntry({ id: "fail-script", script: "bad" });
		const spawner = makeSpawner({ bad: { exitCode: 2 } });
		const runner = new ScriptRunner({ logService, spawner });

		const result = await runner.runScripts([entry], logFile);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.failedScript.id).toBe("fail-script");
		}
	});

	test("failure result includes the non-zero exit code", async () => {
		const entry = makeEntry({ id: "fail-script", script: "bad" });
		const spawner = makeSpawner({ bad: { exitCode: 42 } });
		const runner = new ScriptRunner({ logService, spawner });

		const result = await runner.runScripts([entry], logFile);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.exitCode).toBe(42);
		}
	});

	test("failure result includes the log file path", async () => {
		const entry = makeEntry({ id: "fail-script", script: "bad" });
		const spawner = makeSpawner({ bad: { exitCode: 1 } });
		const runner = new ScriptRunner({ logService, spawner });

		const result = await runner.runScripts([entry], logFile);

		expect(result.logFile).toBe(logFile);
	});
});

// ---------------------------------------------------------------------------
// Sequential execution & halting on failure
// ---------------------------------------------------------------------------

describe("sequential execution", () => {
	test("executes scripts in the order they are given", async () => {
		const executionOrder: string[] = [];
		const scripts = [
			makeEntry({ id: "first", script: "echo first" }),
			makeEntry({ id: "second", script: "echo second" }),
			makeEntry({ id: "third", script: "echo third" }),
		];
		const spawner = async (
			script: string,
			_onStdout: (chunk: string) => void,
			_onStderr: (chunk: string) => void,
		) => {
			executionOrder.push(script);
			return 0;
		};
		const runner = new ScriptRunner({ logService, spawner });

		await runner.runScripts(scripts, logFile);

		expect(executionOrder).toEqual(["echo first", "echo second", "echo third"]);
	});

	test("halts execution after a script fails — subsequent scripts not started", async () => {
		const executed: string[] = [];
		const scripts = [
			makeEntry({ id: "a", script: "echo a" }),
			makeEntry({ id: "fail", script: "bad" }),
			makeEntry({ id: "c", script: "echo c" }),
		];
		const spawner = async (
			script: string,
			_onStdout: (chunk: string) => void,
			_onStderr: (chunk: string) => void,
		) => {
			executed.push(script);
			if (script === "bad") return 1;
			return 0;
		};
		const runner = new ScriptRunner({ logService, spawner });

		await runner.runScripts(scripts, logFile);

		expect(executed).toContain("echo a");
		expect(executed).toContain("bad");
		expect(executed).not.toContain("echo c");
	});

	test("empty script list returns success with log file path", async () => {
		const spawner = makeSpawner({});
		const runner = new ScriptRunner({ logService, spawner });

		const result = await runner.runScripts([], logFile);

		expect(result.success).toBe(true);
		expect(result.logFile).toBe(logFile);
	});
});

// ---------------------------------------------------------------------------
// Log capture
// ---------------------------------------------------------------------------

describe("log capture", () => {
	test("writes a banner for each script to the log file", async () => {
		const scripts = [
			makeEntry({ id: "my-script", name: "My Script", script: "echo hello" }),
		];
		const spawner = makeSpawner({
			"echo hello": { exitCode: 0, stdout: "hello\n" },
		});
		const bannerCalls: Array<[string, string, Date]> = [];
		const mockLogService = {
			writeScriptBanner: async (f: string, n: string, t: Date) => {
				bannerCalls.push([f, n, t]);
			},
			appendOutput: async () => {},
			writeScriptFooter: async () => {},
			writeScriptInputs: async () => {},
		};
		const runner = new ScriptRunner({
			logService: mockLogService as unknown as LogService,
			spawner,
		});

		await runner.runScripts(scripts, logFile);

		expect(bannerCalls.length).toBe(1);
		expect(bannerCalls[0]?.[0]).toBe(logFile);
		expect(bannerCalls[0]?.[1]).toBe("My Script");
	});

	test("writes a footer for each script to the log file", async () => {
		const scripts = [
			makeEntry({ id: "my-script", name: "My Script", script: "echo hello" }),
		];
		const spawner = makeSpawner({ "echo hello": { exitCode: 0 } });
		const footerCalls: Array<[string, number, Date]> = [];
		const mockLogService = {
			writeScriptBanner: async () => {},
			appendOutput: async () => {},
			writeScriptFooter: async (f: string, code: number, t: Date) => {
				footerCalls.push([f, code, t]);
			},
			writeScriptInputs: async () => {},
		};
		const runner = new ScriptRunner({
			logService: mockLogService as unknown as LogService,
			spawner,
		});

		await runner.runScripts(scripts, logFile);

		expect(footerCalls.length).toBe(1);
		expect(footerCalls[0]?.[0]).toBe(logFile);
		expect(footerCalls[0]?.[1]).toBe(0);
	});

	test("appends stdout to the log file", async () => {
		const scripts = [makeEntry({ id: "a", script: "echo hello" })];
		const spawner = makeSpawner({
			"echo hello": { exitCode: 0, stdout: "hello from stdout\n" },
		});
		const appendedChunks: string[] = [];
		const mockLogService = {
			writeScriptBanner: async () => {},
			appendOutput: async (_f: string, chunk: string) => {
				appendedChunks.push(chunk);
			},
			writeScriptFooter: async () => {},
			writeScriptInputs: async () => {},
		};
		const runner = new ScriptRunner({
			logService: mockLogService as unknown as LogService,
			spawner,
		});

		await runner.runScripts(scripts, logFile);

		expect(appendedChunks).toContain("hello from stdout\n");
	});

	test("appends stderr to the log file", async () => {
		const scripts = [makeEntry({ id: "a", script: "echo err" })];
		const spawner = makeSpawner({
			"echo err": { exitCode: 0, stderr: "error output\n" },
		});
		const appendedChunks: string[] = [];
		const mockLogService = {
			writeScriptBanner: async () => {},
			appendOutput: async (_f: string, chunk: string) => {
				appendedChunks.push(chunk);
			},
			writeScriptFooter: async () => {},
			writeScriptInputs: async () => {},
		};
		const runner = new ScriptRunner({
			logService: mockLogService as unknown as LogService,
			spawner,
		});

		await runner.runScripts(scripts, logFile);

		expect(appendedChunks).toContain("error output\n");
	});

	test("writes a footer with exit code 1 when a script fails", async () => {
		const scripts = [makeEntry({ id: "a", script: "bad" })];
		const spawner = makeSpawner({ bad: { exitCode: 1 } });
		const footerCalls: Array<[string, number, Date]> = [];
		const mockLogService = {
			writeScriptBanner: async () => {},
			appendOutput: async () => {},
			writeScriptFooter: async (f: string, code: number, t: Date) => {
				footerCalls.push([f, code, t]);
			},
			writeScriptInputs: async () => {},
		};
		const runner = new ScriptRunner({
			logService: mockLogService as unknown as LogService,
			spawner,
		});

		await runner.runScripts(scripts, logFile);

		expect(footerCalls[0]?.[1]).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// Progress events
// ---------------------------------------------------------------------------

describe("progress events", () => {
	test("emits pending event for each script before execution starts", async () => {
		const scripts = [
			makeEntry({ id: "a", script: "echo a" }),
			makeEntry({ id: "b", script: "echo b" }),
		];
		const spawner = makeSpawner({
			"echo a": { exitCode: 0 },
			"echo b": { exitCode: 0 },
		});
		const events: ProgressEvent[] = [];
		const runner = new ScriptRunner({ logService, spawner });
		runner.on("progress", (e) => events.push(e));

		await runner.runScripts(scripts, logFile);

		const pendingEvents = events.filter((e) => e.status === "pending");
		expect(pendingEvents.length).toBe(2);
		expect(pendingEvents.map((e) => e.scriptId)).toContain("a");
		expect(pendingEvents.map((e) => e.scriptId)).toContain("b");
	});

	test("emits running event when a script starts", async () => {
		const scripts = [makeEntry({ id: "a", script: "echo a" })];
		const spawner = makeSpawner({ "echo a": { exitCode: 0 } });
		const events: ProgressEvent[] = [];
		const runner = new ScriptRunner({ logService, spawner });
		runner.on("progress", (e) => events.push(e));

		await runner.runScripts(scripts, logFile);

		const runningEvent = events.find(
			(e) => e.status === "running" && e.scriptId === "a",
		);
		expect(runningEvent).toBeDefined();
	});

	test("emits done event when a script succeeds", async () => {
		const scripts = [makeEntry({ id: "a", script: "echo a" })];
		const spawner = makeSpawner({ "echo a": { exitCode: 0 } });
		const events: ProgressEvent[] = [];
		const runner = new ScriptRunner({ logService, spawner });
		runner.on("progress", (e) => events.push(e));

		await runner.runScripts(scripts, logFile);

		const doneEvent = events.find(
			(e) => e.status === "done" && e.scriptId === "a",
		);
		expect(doneEvent).toBeDefined();
	});

	test("emits failed event when a script exits non-zero", async () => {
		const scripts = [makeEntry({ id: "a", script: "bad" })];
		const spawner = makeSpawner({ bad: { exitCode: 1 } });
		const events: ProgressEvent[] = [];
		const runner = new ScriptRunner({ logService, spawner });
		runner.on("progress", (e) => events.push(e));

		await runner.runScripts(scripts, logFile);

		const failedEvent = events.find(
			(e) => e.status === "failed" && e.scriptId === "a",
		);
		expect(failedEvent).toBeDefined();
	});

	test("emits events in order: pending... running done for success", async () => {
		const scripts = [makeEntry({ id: "a", script: "echo a" })];
		const spawner = makeSpawner({ "echo a": { exitCode: 0 } });
		const events: ProgressEvent[] = [];
		const runner = new ScriptRunner({ logService, spawner });
		runner.on("progress", (e) => events.push(e));

		await runner.runScripts(scripts, logFile);

		const statuses = events.map((e) => e.status);
		const pendingIdx = statuses.indexOf("pending");
		const runningIdx = statuses.indexOf("running");
		const doneIdx = statuses.indexOf("done");
		expect(pendingIdx).toBeLessThan(runningIdx);
		expect(runningIdx).toBeLessThan(doneIdx);
	});

	test("failed event includes exit code", async () => {
		const scripts = [makeEntry({ id: "a", script: "bad" })];
		const spawner = makeSpawner({ bad: { exitCode: 5 } });
		const events: ProgressEvent[] = [];
		const runner = new ScriptRunner({ logService, spawner });
		runner.on("progress", (e) => events.push(e));

		await runner.runScripts(scripts, logFile);

		const failedEvent = events.find(
			(e): e is ProgressEvent & { status: "failed" } =>
				e.status === "failed" && e.scriptId === "a",
		);
		expect(failedEvent).toBeDefined();
		expect(failedEvent?.exitCode).toBe(5);
	});
});

// ---------------------------------------------------------------------------
// Input args (FR-3-030, FR-3-031, FR-3-032)
// ---------------------------------------------------------------------------

describe("input args", () => {
	test("script with two string inputs — command invoked with both values appended as positional args in declaration order", async () => {
		const capturedCommands: string[] = [];
		const spawner = async (
			cmd: string,
			_out: (c: string) => void,
			_err: (c: string) => void,
		) => {
			capturedCommands.push(cmd);
			return 0;
		};

		const scriptInputs: ScriptInputs = new Map([
			[
				"my-script",
				[
					{ id: "first", label: "First", value: "hello" },
					{ id: "second", label: "Second", value: "world" },
				],
			],
		]);

		const scripts = [makeEntry({ id: "my-script", script: "myscript.sh" })];
		const runner = new ScriptRunner({ logService, spawner });

		await runner.runScripts(scripts, logFile, scriptInputs);

		expect(capturedCommands[0]).toBe("myscript.sh hello world");
	});

	test("script with ssl-cert input — arg value is the download path", async () => {
		const capturedCommands: string[] = [];
		const spawner = async (
			cmd: string,
			_out: (c: string) => void,
			_err: (c: string) => void,
		) => {
			capturedCommands.push(cmd);
			return 0;
		};

		const scriptInputs: ScriptInputs = new Map([
			[
				"cert-script",
				[
					{
						id: "cert",
						label: "Certificate",
						value: "/tmp/cert.pem",
						certCN: "example.com",
					},
				],
			],
		]);

		const scripts = [makeEntry({ id: "cert-script", script: "deploy.sh" })];
		const runner = new ScriptRunner({ logService, spawner });

		await runner.runScripts(scripts, logFile, scriptInputs);

		expect(capturedCommands[0]).toBe("deploy.sh /tmp/cert.pem");
	});

	test("script with no inputs — invoked with no extra args", async () => {
		const capturedCommands: string[] = [];
		const spawner = async (
			cmd: string,
			_out: (c: string) => void,
			_err: (c: string) => void,
		) => {
			capturedCommands.push(cmd);
			return 0;
		};

		const scripts = [makeEntry({ id: "plain", script: "plain.sh" })];
		const runner = new ScriptRunner({ logService, spawner });

		await runner.runScripts(scripts, logFile);

		expect(capturedCommands[0]).toBe("plain.sh");
	});
});
