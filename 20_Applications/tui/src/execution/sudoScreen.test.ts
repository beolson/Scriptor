// ---------------------------------------------------------------------------
// SudoScreen Tests
//
// Tests exercise `showSudoScreen` with all side-effectful deps injected as
// fakes. Keypress sequences are simulated via Buffer values. No real TTY
// interaction or process spawning occurs.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "bun:test";
import { showSudoScreen } from "./sudoScreen.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface FakeStdinHandle {
	write: (data: string) => void;
	end: () => void;
	/** Exposed for assertions only — not part of real interface. */
	_writes: string[];
}

interface SpawnCall {
	cmd: string[];
	opts: object;
	stdin: FakeStdinHandle;
}

/** Yield to the microtask queue N times. */
async function tick(n = 1): Promise<void> {
	for (let i = 0; i < n; i++) {
		await Promise.resolve();
	}
}

/**
 * Builds a set of fake deps for sudoScreen.
 *
 * `spawnExitCodes` is a queue of exit codes to return in order. Each call to
 * `spawn` pops the first result from the queue.
 *
 * The `stdin.send()` helper waits for the data handler to be registered before
 * delivering the chunk, then yields to allow any async code triggered by the
 * chunk to settle.
 */
function makeFakeDeps(spawnExitCodes: number[]): {
	deps: Parameters<typeof showSudoScreen>[0] & object;
	stdin: {
		/** Simulate delivering a chunk to the registered data handler. */
		send: (chunk: Buffer) => Promise<void>;
	};
	stdoutOutput: string[];
	spawnCalls: SpawnCall[];
	setRawModeCalls: boolean[];
	stdinResumeCalled: boolean[];
	stdinPauseCalled: boolean[];
	exitCodes: number[];
} {
	const stdoutOutput: string[] = [];
	const spawnCalls: SpawnCall[] = [];
	const setRawModeCalls: boolean[] = [];
	const stdinResumeCalled: boolean[] = [];
	const stdinPauseCalled: boolean[] = [];
	const exitCodes: number[] = [];
	let dataHandler: ((chunk: Buffer) => void) | undefined;

	const exitCodeQueue = [...spawnExitCodes];

	const deps = {
		setRawMode: (mode: boolean) => {
			setRawModeCalls.push(mode);
		},
		stdinResume: () => {
			stdinResumeCalled.push(true);
		},
		stdinPause: () => {
			stdinPauseCalled.push(true);
		},
		onStdinData: (handler: (chunk: Buffer) => void) => {
			dataHandler = handler;
		},
		offStdinData: (_handler: (chunk: Buffer) => void) => {
			dataHandler = undefined;
		},
		stdoutWrite: (msg: string) => {
			stdoutOutput.push(msg);
		},
		spawn: (cmd: string[], opts: object) => {
			const code = exitCodeQueue.shift() ?? 0;
			const stdinWrites: string[] = [];
			const fakeStdin: FakeStdinHandle = {
				write: (data: string) => {
					stdinWrites.push(data);
				},
				end: () => {},
				_writes: stdinWrites,
			};
			const result = {
				exited: Promise.resolve(code),
				stdin: fakeStdin,
			};
			spawnCalls.push({ cmd, opts, stdin: fakeStdin });
			return result;
		},
		exit: (code: number): never => {
			exitCodes.push(code);
			throw new Error(`process.exit(${code})`);
		},
	};

	/**
	 * Wait until the data handler is registered (i.e. `onStdinData` has been
	 * called by the implementation), then deliver the chunk and yield for any
	 * async work triggered by the handler to complete.
	 */
	async function send(chunk: Buffer): Promise<void> {
		// Poll until handler registered (up to 50 ticks)
		for (let i = 0; i < 50; i++) {
			if (dataHandler) break;
			await tick();
		}
		try {
			if (dataHandler) {
				dataHandler(chunk);
			}
		} catch {
			// exit() in the fake throws — swallow here; the test handles the
			// showSudoScreen promise directly via .catch()
		}
		// Yield several ticks to let async work (e.g. await proc.exited) settle
		await tick(5);
	}

	return {
		deps,
		stdin: { send },
		stdoutOutput,
		spawnCalls,
		setRawModeCalls,
		stdinResumeCalled,
		stdinPauseCalled,
		exitCodes,
	};
}

// ---------------------------------------------------------------------------
// sudo -n -v already cached (exit 0) — skip prompt entirely
// ---------------------------------------------------------------------------

describe("showSudoScreen — credentials already cached", () => {
	it("returns immediately when sudo -n -v exits 0", async () => {
		const { deps } = makeFakeDeps([0]);
		await showSudoScreen(deps);
	});

	it("does not call setRawMode when credentials are cached", async () => {
		const { deps, setRawModeCalls } = makeFakeDeps([0]);
		await showSudoScreen(deps);
		expect(setRawModeCalls).toHaveLength(0);
	});

	it("does not call stdinResume when credentials are cached", async () => {
		const { deps, stdinResumeCalled } = makeFakeDeps([0]);
		await showSudoScreen(deps);
		expect(stdinResumeCalled).toHaveLength(0);
	});

	it("does not print anything when credentials are cached", async () => {
		const { deps, stdoutOutput } = makeFakeDeps([0]);
		await showSudoScreen(deps);
		expect(stdoutOutput).toHaveLength(0);
	});

	it("spawns sudo -n -v as the first call", async () => {
		const { deps, spawnCalls } = makeFakeDeps([0]);
		await showSudoScreen(deps);
		expect(spawnCalls).toHaveLength(1);
		// biome-ignore lint/style/noNonNullAssertion: length asserted above
		expect(spawnCalls[0]!.cmd).toEqual(["sudo", "-n", "-v"]);
	});
});

// ---------------------------------------------------------------------------
// sudo -n -v not cached — shows prompt
// ---------------------------------------------------------------------------

describe("showSudoScreen — prompt shown when credentials not cached", () => {
	it("calls setRawMode(true) after sudo -n -v returns non-zero", async () => {
		// sudo -n -v fails (1), then Enter submitted, sudo -S -v succeeds (0)
		const { deps, stdin, setRawModeCalls } = makeFakeDeps([1, 0]);

		const promise = showSudoScreen(deps);
		await stdin.send(Buffer.from([0x0d])); // Enter
		await promise;

		expect(setRawModeCalls[0]).toBe(true);
	});

	it("calls stdinResume after sudo -n -v returns non-zero", async () => {
		const { deps, stdin, stdinResumeCalled } = makeFakeDeps([1, 0]);

		const promise = showSudoScreen(deps);
		await stdin.send(Buffer.from([0x0d]));
		await promise;

		expect(stdinResumeCalled).toHaveLength(1);
	});

	it("prints 'Sudo authentication required' header", async () => {
		const { deps, stdin, stdoutOutput } = makeFakeDeps([1, 0]);

		const promise = showSudoScreen(deps);
		await stdin.send(Buffer.from([0x0d]));
		await promise;

		const combined = stdoutOutput.join("");
		expect(combined).toContain("Sudo authentication required");
	});
});

// ---------------------------------------------------------------------------
// Successful password entry
// ---------------------------------------------------------------------------

describe("showSudoScreen — successful password submission", () => {
	it("calls setRawMode(false) after successful sudo -S -v", async () => {
		// sudo -n -v fails (1), sudo -S -v succeeds (0)
		const { deps, stdin, setRawModeCalls } = makeFakeDeps([1, 0]);

		const promise = showSudoScreen(deps);
		await stdin.send(Buffer.from([0x0d])); // Enter
		await promise;

		// setRawMode called with true first, then false
		expect(setRawModeCalls).toContain(false);
		expect(setRawModeCalls[setRawModeCalls.length - 1]).toBe(false);
	});

	it("calls stdinPause after successful sudo -S -v", async () => {
		const { deps, stdin, stdinPauseCalled } = makeFakeDeps([1, 0]);

		const promise = showSudoScreen(deps);
		await stdin.send(Buffer.from([0x0d]));
		await promise;

		expect(stdinPauseCalled).toHaveLength(1);
	});

	it("resolves (returns) after successful sudo -S -v", async () => {
		const { deps, stdin } = makeFakeDeps([1, 0]);

		const promise = showSudoScreen(deps);
		await stdin.send(Buffer.from([0x0d]));

		await expect(promise).resolves.toBeUndefined();
	});

	it("spawns sudo -S -v on Enter", async () => {
		const { deps, stdin, spawnCalls } = makeFakeDeps([1, 0]);

		const promise = showSudoScreen(deps);
		await stdin.send(Buffer.from([0x0d]));
		await promise;

		const sudoSVCall = spawnCalls.find((c) => c.cmd.includes("-S"));
		expect(sudoSVCall).toBeDefined();
		// biome-ignore lint/style/noNonNullAssertion: defined asserted above
		expect(sudoSVCall!.cmd).toEqual(["sudo", "-S", "-v"]);
	});

	it("passes the typed password to sudo -S -v stdin", async () => {
		const { deps, stdin, spawnCalls } = makeFakeDeps([1, 0]);

		const promise = showSudoScreen(deps);
		// Type 'abc'
		await stdin.send(Buffer.from([0x61])); // 'a'
		await stdin.send(Buffer.from([0x62])); // 'b'
		await stdin.send(Buffer.from([0x63])); // 'c'
		await stdin.send(Buffer.from([0x0d])); // Enter
		await promise;

		const sudoSVCall = spawnCalls.find((c) => c.cmd.includes("-S"));
		expect(sudoSVCall).toBeDefined();
		// biome-ignore lint/style/noNonNullAssertion: defined asserted above
		expect(sudoSVCall!.stdin._writes).toContain("abc\n");
	});
});

// ---------------------------------------------------------------------------
// Failed password entry — retry loop
// ---------------------------------------------------------------------------

describe("showSudoScreen — failed password and retry", () => {
	it("prints error message containing 'Sudo validation failed' on wrong password", async () => {
		// sudo -n -v fails (1), sudo -S -v fails first (1), then succeeds (0)
		const { deps, stdin, stdoutOutput } = makeFakeDeps([1, 1, 0]);

		const promise = showSudoScreen(deps);
		await stdin.send(Buffer.from([0x0d])); // First attempt — fails
		await stdin.send(Buffer.from([0x0d])); // Second attempt — succeeds
		await promise;

		const combined = stdoutOutput.join("");
		expect(combined).toContain("Sudo validation failed");
	});

	it("error message is printed with ANSI red formatting", async () => {
		const { deps, stdin, stdoutOutput } = makeFakeDeps([1, 1, 0]);

		const promise = showSudoScreen(deps);
		await stdin.send(Buffer.from([0x0d]));
		await stdin.send(Buffer.from([0x0d]));
		await promise;

		const combined = stdoutOutput.join("");
		expect(combined).toContain("\x1b[31m");
		expect(combined).toContain("\x1b[0m");
	});

	it("allows unlimited retries before success", async () => {
		// 3 failures then success (total: 1 + 3 + 1 = 5 spawn calls)
		const { deps, stdin } = makeFakeDeps([1, 1, 1, 1, 0]);

		const promise = showSudoScreen(deps);
		await stdin.send(Buffer.from([0x0d]));
		await stdin.send(Buffer.from([0x0d]));
		await stdin.send(Buffer.from([0x0d]));
		await stdin.send(Buffer.from([0x0d]));
		await stdin.send(Buffer.from([0x0d]));
		await promise;

		await expect(promise).resolves.toBeUndefined();
	});

	it("clears the password buffer after a failed attempt", async () => {
		// sudo -n -v fails (1), first sudo -S -v fails (1), second succeeds (0)
		const { deps, stdin, spawnCalls } = makeFakeDeps([1, 1, 0]);

		const promise = showSudoScreen(deps);
		// Type 'wrong', submit, then type 'ok', submit
		await stdin.send(Buffer.from([0x77])); // 'w'
		await stdin.send(Buffer.from([0x72])); // 'r'
		await stdin.send(Buffer.from([0x0d])); // Enter — fails
		// After failure, buffer cleared; type 'ok'
		await stdin.send(Buffer.from([0x6f])); // 'o'
		await stdin.send(Buffer.from([0x6b])); // 'k'
		await stdin.send(Buffer.from([0x0d])); // Enter — succeeds
		await promise;

		// Second sudo -S -v call should only receive 'ok\n', not 'wrongok\n'
		const sudoSVCalls = spawnCalls.filter((c) => c.cmd.includes("-S"));
		expect(sudoSVCalls).toHaveLength(2);

		// biome-ignore lint/style/noNonNullAssertion: length asserted above
		expect(sudoSVCalls[1]!.stdin._writes).toContain("ok\n");
		// biome-ignore lint/style/noNonNullAssertion: length asserted above
		expect(sudoSVCalls[1]!.stdin._writes.join("")).not.toContain("wrong");
	});
});

// ---------------------------------------------------------------------------
// Esc key → exit(0)
// ---------------------------------------------------------------------------

describe("showSudoScreen — Esc exits Scriptor", () => {
	it("calls exit(0) when Esc is pressed", async () => {
		const { deps, stdin, exitCodes } = makeFakeDeps([1]);

		const promise = showSudoScreen(deps).catch(() => {
			// exit() throws in our fake — expected
		});

		await stdin.send(Buffer.from([0x1b])); // Esc
		await promise;

		expect(exitCodes).toContain(0);
	});

	it("calls setRawMode(false) before exit on Esc", async () => {
		const { deps, stdin, setRawModeCalls } = makeFakeDeps([1]);

		const promise = showSudoScreen(deps).catch(() => {});
		await stdin.send(Buffer.from([0x1b]));
		await promise;

		expect(setRawModeCalls).toContain(false);
	});

	it("calls stdinPause before exit on Esc", async () => {
		const { deps, stdin, stdinPauseCalled } = makeFakeDeps([1]);

		const promise = showSudoScreen(deps).catch(() => {});
		await stdin.send(Buffer.from([0x1b]));
		await promise;

		expect(stdinPauseCalled).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// Character echoing — each byte echoed as '*'
// ---------------------------------------------------------------------------

describe("showSudoScreen — character echoing", () => {
	it("echoes each typed character as '*' to stdout", async () => {
		const { deps, stdin, stdoutOutput } = makeFakeDeps([1, 0]);

		const promise = showSudoScreen(deps);
		await stdin.send(Buffer.from([0x61])); // 'a'
		await stdin.send(Buffer.from([0x62])); // 'b'
		await stdin.send(Buffer.from([0x63])); // 'c'
		await stdin.send(Buffer.from([0x0d])); // Enter
		await promise;

		const stars = stdoutOutput.filter((s) => s === "*");
		expect(stars).toHaveLength(3);
	});

	it("echoes a single character as exactly one '*'", async () => {
		const { deps, stdin, stdoutOutput } = makeFakeDeps([1, 0]);

		const promise = showSudoScreen(deps);
		await stdin.send(Buffer.from([0x78])); // 'x'
		await stdin.send(Buffer.from([0x0d])); // Enter
		await promise;

		const stars = stdoutOutput.filter((s) => s === "*");
		expect(stars).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// Backspace — erases last character
// ---------------------------------------------------------------------------

describe("showSudoScreen — backspace handling", () => {
	it("prints backspace erase sequence '\\b \\b' on Backspace", async () => {
		const { deps, stdin, stdoutOutput } = makeFakeDeps([1, 0]);

		const promise = showSudoScreen(deps);
		await stdin.send(Buffer.from([0x61])); // 'a'
		await stdin.send(Buffer.from([0x7f])); // Backspace
		await stdin.send(Buffer.from([0x0d])); // Enter
		await promise;

		const combined = stdoutOutput.join("");
		expect(combined).toContain("\b \b");
	});

	it("removes last char from buffer on Backspace", async () => {
		// Type 'ab', backspace, type 'c' → buffer should be 'ac'
		const { deps, stdin, spawnCalls } = makeFakeDeps([1, 0]);

		const promise = showSudoScreen(deps);
		await stdin.send(Buffer.from([0x61])); // 'a'
		await stdin.send(Buffer.from([0x62])); // 'b'
		await stdin.send(Buffer.from([0x7f])); // Backspace → removes 'b'
		await stdin.send(Buffer.from([0x63])); // 'c'
		await stdin.send(Buffer.from([0x0d])); // Enter → submits 'ac'
		await promise;

		const sudoSVCall = spawnCalls.find((c) => c.cmd.includes("-S"));
		expect(sudoSVCall).toBeDefined();
		// biome-ignore lint/style/noNonNullAssertion: defined asserted above
		expect(sudoSVCall!.stdin._writes).toContain("ac\n");
	});

	it("does not write '\\b \\b' when buffer is empty on Backspace", async () => {
		const { deps, stdin, stdoutOutput } = makeFakeDeps([1, 0]);

		const promise = showSudoScreen(deps);
		await stdin.send(Buffer.from([0x7f])); // Backspace on empty buffer
		await stdin.send(Buffer.from([0x0d])); // Enter
		await promise;

		const combined = stdoutOutput.join("");
		expect(combined).not.toContain("\b \b");
	});
});
