import { afterEach, describe, expect, mock, test } from "bun:test";
import { PassThrough } from "node:stream";
import { render } from "ink";
import type { SudoScreenProps } from "./SudoScreen.js";
import { SudoScreen } from "./SudoScreen.js";

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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("SudoScreen", () => {
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

	test("renders title and password prompt when sudo is not cached", async () => {
		const stdin = makeStdin();
		const stdout = makeStdout();

		const props: SudoScreenProps = {
			validateSudo: async () => ({ ok: false, reason: "Password required" }),
			onValidated: () => {},
			onBack: () => {},
		};

		const inst = render(<SudoScreen {...props} />, {
			stdin,
			stdout,
			exitOnCtrlC: false,
			debug: true,
		});
		instances.push(inst);

		await wait(100);
		const frame = drainStdout(stdout);
		expect(frame).toContain("Sudo authentication required");
		expect(frame).toContain("Password:");
	});

	test("masks typed characters with asterisks", async () => {
		const stdin = makeStdin();
		const stdout = makeStdout();

		const props: SudoScreenProps = {
			validateSudo: async () => ({ ok: false, reason: "Password required" }),
			onValidated: () => {},
			onBack: () => {},
		};

		const inst = render(<SudoScreen {...props} />, {
			stdin,
			stdout,
			exitOnCtrlC: false,
			debug: true,
		});
		instances.push(inst);

		await wait(100);
		// Type some characters
		stdin.push("abc");
		await wait(50);

		const frame = drainStdout(stdout);
		expect(frame).toContain("***");
		// Should not contain the actual password
		expect(frame).not.toContain("abc");
	});

	test("backspace removes characters", async () => {
		const stdin = makeStdin();
		const stdout = makeStdout();

		const props: SudoScreenProps = {
			validateSudo: async () => ({ ok: false, reason: "Password required" }),
			onValidated: () => {},
			onBack: () => {},
		};

		const inst = render(<SudoScreen {...props} />, {
			stdin,
			stdout,
			exitOnCtrlC: false,
			debug: true,
		});
		instances.push(inst);

		await wait(100);
		stdin.push("abcd");
		await wait(50);
		// Backspace
		stdin.push("\x7f");
		await wait(50);

		const frame = drainStdout(stdout);
		expect(frame).toContain("***");
	});

	test("valid password calls onValidated", async () => {
		const stdin = makeStdin();
		const stdout = makeStdout();
		const onValidated = mock(() => {});

		const props: SudoScreenProps = {
			validateSudo: async (password) => {
				if (password === "") return { ok: false, reason: "Password required" };
				return { ok: true };
			},
			onValidated,
			onBack: () => {},
		};

		const inst = render(<SudoScreen {...props} />, {
			stdin,
			stdout,
			exitOnCtrlC: false,
			debug: true,
		});
		instances.push(inst);

		await wait(100);
		stdin.push("correctpassword");
		await wait(50);
		stdin.push("\r");
		await wait(150);

		expect(onValidated).toHaveBeenCalledTimes(1);
	});

	test("invalid password shows error and allows retry", async () => {
		const stdin = makeStdin();
		const stdout = makeStdout();
		let callCount = 0;

		const props: SudoScreenProps = {
			validateSudo: async (password) => {
				if (password === "") return { ok: false, reason: "Password required" };
				callCount++;
				if (callCount === 1) {
					return { ok: false, reason: "sudo authentication failed" };
				}
				return { ok: true };
			},
			onValidated: () => {},
			onBack: () => {},
		};

		const inst = render(<SudoScreen {...props} />, {
			stdin,
			stdout,
			exitOnCtrlC: false,
			debug: true,
		});
		instances.push(inst);

		await wait(100);
		stdin.push("wrong");
		await wait(50);
		stdin.push("\r");
		await wait(150);

		const frame = drainStdout(stdout);
		expect(frame).toContain("sudo authentication failed");
	});

	test("Escape calls onBack", async () => {
		const stdin = makeStdin();
		const stdout = makeStdout();
		const onBack = mock(() => {});

		const props: SudoScreenProps = {
			validateSudo: async () => ({ ok: false, reason: "Password required" }),
			onValidated: () => {},
			onBack,
		};

		const inst = render(<SudoScreen {...props} />, {
			stdin,
			stdout,
			exitOnCtrlC: false,
			debug: true,
		});
		instances.push(inst);

		await wait(100);
		stdin.push("\x1b");
		await wait(50);

		expect(onBack).toHaveBeenCalledTimes(1);
	});

	test("shows Validating during check", async () => {
		const stdin = makeStdin();
		const stdout = makeStdout();

		// Use an object property to avoid TS 5.4+ closure narrowing (let vars assigned
		// in closures are narrowed to never after await points due to PromiseLike mismatch)
		const deferred: {
			resolve:
				| ((value: { ok: true } | { ok: false; reason: string }) => void)
				| null;
		} = { resolve: null };

		const props: SudoScreenProps = {
			validateSudo: async (password) => {
				if (password === "") return { ok: false, reason: "Password required" };
				return new Promise((resolve) => {
					deferred.resolve = resolve;
				});
			},
			onValidated: () => {},
			onBack: () => {},
		};

		const inst = render(<SudoScreen {...props} />, {
			stdin,
			stdout,
			exitOnCtrlC: false,
			debug: true,
		});
		instances.push(inst);

		await wait(100);
		stdin.push("pass");
		await wait(50);
		stdin.push("\r");
		await wait(50);

		const frame = drainStdout(stdout);
		expect(frame).toContain("Validating");

		// Resolve to avoid hanging
		deferred.resolve?.({ ok: true });
	});

	test("calls onValidated immediately when sudo is already cached", async () => {
		const stdin = makeStdin();
		const stdout = makeStdout();
		const onValidated = mock(() => {});

		const props: SudoScreenProps = {
			validateSudo: async () => ({ ok: true }),
			onValidated,
			onBack: () => {},
		};

		const inst = render(<SudoScreen {...props} />, {
			stdin,
			stdout,
			exitOnCtrlC: false,
			debug: true,
		});
		instances.push(inst);

		await wait(100);

		expect(onValidated).toHaveBeenCalledTimes(1);
	});
});
