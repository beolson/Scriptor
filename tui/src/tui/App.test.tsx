import { afterEach, describe, expect, mock, test } from "bun:test";
import { PassThrough } from "node:stream";
import { render } from "ink";
import type { ProgressEvent } from "../execution/scriptRunner.js";
import type { InputDef, ScriptInputs } from "../inputs/inputSchema.js";
import { MockCertFetcher } from "../inputs/sslCert/certFetcher.js";
import type { ScriptEntry } from "../manifest/parseManifest.js";
import type { StartupResult } from "../startup/startup.js";
import type { AppProps } from "./App.js";
import { App } from "./App.js";

// ─── TTY Helpers ──────────────────────────────────────────────────────────────

function makeStdin() {
	const stream = new PassThrough() as unknown as NodeJS.ReadStream;
	// biome-ignore lint/suspicious/noExplicitAny: TTY mock
	(stream as any).isTTY = true;
	// biome-ignore lint/suspicious/noExplicitAny: TTY mock
	(stream as any).setRawMode = () => {};
	// biome-ignore lint/suspicious/noExplicitAny: TTY mock
	(stream as any).ref = () => {};
	// biome-ignore lint/suspicious/noExplicitAny: TTY mock
	(stream as any).unref = () => {};
	return stream;
}

function makeStdout() {
	const stream = new PassThrough() as unknown as NodeJS.WriteStream;
	// biome-ignore lint/suspicious/noExplicitAny: TTY mock
	(stream as any).columns = 80;
	return stream;
}

async function wait(ms = 80) {
	await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function drainStdout(stdout: NodeJS.WriteStream): string {
	const chunks: string[] = [];
	let chunk: Buffer | string | null;
	// biome-ignore lint/suspicious/noAssignInExpressions: drain loop
	while ((chunk = (stdout as unknown as PassThrough).read()) !== null) {
		chunks.push(chunk.toString());
	}
	return chunks.join("");
}

async function typeAndSubmit(stdin: NodeJS.ReadStream, text: string) {
	stdin.push(text);
	await wait(50);
	stdin.push("\r");
	await wait(50);
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const HOST_INFO = {
	platform: "linux" as const,
	arch: "x86" as const,
	distro: "ubuntu",
	version: "24.04",
};

const stringInputDef: InputDef = {
	id: "username",
	type: "string",
	label: "GitHub Username",
	required: false,
};

function makeScript(
	id: string,
	name: string,
	inputs: InputDef[] = [],
): ScriptEntry {
	return {
		id,
		name,
		description: `Script ${name}`,
		platform: "linux",
		arch: "x86",
		script: `echo ${id}`,
		dependencies: [],
		inputs,
		distro: "ubuntu",
		version: "24.04",
		requires_sudo: false,
	};
}

const _scriptWithInput = makeScript("script-a", "Deploy Script", [
	stringInputDef,
]);
const _scriptNoInput = makeScript("script-b", "Plain Script", []);

/**
 * The manifest YAML that the mock startup will return.
 * Contains one script with an input and one without.
 */
const MANIFEST_YAML = `
- id: script-a
  name: Deploy Script
  description: Script Deploy Script
  platform: linux
  arch: x86
  distro: ubuntu
  version: "24.04"
  script: echo script-a
  inputs:
    - id: username
      type: string
      label: GitHub Username
- id: script-b
  name: Plain Script
  description: Script Plain Script
  platform: linux
  arch: x86
  distro: ubuntu
  version: "24.04"
  script: echo script-b
`.trim();

const STARTUP_RESULT: StartupResult = {
	manifestYaml: MANIFEST_YAML,
	scripts: {},
	offline: false,
};

/**
 * Builds default AppProps: startup resolves immediately with a ready result,
 * execution never starts (tests that need it override runExecution).
 */
function makeAppProps(overrides: Partial<AppProps> = {}): AppProps {
	return {
		hostInfo: HOST_INFO,
		repoUrl: "owner/repo",
		runStartup: async (_repo, _onEvent) => STARTUP_RESULT,
		runExecution: async (_scripts, _onProgress) => ({
			success: true,
			logFile: "/tmp/scriptor.log",
		}),
		fetcher: new MockCertFetcher([]),
		...overrides,
	};
}

/**
 * Advances the app from the initial fetch screen to the script-list screen
 * by waiting for startup to finish and pressing Enter.
 */
async function advanceToScriptList(stdin: NodeJS.ReadStream) {
	// Wait for startup to complete
	await wait(100);
	// Press Enter to move from fetch screen → script list
	stdin.push("\r");
	await wait(50);
}

/**
 * Selects the first script in the list (Space) then confirms (Enter).
 * This takes the app from script-list → input-collection (if the script has
 * inputs) or straight to confirmation (if it doesn't).
 */
async function selectFirstScriptAndConfirm(stdin: NodeJS.ReadStream) {
	// Space to select first script
	stdin.push(" ");
	await wait(50);
	// Enter to confirm selection
	stdin.push("\r");
	await wait(50);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("App — Task 9 integration", () => {
	const instances: ReturnType<typeof render>[] = [];

	afterEach(() => {
		for (const inst of instances) {
			try {
				inst.unmount();
				inst.cleanup();
			} catch {
				// ignore
			}
		}
		instances.length = 0;
	});

	// Test 1: selecting a script with inputs transitions to the input collection screen
	test("selecting a script with inputs transitions to the input collection screen", async () => {
		const stdin = makeStdin();
		const stdout = makeStdout();

		const inst = render(<App {...makeAppProps()} />, {
			stdin,
			stdout,
			exitOnCtrlC: false,
			debug: true,
		});
		instances.push(inst);

		await advanceToScriptList(stdin);
		// Select script-a (has inputs) and confirm
		await selectFirstScriptAndConfirm(stdin);

		const frame = drainStdout(stdout);
		// Should show the input collection screen prompting for the string input
		expect(frame).toContain("GitHub Username");
		// Should show the owning script's name as context (FR-3-003)
		expect(frame).toContain("Deploy Script");
	});

	// Test 2: completing input collection transitions to the confirmation screen
	// showing input values
	test("completing input collection transitions to confirmation screen with input values", async () => {
		const stdin = makeStdin();
		const stdout = makeStdout();

		const inst = render(<App {...makeAppProps()} />, {
			stdin,
			stdout,
			exitOnCtrlC: false,
			debug: true,
		});
		instances.push(inst);

		await advanceToScriptList(stdin);
		await selectFirstScriptAndConfirm(stdin);

		// Submit the string input value
		await typeAndSubmit(stdin, "octocat");

		const frame = drainStdout(stdout);
		// Should be on the confirmation screen showing the collected value
		expect(frame).toContain("Deploy Script");
		expect(frame).toContain("GitHub Username");
		expect(frame).toContain("octocat");
		// Confirmation screen hint
		expect(frame).toContain("Run");
	});

	// Test 3: cancelling input collection exits the app
	test("cancelling input collection exits the app", async () => {
		const stdin = makeStdin();
		const stdout = makeStdout();

		const inst = render(<App {...makeAppProps()} />, {
			stdin,
			stdout,
			exitOnCtrlC: false,
			debug: true,
		});
		instances.push(inst);

		// Set a race: either waitUntilExit resolves (success) or we time out (fail)
		const exitPromise = inst.waitUntilExit();
		const timeoutPromise = new Promise<never>((_resolve, reject) =>
			setTimeout(
				() => reject(new Error("App did not exit within timeout")),
				3000,
			),
		);

		await advanceToScriptList(stdin);
		await selectFirstScriptAndConfirm(stdin);

		// Press Q to trigger cancel confirmation
		stdin.push("q");
		await wait(80);

		// Confirm the cancellation
		stdin.push("y");
		await wait(80);

		// waitUntilExit should resolve (app exited due to cancel)
		await Promise.race([exitPromise, timeoutPromise]);
	});

	// Test 4: selecting a script with no inputs skips input collection and goes
	// straight to confirmation
	test("selecting a script with no inputs skips input collection and goes straight to confirmation", async () => {
		// Use a manifest with only script-b (no inputs)
		const manifestNoInputs = `
- id: script-b
  name: Plain Script
  description: Script Plain Script
  platform: linux
  arch: x86
  distro: ubuntu
  version: "24.04"
  script: echo script-b
`.trim();

		const stdin = makeStdin();
		const stdout = makeStdout();

		const props = makeAppProps({
			runStartup: async () => ({
				manifestYaml: manifestNoInputs,
				scripts: {},
				offline: false,
			}),
		});

		const inst = render(<App {...props} />, {
			stdin,
			stdout,
			exitOnCtrlC: false,
			debug: true,
		});
		instances.push(inst);

		await advanceToScriptList(stdin);
		await selectFirstScriptAndConfirm(stdin);

		const frame = drainStdout(stdout);
		// Should land directly on confirmation screen (no input prompts)
		expect(frame).toContain("Plain Script");
		// Confirmation-screen-specific text
		expect(frame).toContain("Run");
		// Should NOT show any input prompts
		expect(frame).not.toContain("GitHub Username");
	});

	// Test 5: confirming execution calls the runner with correct positional args
	test("confirming execution calls the runner with correct positional args appended", async () => {
		const runExecution = mock(
			async (
				_scripts: ScriptEntry[],
				_onProgress: (event: ProgressEvent) => void,
				scriptInputs?: ScriptInputs,
			) => {
				// Verify inputs are passed
				const inputs = scriptInputs?.get("script-a");
				expect(inputs).toBeDefined();
				expect(inputs?.[0]?.value).toBe("octocat");
				return { success: true as const, logFile: "/tmp/scriptor.log" };
			},
		);

		const stdin = makeStdin();
		const stdout = makeStdout();

		const inst = render(
			<App
				{...makeAppProps({
					runExecution,
				})}
			/>,
			{ stdin, stdout, exitOnCtrlC: false, debug: true },
		);
		instances.push(inst);

		await advanceToScriptList(stdin);
		await selectFirstScriptAndConfirm(stdin);

		// Submit input
		await typeAndSubmit(stdin, "octocat");

		// Confirm execution on the confirmation screen (press Y)
		stdin.push("y");
		await wait(200);

		expect(runExecution).toHaveBeenCalledTimes(1);
	});
});

// ─── Sudo Flow Tests ──────────────────────────────────────────────────────────

describe("App — sudo flow", () => {
	const instances: ReturnType<typeof render>[] = [];

	afterEach(() => {
		for (const inst of instances) {
			try {
				inst.unmount();
				inst.cleanup();
			} catch {
				// ignore
			}
		}
		instances.length = 0;
	});

	const SUDO_MANIFEST = `
- id: sudo-script
  name: Sudo Script
  description: Needs sudo
  platform: linux
  arch: x86
  distro: ubuntu
  version: "24.04"
  script: echo sudo
  requires_sudo: true
`.trim();

	const NO_SUDO_MANIFEST = `
- id: plain-script
  name: Plain Script
  description: No sudo
  platform: linux
  arch: x86
  distro: ubuntu
  version: "24.04"
  script: echo plain
`.trim();

	function makeSudoProps(
		manifest: string,
		validateSudo: AppProps["validateSudo"],
		overrides: Partial<AppProps> = {},
	): AppProps {
		return makeAppProps({
			runStartup: async () => ({
				manifestYaml: manifest,
				scripts: {},
				offline: false,
			}),
			validateSudo,
			...overrides,
		});
	}

	test("scripts with requires_sudo trigger sudo screen after confirmation", async () => {
		const stdin = makeStdin();
		const stdout = makeStdout();

		const props = makeSudoProps(SUDO_MANIFEST, async () => ({
			ok: false,
			reason: "Password required",
		}));

		const inst = render(<App {...props} />, {
			stdin,
			stdout,
			exitOnCtrlC: false,
			debug: true,
		});
		instances.push(inst);

		await advanceToScriptList(stdin);
		await selectFirstScriptAndConfirm(stdin);

		// Confirm execution
		stdin.push("y");
		await wait(150);

		const frame = drainStdout(stdout);
		expect(frame).toContain("Sudo authentication required");
	});

	test("successful sudo validation transitions to execution", async () => {
		const stdin = makeStdin();
		const stdout = makeStdout();
		const runExecution = mock(
			async (
				_scripts: ScriptEntry[],
				_onProgress: (event: ProgressEvent) => void,
			) => ({
				success: true as const,
				logFile: "/tmp/scriptor.log",
			}),
		);

		const props = makeSudoProps(
			SUDO_MANIFEST,
			async (password) => {
				if (password === "") return { ok: false, reason: "Password required" };
				return { ok: true };
			},
			{ runExecution },
		);

		const inst = render(<App {...props} />, {
			stdin,
			stdout,
			exitOnCtrlC: false,
			debug: true,
		});
		instances.push(inst);

		await advanceToScriptList(stdin);
		await selectFirstScriptAndConfirm(stdin);

		// Confirm execution → triggers sudo screen
		stdin.push("y");
		await wait(150);

		// Type password and submit
		stdin.push("correctpass");
		await wait(50);
		stdin.push("\r");
		await wait(200);

		expect(runExecution).toHaveBeenCalledTimes(1);
	});

	test("failed sudo validation shows error and allows retry", async () => {
		const stdin = makeStdin();
		const stdout = makeStdout();
		let callCount = 0;

		const props = makeSudoProps(SUDO_MANIFEST, async (password) => {
			if (password === "") return { ok: false, reason: "Password required" };
			callCount++;
			if (callCount === 1) {
				return { ok: false, reason: "sudo authentication failed" };
			}
			return { ok: true };
		});

		const inst = render(<App {...props} />, {
			stdin,
			stdout,
			exitOnCtrlC: false,
			debug: true,
		});
		instances.push(inst);

		await advanceToScriptList(stdin);
		await selectFirstScriptAndConfirm(stdin);

		// Confirm → sudo screen
		stdin.push("y");
		await wait(150);

		// Wrong password
		stdin.push("wrong");
		await wait(50);
		stdin.push("\r");
		await wait(150);

		const frame = drainStdout(stdout);
		expect(frame).toContain("sudo authentication failed");
	});

	test("Escape on sudo screen goes back to confirmation", async () => {
		const stdin = makeStdin();
		const stdout = makeStdout();

		const props = makeSudoProps(SUDO_MANIFEST, async () => ({
			ok: false,
			reason: "Password required",
		}));

		const inst = render(<App {...props} />, {
			stdin,
			stdout,
			exitOnCtrlC: false,
			debug: true,
		});
		instances.push(inst);

		await advanceToScriptList(stdin);
		await selectFirstScriptAndConfirm(stdin);

		// Confirm → sudo screen
		stdin.push("y");
		await wait(150);

		// Escape → back to confirmation
		stdin.push("\x1b");
		await wait(100);

		const frame = drainStdout(stdout);
		expect(frame).toContain("Sudo Script");
		expect(frame).toContain("Run");
	});

	test("scripts without requires_sudo skip sudo screen entirely", async () => {
		const stdin = makeStdin();
		const stdout = makeStdout();
		const runExecution = mock(
			async (
				_scripts: ScriptEntry[],
				_onProgress: (event: ProgressEvent) => void,
			) => ({
				success: true as const,
				logFile: "/tmp/scriptor.log",
			}),
		);

		const props = makeSudoProps(NO_SUDO_MANIFEST, async () => ({ ok: true }), {
			runExecution,
		});

		const inst = render(<App {...props} />, {
			stdin,
			stdout,
			exitOnCtrlC: false,
			debug: true,
		});
		instances.push(inst);

		await advanceToScriptList(stdin);
		await selectFirstScriptAndConfirm(stdin);

		// Confirm execution → should go straight to execution (no sudo prompt)
		stdin.push("y");
		await wait(200);

		expect(runExecution).toHaveBeenCalledTimes(1);
	});

	test("validateSudo returning ok for empty string (cached) skips password prompt", async () => {
		const stdin = makeStdin();
		const stdout = makeStdout();
		const runExecution = mock(
			async (
				_scripts: ScriptEntry[],
				_onProgress: (event: ProgressEvent) => void,
			) => ({
				success: true as const,
				logFile: "/tmp/scriptor.log",
			}),
		);

		const props = makeSudoProps(
			SUDO_MANIFEST,
			async () => ({ ok: true }), // always returns ok (cached)
			{ runExecution },
		);

		const inst = render(<App {...props} />, {
			stdin,
			stdout,
			exitOnCtrlC: false,
			debug: true,
		});
		instances.push(inst);

		await advanceToScriptList(stdin);
		await selectFirstScriptAndConfirm(stdin);

		// Confirm execution → triggers sudo screen → cached → straight to execution
		stdin.push("y");
		await wait(200);

		expect(runExecution).toHaveBeenCalledTimes(1);
	});
});
