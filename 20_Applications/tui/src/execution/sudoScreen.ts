// ---------------------------------------------------------------------------
// Sudo Screen
//
// Raw TTY password prompt shown on Unix when any selected script requires
// elevation. On mount it tries `sudo -n -v`; if credentials are already
// cached it skips the prompt entirely. Otherwise it presents a masked
// password input with unlimited retries; Esc exits Scriptor immediately.
//
// All deps are injectable for testability.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SudoScreenDeps {
	setRawMode: (mode: boolean) => void;
	stdinResume: () => void;
	stdinPause: () => void;
	onStdinData: (handler: (chunk: Buffer) => void) => void;
	offStdinData: (handler: (chunk: Buffer) => void) => void;
	stdoutWrite: (msg: string) => void;
	spawn: (
		cmd: string[],
		opts: object,
	) => {
		exited: Promise<number>;
		stdin?: { write: (data: string) => void; end: () => void };
	};
	exit: (code: number) => never;
}

// ---------------------------------------------------------------------------
// showSudoScreen
// ---------------------------------------------------------------------------

/**
 * Displays the sudo password prompt on Unix when credentials are not cached.
 *
 * First spawns `sudo -n -v` (non-interactive). If exit code is 0, credentials
 * are already cached — returns immediately without prompting. Otherwise enters
 * a raw keypress loop for password collection with unlimited retries.
 *
 * Esc exits Scriptor entirely. Enter submits the password via `sudo -S -v`.
 */
export async function showSudoScreen(deps?: SudoScreenDeps): Promise<void> {
	const {
		setRawMode,
		stdinResume,
		stdinPause,
		onStdinData,
		offStdinData,
		stdoutWrite,
		spawn,
		exit,
	} = deps ?? makeDefaultDeps();

	// ------------------------------------------------------------------
	// Step 1: check if credentials are already cached
	// ------------------------------------------------------------------
	const checkProc = spawn(["sudo", "-n", "-v"], {
		stdout: "ignore",
		stderr: "ignore",
	});
	const checkCode = await checkProc.exited;

	if (checkCode === 0) {
		// Credentials already cached — skip prompt
		return;
	}

	// ------------------------------------------------------------------
	// Step 2: show prompt and collect password
	// ------------------------------------------------------------------
	stdoutWrite("Sudo authentication required\n");
	setRawMode(true);
	stdinResume();

	return new Promise<void>((resolve, reject) => {
		let buffer = "";

		const handler = (chunk: Buffer) => {
			const byte = chunk[0];

			if (byte === 0x1b) {
				// Esc — clean up and exit Scriptor entirely
				offStdinData(handler);
				setRawMode(false);
				stdinPause();
				try {
					exit(0);
				} catch (err) {
					// In tests, exit() throws instead of terminating the process.
					// Reject the promise so the test can observe completion.
					reject(err);
				}
				return;
			}

			if (byte === 0x0d) {
				// Enter — submit password
				offStdinData(handler);
				stdoutWrite("\n");

				const password = buffer;
				buffer = "";

				const proc = spawn(["sudo", "-S", "-v"], {
					stdout: "ignore",
					stderr: "ignore",
					stdin: "pipe",
				});

				if (proc.stdin) {
					proc.stdin.write(`${password}\n`);
					proc.stdin.end();
				}

				proc.exited.then((code) => {
					if (code === 0) {
						// Success — clean up and return
						setRawMode(false);
						stdinPause();
						resolve();
						return;
					}

					// Failure — print error and re-enter the loop
					stdoutWrite(
						`\n\x1b[31mSudo validation failed. Please try again.\x1b[0m\n`,
					);
					buffer = "";

					// Re-register handler to continue the loop
					onStdinData(handler);
				});

				return;
			}

			if (byte === 0x7f) {
				// Backspace — remove last character from buffer if non-empty
				if (buffer.length > 0) {
					buffer = buffer.slice(0, -1);
					stdoutWrite("\b \b");
				}
				return;
			}

			// Any other byte — append to buffer and echo '*'
			buffer += String.fromCharCode(byte ?? 0);
			stdoutWrite("*");
		};

		onStdinData(handler);
	});
}

// ---------------------------------------------------------------------------
// Default deps (wired to real implementations)
// ---------------------------------------------------------------------------

function makeDefaultDeps(): SudoScreenDeps {
	return {
		setRawMode: (mode: boolean) => {
			process.stdin.setRawMode(mode);
		},
		stdinResume: () => {
			process.stdin.resume();
		},
		stdinPause: () => {
			process.stdin.pause();
		},
		onStdinData: (handler: (chunk: Buffer) => void) => {
			process.stdin.on("data", handler);
		},
		offStdinData: (handler: (chunk: Buffer) => void) => {
			process.stdin.off("data", handler);
		},
		stdoutWrite: (msg: string) => {
			process.stdout.write(msg);
		},
		spawn: (cmd: string[], opts: object) => {
			const proc = Bun.spawn(cmd, opts as Parameters<typeof Bun.spawn>[1]);
			const procStdin = proc.stdin;
			const stdinHandle =
				procStdin !== null &&
				procStdin !== undefined &&
				typeof procStdin === "object"
					? {
							write: (data: string) => {
								(procStdin as import("bun").FileSink).write(data);
							},
							end: () => {
								(procStdin as import("bun").FileSink).end();
							},
						}
					: undefined;
			return {
				exited: proc.exited,
				stdin: stdinHandle,
			};
		},
		exit: (code: number): never => {
			process.exit(code);
		},
	};
}
