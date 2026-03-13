import { afterEach, describe, expect, mock, test } from "bun:test";
import { PassThrough } from "node:stream";
import { render } from "ink";
import type { UpdateInfo } from "../updater/checkForUpdate.js";
import type { UpdateScreenProps } from "./UpdateScreen.js";
import { UpdateScreen } from "./UpdateScreen.js";

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

// ─── Test fixtures ────────────────────────────────────────────────────────────

const sampleUpdateInfo: UpdateInfo = {
	currentVersion: "1.0.0",
	latestVersion: "1.1.0",
	downloadUrl: "https://example.com/scriptor-linux-x64",
	assetName: "scriptor-linux-x64",
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("UpdateScreen", () => {
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

	test("renders version info and Y/N options in prompt phase", async () => {
		const stdin = makeStdin();
		const stdout = makeStdout();

		const props: UpdateScreenProps = {
			updateInfo: sampleUpdateInfo,
			applyUpdate: async () => {},
			onSkip: () => {},
		};

		const inst = render(<UpdateScreen {...props} />, {
			stdin,
			stdout,
			exitOnCtrlC: false,
			debug: true,
		});
		instances.push(inst);

		await wait(80);
		const frame = drainStdout(stdout);
		expect(frame).toContain("1.0.0");
		expect(frame).toContain("1.1.0");
		expect(frame).toContain("[Y]");
		expect(frame).toContain("[N]");
	});

	test("pressing Y transitions to downloading phase", async () => {
		const stdin = makeStdin();
		const stdout = makeStdout();

		// Deferred so the download never completes during this test
		const deferred: { resolve: (() => void) | null } = { resolve: null };

		const props: UpdateScreenProps = {
			updateInfo: sampleUpdateInfo,
			applyUpdate: () =>
				new Promise<void>((resolve) => {
					deferred.resolve = resolve;
				}),
			onSkip: () => {},
		};

		const inst = render(<UpdateScreen {...props} />, {
			stdin,
			stdout,
			exitOnCtrlC: false,
			debug: true,
		});
		instances.push(inst);

		await wait(80);
		stdin.push("Y");
		await wait(80);

		const frame = drainStdout(stdout);
		expect(frame).toContain("Downloading");
		expect(frame).toContain("scriptor-linux-x64");

		deferred.resolve?.();
	});

	test("pressing N calls onSkip", async () => {
		const stdin = makeStdin();
		const stdout = makeStdout();
		const onSkip = mock(() => {});

		const props: UpdateScreenProps = {
			updateInfo: sampleUpdateInfo,
			applyUpdate: async () => {},
			onSkip,
		};

		const inst = render(<UpdateScreen {...props} />, {
			stdin,
			stdout,
			exitOnCtrlC: false,
			debug: true,
		});
		instances.push(inst);

		await wait(80);
		stdin.push("N");
		await wait(80);

		expect(onSkip).toHaveBeenCalledTimes(1);
	});

	test("pressing Escape calls onSkip", async () => {
		const stdin = makeStdin();
		const stdout = makeStdout();
		const onSkip = mock(() => {});

		const props: UpdateScreenProps = {
			updateInfo: sampleUpdateInfo,
			applyUpdate: async () => {},
			onSkip,
		};

		const inst = render(<UpdateScreen {...props} />, {
			stdin,
			stdout,
			exitOnCtrlC: false,
			debug: true,
		});
		instances.push(inst);

		await wait(80);
		stdin.push("\x1b");
		await wait(80);

		expect(onSkip).toHaveBeenCalledTimes(1);
	});

	test("error state renders error message and N option", async () => {
		const stdin = makeStdin();
		const stdout = makeStdout();
		const onSkip = mock(() => {});

		const props: UpdateScreenProps = {
			updateInfo: sampleUpdateInfo,
			applyUpdate: async () => {
				throw new Error("download failed: HTTP 500");
			},
			onSkip,
		};

		const inst = render(<UpdateScreen {...props} />, {
			stdin,
			stdout,
			exitOnCtrlC: false,
			debug: true,
		});
		instances.push(inst);

		await wait(80);
		stdin.push("Y");
		await wait(150);

		const frame = drainStdout(stdout);
		expect(frame).toContain("download failed: HTTP 500");
		expect(frame).toContain("[N]");
	});

	test("pressing N in error state calls onSkip", async () => {
		const stdin = makeStdin();
		const stdout = makeStdout();
		const onSkip = mock(() => {});

		const props: UpdateScreenProps = {
			updateInfo: sampleUpdateInfo,
			applyUpdate: async () => {
				throw new Error("some error");
			},
			onSkip,
		};

		const inst = render(<UpdateScreen {...props} />, {
			stdin,
			stdout,
			exitOnCtrlC: false,
			debug: true,
		});
		instances.push(inst);

		await wait(80);
		stdin.push("Y");
		await wait(150);
		stdin.push("N");
		await wait(80);

		expect(onSkip).toHaveBeenCalledTimes(1);
	});
});
