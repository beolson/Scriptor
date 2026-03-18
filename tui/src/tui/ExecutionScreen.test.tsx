import { afterEach, describe, expect, test } from "bun:test";
import { PassThrough } from "node:stream";
import { render } from "ink";
import type {
	ProgressEvent,
	ScriptRunResult,
} from "../execution/scriptRunner.js";
import type { ScriptEntry } from "../manifest/parseManifest.js";
import { ExecutionScreen } from "./ExecutionScreen.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function drainStdout(stdout: NodeJS.WriteStream): string {
	const chunks: string[] = [];
	let chunk: Buffer | string | null;
	// biome-ignore lint/suspicious/noAssignInExpressions: drain loop
	while ((chunk = (stdout as unknown as PassThrough).read()) !== null) {
		chunks.push(chunk.toString());
	}
	return chunks.join("");
}

async function wait(ms = 80) {
	await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function makeScript(id: string, name: string): ScriptEntry {
	return {
		id,
		name,
		description: `Script ${name}`,
		platform: "linux",
		arch: "x86",
		script: `echo ${id}`,
		dependencies: [],
		inputs: [],
		distro: "ubuntu",
		version: "24.04",
		requires_sudo: false,
		requires_admin: false,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ExecutionScreen — output display", () => {
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

	test("output lines from a running script are rendered", async () => {
		const scripts = [makeScript("s", "My Script")];
		const stdout = makeStdout();
		const stdin = makeStdin();

		const runExecution = async (
			onProgress: (event: ProgressEvent) => void,
		): Promise<ScriptRunResult> => {
			onProgress({ status: "running", scriptId: "s" });
			onProgress({
				status: "output",
				scriptId: "s",
				line: "hello from script",
			});
			// Never resolve — keep running so the output stays visible
			return new Promise(() => {});
		};

		const inst = render(
			<ExecutionScreen scripts={scripts} runExecution={runExecution} />,
			{ stdin, stdout, exitOnCtrlC: false, debug: true },
		);
		instances.push(inst);

		await wait(100);

		expect(drainStdout(stdout)).toContain("hello from script");
	});

	test("output lines from a failed script remain visible after failure", async () => {
		const scripts = [makeScript("s", "Fail Script")];
		const stdout = makeStdout();
		const stdin = makeStdin();

		const runExecution = async (
			onProgress: (event: ProgressEvent) => void,
		): Promise<ScriptRunResult> => {
			onProgress({ status: "running", scriptId: "s" });
			onProgress({
				status: "output",
				scriptId: "s",
				line: "fatal: something went wrong",
			});
			onProgress({ status: "failed", scriptId: "s", exitCode: 1 });
			return {
				success: false,
				logFile: "/tmp/test.log",
				failedScript: scripts[0] as ScriptEntry,
				exitCode: 1,
			};
		};

		const inst = render(
			<ExecutionScreen scripts={scripts} runExecution={runExecution} />,
			{ stdin, stdout, exitOnCtrlC: false, debug: true },
		);
		instances.push(inst);

		await wait(100);

		expect(drainStdout(stdout)).toContain("fatal: something went wrong");
	});

	test("output lines are cleared when a script succeeds", async () => {
		const scripts = [makeScript("s", "Success Script")];
		const stdout = makeStdout();
		const stdin = makeStdin();

		const runExecution = async (
			onProgress: (event: ProgressEvent) => void,
		): Promise<ScriptRunResult> => {
			onProgress({ status: "running", scriptId: "s" });
			onProgress({
				status: "output",
				scriptId: "s",
				line: "intermediate output",
			});
			onProgress({ status: "done", scriptId: "s" });
			return { success: true, logFile: "/tmp/test.log" };
		};

		const inst = render(
			<ExecutionScreen scripts={scripts} runExecution={runExecution} />,
			{ stdin, stdout, exitOnCtrlC: false, debug: true },
		);
		instances.push(inst);

		// Wait long enough for the done event to be processed but before auto-exit
		await wait(100);

		expect(drainStdout(stdout)).not.toContain("intermediate output");
	});
});
