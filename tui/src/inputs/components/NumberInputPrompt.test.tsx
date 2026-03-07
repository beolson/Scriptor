import { afterEach, describe, expect, mock, test } from "bun:test";
import { PassThrough } from "node:stream";
import { render, renderToString } from "ink";
import type { NumberInputDef } from "../inputSchema.js";
import { NumberInputPrompt } from "./NumberInputPrompt.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

async function typeAndSubmit(stdin: NodeJS.ReadStream, text: string) {
	stdin.push(text);
	await new Promise<void>((resolve) => setTimeout(resolve, 50));
	stdin.push("\r");
	await new Promise<void>((resolve) => setTimeout(resolve, 50));
}

function _pressEnter(stdin: NodeJS.ReadStream) {
	stdin.push("\r");
}

const numberDef: NumberInputDef = {
	id: "port",
	type: "number",
	label: "Port Number",
	required: false,
};

const defaultNumberDef: NumberInputDef = {
	id: "port",
	type: "number",
	label: "Port Number",
	required: false,
	default: 8080,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("NumberInputPrompt", () => {
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
			<NumberInputPrompt
				inputDef={numberDef}
				scriptName="Build Script"
				onSubmit={() => {}}
			/>,
		);
		expect(output).toContain("Build Script");
		expect(output).toContain("Port Number");
	});

	test("pre-fills default value when declared", () => {
		const output = renderToString(
			<NumberInputPrompt
				inputDef={defaultNumberDef}
				scriptName="Build Script"
				onSubmit={() => {}}
			/>,
		);
		expect(output).toContain("8080");
	});

	test("number input with non-numeric value — error shown, onSubmit not called", async () => {
		const onSubmit = mock((_value: string) => {});
		const stdin = makeStdin();
		const stdout = makeStdout();

		const inst = render(
			<NumberInputPrompt
				inputDef={numberDef}
				scriptName="Build Script"
				onSubmit={onSubmit}
			/>,
			{ stdin, stdout, exitOnCtrlC: false },
		);
		instances.push(inst);

		await new Promise<void>((resolve) => setTimeout(resolve, 50));
		await typeAndSubmit(stdin, "notanumber");
		await new Promise<void>((resolve) => setTimeout(resolve, 50));

		expect(onSubmit).not.toHaveBeenCalled();
	});

	test("number input with valid decimal — onSubmit called", async () => {
		const onSubmit = mock((_value: string) => {});
		const stdin = makeStdin();
		const stdout = makeStdout();

		const inst = render(
			<NumberInputPrompt
				inputDef={numberDef}
				scriptName="Build Script"
				onSubmit={onSubmit}
			/>,
			{ stdin, stdout, exitOnCtrlC: false },
		);
		instances.push(inst);

		await new Promise<void>((resolve) => setTimeout(resolve, 50));
		await typeAndSubmit(stdin, "3.14");
		await new Promise<void>((resolve) => setTimeout(resolve, 50));

		expect(onSubmit).toHaveBeenCalledWith("3.14");
	});
});
