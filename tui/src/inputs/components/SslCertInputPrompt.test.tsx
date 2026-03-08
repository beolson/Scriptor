import { afterEach, describe, expect, mock, test } from "bun:test";
import { PassThrough } from "node:stream";
import { render, renderToString } from "ink";
import type { SslCertInputDef } from "../inputSchema.js";
import type { CertInfo } from "../sslCert/certFetcher.js";
import { MockCertFetcher } from "../sslCert/certFetcher.js";
import { SslCertInputPrompt } from "./SslCertInputPrompt.js";

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

async function wait(ms = 80) {
	await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Drain all buffered chunks from a PassThrough stdout stream and return
 * them concatenated as a string. Ink writes multiple frames so we need
 * to consume them all to find the latest rendered state.
 */
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

const sslDef: SslCertInputDef = {
	id: "cert",
	type: "ssl-cert",
	label: "TLS Certificate",
	required: false,
	download_path: "/tmp/test-cert.pem",
	format: "PEM",
};

const fakeCert1: CertInfo = {
	subject: "CN=example.com",
	issuer: "CN=Example CA",
	expiresAt: new Date("2030-06-15T00:00:00Z"),
	rawDer: new Uint8Array([0x30, 0x03, 0x01, 0x01, 0xff]),
};

const fakeCert2: CertInfo = {
	subject: "CN=Example CA",
	issuer: "CN=Root CA",
	expiresAt: new Date("2035-01-01T00:00:00Z"),
	rawDer: new Uint8Array([0x30, 0x03, 0x02, 0x01, 0xfe]),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("SslCertInputPrompt", () => {
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

	// Test 1: step 1 renders URL prompt with script name
	test("step 1 renders URL prompt with script name", () => {
		const fetcher = new MockCertFetcher([fakeCert1]);
		const output = renderToString(
			<SslCertInputPrompt
				inputDef={sslDef}
				scriptName="Deploy Script"
				fetcher={fetcher}
				onSubmit={() => {}}
			/>,
		);
		expect(output).toContain("Deploy Script");
		expect(output).toContain("TLS Certificate");
	});

	// Test 2: after valid URL entry, cert list is rendered with CN/Issuer/Expiry
	test("after valid URL entry, cert list is rendered with CN/Issuer/Expiry for each cert", async () => {
		const fetcher = new MockCertFetcher([fakeCert1, fakeCert2]);
		const onSubmit = mock((_path: string) => {});
		const stdin = makeStdin();
		const stdout = makeStdout();

		const inst = render(
			<SslCertInputPrompt
				inputDef={sslDef}
				scriptName="Deploy Script"
				fetcher={fetcher}
				onSubmit={onSubmit}
			/>,
			{ stdin, stdout, exitOnCtrlC: false, debug: true },
		);
		instances.push(inst);

		// Type a URL and submit
		await wait();
		await typeAndSubmit(stdin, "https://example.com");
		// Wait for async fetch to complete and React to re-render
		await wait(150);

		// Drain all stdout frames and concatenate
		const output = drainStdout(stdout);
		// Both certs should appear (CN= prefix stripped)
		expect(output).toContain("example.com");
		expect(output).toContain("Example CA");
		// Expiry shown for the focused cert (root, cursor=0, expires 2035)
		expect(output).toContain("2035");
	});

	// Test 3: selecting a cert and pressing Enter calls onSubmit with download_path and certCN
	test("selecting a cert and pressing Enter calls onSubmit with download_path", async () => {
		const fetcher = new MockCertFetcher([fakeCert1]);
		const onSubmit = mock((_path: string, _certCN: string) => {});
		const stdin = makeStdin();
		const stdout = makeStdout();

		const inst = render(
			<SslCertInputPrompt
				inputDef={sslDef}
				scriptName="Deploy Script"
				fetcher={fetcher}
				onSubmit={onSubmit}
			/>,
			{ stdin, stdout, exitOnCtrlC: false, debug: true },
		);
		instances.push(inst);

		// Enter URL
		await wait();
		await typeAndSubmit(stdin, "https://example.com");
		// Wait for async fetch + re-render
		await wait(150);

		// Press Enter to select the first (and only) cert
		stdin.push("\r");
		await wait(150);

		expect(onSubmit).toHaveBeenCalledWith("/tmp/test-cert.pem", "example.com");
	});

	// Test 4: MockCertFetcher configured to throw — error shown, URL prompt re-appears
	test("fetcher error shows error message and re-shows URL prompt for retry", async () => {
		const errorMessage = "connection refused";
		const fetcher = new MockCertFetcher([], {
			shouldThrow: true,
			message: errorMessage,
		});
		const onSubmit = mock((_path: string) => {});
		const stdin = makeStdin();
		const stdout = makeStdout();

		const inst = render(
			<SslCertInputPrompt
				inputDef={sslDef}
				scriptName="Deploy Script"
				fetcher={fetcher}
				onSubmit={onSubmit}
			/>,
			{ stdin, stdout, exitOnCtrlC: false, debug: true },
		);
		instances.push(inst);

		// Enter URL that will fail
		await wait();
		await typeAndSubmit(stdin, "https://badhost.example");
		// Wait for async fetch to reject + re-render
		await wait(150);

		const output = drainStdout(stdout);
		// Error message should be visible
		expect(output).toContain(errorMessage);
		// URL prompt should be shown again for retry
		expect(output).toContain("TLS Certificate");
		// onSubmit should not have been called
		expect(onSubmit).not.toHaveBeenCalled();
	});

	// Test 5: cert list shows exactly the certs returned by the fetcher
	test("cert list shows exactly the certs returned by the fetcher", async () => {
		const fetcher = new MockCertFetcher([fakeCert1, fakeCert2]);
		const onSubmit = mock((_path: string) => {});
		const stdin = makeStdin();
		const stdout = makeStdout();

		const inst = render(
			<SslCertInputPrompt
				inputDef={sslDef}
				scriptName="Deploy Script"
				fetcher={fetcher}
				onSubmit={onSubmit}
			/>,
			{ stdin, stdout, exitOnCtrlC: false, debug: true },
		);
		instances.push(inst);

		await wait();
		await typeAndSubmit(stdin, "https://example.com:443");
		await wait(150);

		const output = drainStdout(stdout);
		// Both cert CNs should appear (CN= prefix stripped, hierarchy makes issuer redundant)
		expect(output).toContain("example.com");
		expect(output).toContain("Example CA");
		// Role labels should appear
		expect(output).toContain("[root]");
		expect(output).toContain("[site]");
	});
});
