// ---------------------------------------------------------------------------
// ScriptRunner Tests
//
// Tests exercise `buildArgList` and `runScripts` with injectable deps.
// No real processes are created; stdout/stderr are inherited (not captured).
// ---------------------------------------------------------------------------

import { describe, expect, it } from "bun:test";
import type { ScriptEntry, ScriptInputs } from "../manifest/types.js";
import type { ScriptRunnerDeps } from "./scriptRunner.js";
import { buildArgList, runScripts } from "./scriptRunner.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeScript(
	id: string,
	overrides: Partial<ScriptEntry> = {},
): ScriptEntry {
	return {
		id,
		name: `Script ${id}`,
		description: `Description for ${id}`,
		platform: "linux",
		arch: "x86",
		script: `${id}.sh`,
		dependencies: [],
		optional_dependencies: [],
		requires_elevation: false,
		inputs: [],
		...overrides,
	};
}

function makeSpawnResult(exitCode: number): { exited: Promise<number> } {
	return { exited: Promise.resolve(exitCode) };
}

function makeFakeDeps(
	overrides: Partial<ScriptRunnerDeps> = {},
): ScriptRunnerDeps {
	return {
		platform: "linux",
		readScript: async (_entry) => "#!/bin/sh\necho hello",
		spawn: (_cmd, _opts) => makeSpawnResult(0),
		stdoutWrite: (_msg) => {},
		startKeepalive: () => setTimeout(() => {}, 999999),
		stopKeepalive: (timer) => clearTimeout(timer),
		now: () => new Date("2026-03-24T10:00:00.000Z"),
		tmpdir: () => "/tmp",
		writeFile: async (_path, _data) => {},
		unlink: async (_path) => {},
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// buildArgList
// ---------------------------------------------------------------------------

describe("buildArgList", () => {
	it("script with no inputs returns just [''] (empty installed string)", () => {
		const script = makeScript("s");
		const inputs: ScriptInputs = new Map();
		const installedIds = new Set<string>();

		const result = buildArgList(script, inputs, installedIds);

		expect(result).toEqual([""]);
	});

	it("single string input with empty installed set → ['value', '']", () => {
		const script = makeScript("s", {
			inputs: [{ id: "db-name", type: "string", label: "Database name" }],
		});
		const inputs: ScriptInputs = new Map([["db-name", { value: "mydb" }]]);
		const installedIds = new Set<string>();

		const result = buildArgList(script, inputs, installedIds);

		expect(result).toEqual(["mydb", ""]);
	});

	it("two inputs are placed in declaration order", () => {
		const script = makeScript("s", {
			inputs: [
				{ id: "first", type: "string", label: "First" },
				{ id: "second", type: "string", label: "Second" },
			],
		});
		const inputs: ScriptInputs = new Map([
			["first", { value: "alpha" }],
			["second", { value: "beta" }],
		]);
		const installedIds = new Set<string>();

		const result = buildArgList(script, inputs, installedIds);

		expect(result).toEqual(["alpha", "beta", ""]);
	});

	it("installed items joined with colon", () => {
		const script = makeScript("s");
		const inputs: ScriptInputs = new Map();
		const installedIds = new Set(["app-a", "app-b"]);

		const result = buildArgList(script, inputs, installedIds);

		// biome-ignore lint/style/noNonNullAssertion: result always has at least one element
		const last = result[result.length - 1]!;
		expect(last).toBe("app-a:app-b");
	});

	it("empty installed set appends trailing empty string", () => {
		const script = makeScript("s", {
			inputs: [{ id: "x", type: "string", label: "X" }],
		});
		const inputs: ScriptInputs = new Map([["x", { value: "hello" }]]);
		const installedIds = new Set<string>();

		const result = buildArgList(script, inputs, installedIds);

		expect(result[result.length - 1]).toBe("");
	});

	it("missing input value falls back to empty string", () => {
		const script = makeScript("s", {
			inputs: [{ id: "optional", type: "string", label: "Optional" }],
		});
		const inputs: ScriptInputs = new Map();
		const installedIds = new Set<string>();

		const result = buildArgList(script, inputs, installedIds);

		expect(result[0]).toBe("");
	});

	it("multiple installed IDs joined in Set iteration order", () => {
		const script = makeScript("s");
		const inputs: ScriptInputs = new Map();
		const installedIds = new Set(["z-tool", "a-tool", "m-tool"]);

		const result = buildArgList(script, inputs, installedIds);

		expect(result[0]).toBe("z-tool:a-tool:m-tool");
	});
});

// ---------------------------------------------------------------------------
// runScripts
// ---------------------------------------------------------------------------

describe("runScripts", () => {
	it("single script success returns { success: true }", async () => {
		const script = makeScript("s1");

		const result = await runScripts(
			[script],
			new Map(),
			new Set(),
			makeFakeDeps(),
		);

		expect(result.success).toBe(true);
	});

	it("first script failure returns { success: false, failedScript, exitCode }", async () => {
		const script = makeScript("s1");

		const result = await runScripts(
			[script],
			new Map(),
			new Set(),
			makeFakeDeps({ spawn: () => makeSpawnResult(1) }),
		);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.failedScript.id).toBe("s1");
			expect(result.exitCode).toBe(1);
		}
	});

	it("second script is not started after first failure", async () => {
		const s1 = makeScript("s1");
		const s2 = makeScript("s2");
		const spawned: string[] = [];

		await runScripts(
			[s1, s2],
			new Map(),
			new Set(),
			makeFakeDeps({
				spawn: (cmd, _opts) => {
					spawned.push(cmd.join(" "));
					return makeSpawnResult(1);
				},
				readScript: async (entry) => `#!/bin/sh\necho ${entry.id}`,
			}),
		);

		expect(spawned.length).toBe(1);
	});

	it("Unix invocation uses sh -c with script content", async () => {
		let spawnedCmd: string[] = [];
		const content = "#!/bin/sh\necho hi";

		await runScripts(
			[makeScript("s1")],
			new Map(),
			new Set(),
			makeFakeDeps({
				platform: "linux",
				readScript: async () => content,
				spawn: (cmd, _opts) => {
					spawnedCmd = cmd;
					return makeSpawnResult(0);
				},
			}),
		);

		expect(spawnedCmd[0]).toBe("sh");
		expect(spawnedCmd[1]).toBe("-c");
		expect(spawnedCmd[2]).toBe(content);
	});

	it("Unix invocation uses inherit for stdout/stderr/stdin", async () => {
		let capturedOpts: { stdout?: string; stderr?: string; stdin?: string } = {};

		await runScripts(
			[makeScript("s1")],
			new Map(),
			new Set(),
			makeFakeDeps({
				platform: "linux",
				spawn: (_cmd, opts) => {
					capturedOpts = opts;
					return makeSpawnResult(0);
				},
			}),
		);

		expect(capturedOpts.stdout).toBe("inherit");
		expect(capturedOpts.stderr).toBe("inherit");
		expect(capturedOpts.stdin).toBe("inherit");
	});

	it("Windows invocation writes temp .ps1 and spawns powershell.exe", async () => {
		let writtenPath = "";
		let writtenContent = "";
		let spawnedCmd: string[] = [];
		const content = "Write-Output 'hello'";
		const timestamp = Date.now();

		await runScripts(
			[makeScript("s1", { platform: "windows" })],
			new Map(),
			new Set(),
			makeFakeDeps({
				platform: "win32",
				readScript: async () => content,
				writeFile: async (path, data) => {
					writtenPath = path;
					writtenContent = data;
				},
				spawn: (cmd, _opts) => {
					spawnedCmd = cmd;
					return makeSpawnResult(0);
				},
				tmpdir: () => "/tmp",
				now: () => new Date(timestamp),
			}),
		);

		expect(writtenPath).toMatch(/\/tmp\/scriptor-.*\.ps1$/);
		expect(writtenContent).toContain(content);
		expect(spawnedCmd[0]).toBe("powershell.exe");
		expect(spawnedCmd).toContain("-File");
		expect(spawnedCmd).toContain(writtenPath);
	});

	it("Windows temp file is deleted in finally even on failure", async () => {
		const unlinked: string[] = [];

		await runScripts(
			[makeScript("s1", { platform: "windows" })],
			new Map(),
			new Set(),
			makeFakeDeps({
				platform: "win32",
				readScript: async () => "Write-Output 'hi'",
				spawn: () => makeSpawnResult(1),
				unlink: async (path) => {
					unlinked.push(path);
				},
				tmpdir: () => "/tmp",
			}),
		);

		expect(unlinked.length).toBe(1);
		expect(unlinked[0]).toMatch(/\/tmp\/scriptor-.*\.ps1$/);
	});

	it("requires_elevation script (Unix) calls startKeepalive before spawn and stopKeepalive after", async () => {
		const events: string[] = [];
		let timer: NodeJS.Timeout | undefined;

		await runScripts(
			[makeScript("s1", { requires_elevation: true })],
			new Map(),
			new Set(),
			makeFakeDeps({
				platform: "linux",
				startKeepalive: () => {
					events.push("startKeepalive");
					timer = setTimeout(() => {}, 999999);
					return timer;
				},
				spawn: (_cmd, _opts) => {
					events.push("spawn");
					return makeSpawnResult(0);
				},
				stopKeepalive: (t) => {
					events.push("stopKeepalive");
					clearTimeout(t);
				},
			}),
		);

		const startIdx = events.indexOf("startKeepalive");
		const spawnIdx = events.indexOf("spawn");
		const stopIdx = events.indexOf("stopKeepalive");
		expect(startIdx).toBeLessThan(spawnIdx);
		expect(spawnIdx).toBeLessThan(stopIdx);
	});

	it("non-elevation script does not call startKeepalive", async () => {
		let keepaliveStarted = false;

		await runScripts(
			[makeScript("s1", { requires_elevation: false })],
			new Map(),
			new Set(),
			makeFakeDeps({
				platform: "linux",
				startKeepalive: () => {
					keepaliveStarted = true;
					return setTimeout(() => {}, 999999);
				},
			}),
		);

		expect(keepaliveStarted).toBe(false);
	});

	it("buildArgList output is passed as trailing args to spawn (Unix)", async () => {
		let spawnedArgs: string[] = [];
		const script = makeScript("s1", {
			inputs: [{ id: "myinput", type: "string", label: "My Input" }],
		});
		const inputs: ScriptInputs = new Map([["myinput", { value: "hello" }]]);

		await runScripts(
			[script],
			inputs,
			new Set(["app-a"]),
			makeFakeDeps({
				platform: "linux",
				readScript: async () => "#!/bin/sh",
				spawn: (cmd, _opts) => {
					spawnedArgs = cmd;
					return makeSpawnResult(0);
				},
			}),
		);

		// sh -c <content> sh <input_args...>
		const trailingArgs = spawnedArgs.slice(4);
		expect(trailingArgs).toEqual(["hello", "app-a"]);
	});

	it("'Running: {name}' printed before each script", async () => {
		const printed: string[] = [];
		const s1 = makeScript("s1", { name: "Script One" });
		const s2 = makeScript("s2", { name: "Script Two" });

		await runScripts(
			[s1, s2],
			new Map(),
			new Set(),
			makeFakeDeps({
				stdoutWrite: (msg) => {
					printed.push(msg);
				},
			}),
		);

		const combined = printed.join("");
		expect(combined).toContain("Running: Script One");
		expect(combined).toContain("Running: Script Two");
		const idx1 = combined.indexOf("Running: Script One");
		const idx2 = combined.indexOf("Running: Script Two");
		expect(idx1).toBeLessThan(idx2);
	});

	it("'✗ {name} failed (exit code N)' printed on failure", async () => {
		const printed: string[] = [];

		await runScripts(
			[makeScript("s1", { name: "My Script" })],
			new Map(),
			new Set(),
			makeFakeDeps({
				spawn: () => makeSpawnResult(42),
				stdoutWrite: (msg) => {
					printed.push(msg);
				},
			}),
		);

		expect(printed.join("")).toContain("✗ My Script failed (exit code 42)");
	});

	it("multiple installed IDs passed as colon-joined trailing arg", async () => {
		let spawnedArgs: string[] = [];

		await runScripts(
			[makeScript("s1")],
			new Map(),
			new Set(["id-a", "id-b", "id-c"]),
			makeFakeDeps({
				platform: "linux",
				readScript: async () => "#!/bin/sh",
				spawn: (cmd, _opts) => {
					spawnedArgs = cmd;
					return makeSpawnResult(0);
				},
			}),
		);

		const lastArg = spawnedArgs[spawnedArgs.length - 1];
		expect(lastArg).toBe("id-a:id-b:id-c");
	});
});
