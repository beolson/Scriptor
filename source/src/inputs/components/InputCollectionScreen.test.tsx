import { afterEach, describe, expect, mock, test } from "bun:test";
import { PassThrough } from "node:stream";
import { render } from "ink";
import type { InputDef, ScriptInputs } from "../inputSchema.js";
import type { CertInfo } from "../sslCert/certFetcher.js";
import { MockCertFetcher } from "../sslCert/certFetcher.js";
import { InputCollectionScreen } from "./InputCollectionScreen.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeStdin() {
	const stream = new PassThrough() as NodeJS.ReadStream;
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
	const stream = new PassThrough() as NodeJS.WriteStream;
	// biome-ignore lint/suspicious/noExplicitAny: TTY mock
	(stream as any).columns = 80;
	return stream;
}

async function wait(ms = 80) {
	await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function typeAndSubmit(stdin: NodeJS.ReadStream, text: string) {
	stdin.push(text);
	await wait(50);
	stdin.push("\r");
	await wait(50);
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

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const stringInput: InputDef = {
	id: "username",
	type: "string",
	label: "GitHub Username",
	required: false,
};

const numberInput: InputDef = {
	id: "port",
	type: "number",
	label: "Port Number",
	required: false,
};

const _sslInput: InputDef = {
	id: "cert",
	type: "ssl-cert",
	label: "TLS Certificate",
	required: false,
	download_path: "/tmp/test-cert.pem",
	format: "PEM",
};

const _fakeCert: CertInfo = {
	subject: "CN=example.com",
	issuer: "CN=Example CA",
	expiresAt: new Date("2030-06-15T00:00:00Z"),
	rawDer: new Uint8Array([0x30, 0x03, 0x01, 0x01, 0xff]),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("InputCollectionScreen", () => {
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

	// Test 1: single string input for one script — renders prompt, submitting
	// value calls onComplete with correct ScriptInputs
	test("single string input — renders prompt and calls onComplete with correct ScriptInputs", async () => {
		const onComplete = mock((_collected: ScriptInputs) => {});
		const onCancel = mock(() => {});
		const fetcher = new MockCertFetcher([]);
		const stdin = makeStdin();
		const stdout = makeStdout();

		const scripts = [
			{ id: "script-a", name: "Deploy Script", inputs: [stringInput] },
		];

		const inst = render(
			<InputCollectionScreen
				scripts={scripts}
				fetcher={fetcher}
				onComplete={onComplete}
				onCancel={onCancel}
			/>,
			{ stdin, stdout, exitOnCtrlC: false },
		);
		instances.push(inst);

		await wait();
		// Should show script name and input label
		const frame = drainStdout(stdout);
		expect(frame).toContain("Deploy Script");
		expect(frame).toContain("GitHub Username");

		// Submit a value
		await typeAndSubmit(stdin, "octocat");
		await wait();

		expect(onComplete).toHaveBeenCalledTimes(1);
		const collected = onComplete.mock.calls[0]?.[0] as ScriptInputs;
		expect(collected).toBeDefined();
		const scriptAInputs = collected.get("script-a");
		expect(scriptAInputs).toBeDefined();
		expect(scriptAInputs?.[0]?.id).toBe("username");
		expect(scriptAInputs?.[0]?.value).toBe("octocat");
	});

	// Test 2: two scripts with one input each — prompts shown in order, both
	// collected before onComplete
	test("two scripts with one input each — prompts in order, onComplete with both", async () => {
		const onComplete = mock((_collected: ScriptInputs) => {});
		const onCancel = mock(() => {});
		const fetcher = new MockCertFetcher([]);
		const stdin = makeStdin();
		const stdout = makeStdout();

		const scripts = [
			{ id: "script-a", name: "Script A", inputs: [stringInput] },
			{ id: "script-b", name: "Script B", inputs: [numberInput] },
		];

		const inst = render(
			<InputCollectionScreen
				scripts={scripts}
				fetcher={fetcher}
				onComplete={onComplete}
				onCancel={onCancel}
			/>,
			{ stdin, stdout, exitOnCtrlC: false },
		);
		instances.push(inst);

		await wait();
		// First prompt: Script A's string input
		const frame1 = drainStdout(stdout);
		expect(frame1).toContain("Script A");
		expect(frame1).toContain("GitHub Username");

		// Submit first input
		await typeAndSubmit(stdin, "alice");
		await wait();

		// onComplete should NOT have been called yet
		expect(onComplete).not.toHaveBeenCalled();

		// Second prompt: Script B's number input
		const frame2 = drainStdout(stdout);
		expect(frame2).toContain("Script B");
		expect(frame2).toContain("Port Number");

		// Submit second input
		await typeAndSubmit(stdin, "8080");
		await wait();

		expect(onComplete).toHaveBeenCalledTimes(1);
		const collected = onComplete.mock.calls[0]?.[0] as ScriptInputs;
		expect(collected.get("script-a")?.[0]?.value).toBe("alice");
		expect(collected.get("script-b")?.[0]?.value).toBe("8080");
	});

	// Test 3: pressing Q mid-collection shows cancel confirmation
	test("pressing Q mid-collection shows cancel confirmation prompt", async () => {
		const onComplete = mock((_collected: ScriptInputs) => {});
		const onCancel = mock(() => {});
		const fetcher = new MockCertFetcher([]);
		const stdin = makeStdin();
		const stdout = makeStdout();

		const scripts = [
			{ id: "script-a", name: "Deploy Script", inputs: [stringInput] },
		];

		const inst = render(
			<InputCollectionScreen
				scripts={scripts}
				fetcher={fetcher}
				onComplete={onComplete}
				onCancel={onCancel}
			/>,
			{ stdin, stdout, exitOnCtrlC: false },
		);
		instances.push(inst);

		await wait();
		// Press Q
		stdin.push("q");
		await wait();

		const frame = drainStdout(stdout);
		// Should show cancel confirmation prompt
		expect(frame).toContain("Cancel input collection");
	});

	// Test 4: confirming cancel calls onCancel
	test("confirming cancel calls onCancel", async () => {
		const onComplete = mock((_collected: ScriptInputs) => {});
		const onCancel = mock(() => {});
		const fetcher = new MockCertFetcher([]);
		const stdin = makeStdin();
		const stdout = makeStdout();

		const scripts = [
			{ id: "script-a", name: "Deploy Script", inputs: [stringInput] },
		];

		const inst = render(
			<InputCollectionScreen
				scripts={scripts}
				fetcher={fetcher}
				onComplete={onComplete}
				onCancel={onCancel}
			/>,
			{ stdin, stdout, exitOnCtrlC: false },
		);
		instances.push(inst);

		await wait();
		// Press Q to show confirmation
		stdin.push("q");
		await wait();

		// Confirm with y
		stdin.push("y");
		await wait();

		expect(onCancel).toHaveBeenCalledTimes(1);
		expect(onComplete).not.toHaveBeenCalled();
	});

	// Test 5: declining cancel resumes from the current prompt
	test("declining cancel resumes from the current prompt", async () => {
		const onComplete = mock((_collected: ScriptInputs) => {});
		const onCancel = mock(() => {});
		const fetcher = new MockCertFetcher([]);
		const stdin = makeStdin();
		const stdout = makeStdout();

		const scripts = [
			{ id: "script-a", name: "Deploy Script", inputs: [stringInput] },
		];

		const inst = render(
			<InputCollectionScreen
				scripts={scripts}
				fetcher={fetcher}
				onComplete={onComplete}
				onCancel={onCancel}
			/>,
			{ stdin, stdout, exitOnCtrlC: false },
		);
		instances.push(inst);

		await wait();
		// Press Q to show confirmation
		stdin.push("q");
		await wait();

		// Decline with n
		stdin.push("n");
		await wait();

		// Should be back at the original prompt
		const frame = drainStdout(stdout);
		expect(frame).toContain("GitHub Username");
		expect(onCancel).not.toHaveBeenCalled();
		expect(onComplete).not.toHaveBeenCalled();
	});

	// Test 6: scripts with no inputs are skipped, onComplete called immediately
	// if no scripts have inputs
	test("scripts with no inputs are skipped — onComplete called immediately if none have inputs", async () => {
		const onComplete = mock((_collected: ScriptInputs) => {});
		const onCancel = mock(() => {});
		const fetcher = new MockCertFetcher([]);
		const stdin = makeStdin();
		const stdout = makeStdout();

		const scripts = [
			{ id: "script-a", name: "Script A", inputs: [] },
			{ id: "script-b", name: "Script B", inputs: [] },
		];

		const inst = render(
			<InputCollectionScreen
				scripts={scripts}
				fetcher={fetcher}
				onComplete={onComplete}
				onCancel={onCancel}
			/>,
			{ stdin, stdout, exitOnCtrlC: false },
		);
		instances.push(inst);

		// Give React time to render and effects to run
		await wait(100);

		expect(onComplete).toHaveBeenCalledTimes(1);
		const collected = onComplete.mock.calls[0]?.[0] as ScriptInputs;
		// Map should be empty or scripts should have empty arrays
		expect(collected.size).toBe(0);
	});
});
