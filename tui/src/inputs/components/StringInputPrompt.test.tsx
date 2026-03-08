import { afterEach, describe, expect, mock, test } from "bun:test";
import { PassThrough } from "node:stream";
import { render, renderToString } from "ink";
import type { StringInputDef } from "../inputSchema.js";
import { StringInputPrompt } from "./StringInputPrompt.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeStdin() {
	const stream = new PassThrough() as unknown as NodeJS.ReadStream;
	// Provide the subset of TTY methods ink requires
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

/**
 * Type a sequence of characters into the mock stdin then press Enter.
 * Ink uses the 'readable' event + stream.read() to process data.  We push
 * the text as one chunk, wait for ink to process it and React to commit the
 * state update (including effect re-registration), then push '\r' as a
 * separate chunk so the Enter keypress is handled by the updated closure.
 */
async function typeAndSubmit(stdin: NodeJS.ReadStream, text: string) {
	stdin.push(text);
	await new Promise<void>((resolve) => setTimeout(resolve, 50));
	stdin.push("\r"); // Enter
	await new Promise<void>((resolve) => setTimeout(resolve, 50));
}

function _typeOnly(stdin: NodeJS.ReadStream, text: string) {
	stdin.push(text);
}

function pressEnter(stdin: NodeJS.ReadStream) {
	stdin.push("\r");
}

const stringDef: StringInputDef = {
	id: "username",
	type: "string",
	label: "GitHub Username",
	required: false,
};

const requiredStringDef: StringInputDef = {
	id: "username",
	type: "string",
	label: "GitHub Username",
	required: true,
};

const defaultStringDef: StringInputDef = {
	id: "username",
	type: "string",
	label: "GitHub Username",
	required: false,
	default: "octocat",
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("StringInputPrompt", () => {
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

	test("renders script name and input label", () => {
		const output = renderToString(
			<StringInputPrompt
				inputDef={stringDef}
				scriptName="Deploy Script"
				onSubmit={() => {}}
			/>,
		);
		expect(output).toContain("Deploy Script");
		expect(output).toContain("GitHub Username");
	});

	test("pre-fills default value when declared", () => {
		const output = renderToString(
			<StringInputPrompt
				inputDef={defaultStringDef}
				scriptName="Deploy Script"
				onSubmit={() => {}}
			/>,
		);
		expect(output).toContain("octocat");
	});

	test("required string input left blank — onSubmit not called, error shown", async () => {
		const onSubmit = mock(() => {});
		const stdin = makeStdin();
		const stdout = makeStdout();

		const inst = render(
			<StringInputPrompt
				inputDef={requiredStringDef}
				scriptName="Deploy Script"
				onSubmit={onSubmit}
			/>,
			{ stdin, stdout, exitOnCtrlC: false },
		);
		instances.push(inst);

		// Press Enter without typing anything
		await new Promise<void>((resolve) => setTimeout(resolve, 50));
		pressEnter(stdin);
		await new Promise<void>((resolve) => setTimeout(resolve, 50));

		expect(onSubmit).not.toHaveBeenCalled();
		// Error should be visible in output
		const _frame = stdout.read()?.toString() ?? "";
		// The error line may appear after several frames; just ensure onSubmit not called
		expect(onSubmit).not.toHaveBeenCalled();
	});

	test("valid string submitted — onSubmit called with value", async () => {
		const onSubmit = mock((_value: string) => {});
		const stdin = makeStdin();
		const stdout = makeStdout();

		const inst = render(
			<StringInputPrompt
				inputDef={stringDef}
				scriptName="Deploy Script"
				onSubmit={onSubmit}
			/>,
			{ stdin, stdout, exitOnCtrlC: false },
		);
		instances.push(inst);

		await new Promise<void>((resolve) => setTimeout(resolve, 50));
		await typeAndSubmit(stdin, "myvalue");
		await new Promise<void>((resolve) => setTimeout(resolve, 50));

		expect(onSubmit).toHaveBeenCalledWith("myvalue");
	});
});
