import { describe, expect, it } from "bun:test";
import type { ScreensDeps } from "./screens.js";
import {
	confirmRepoSwitch,
	promptCheckUpdates,
	showFetchProgress,
	showHostInfo,
	showOAuthPrompt,
} from "./screens.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Cancel symbol — the value @clack/prompts returns when the user presses Ctrl-C. */
const CANCEL = Symbol("clack-cancel");

/**
 * Builds a minimal fake clack dep that records calls and returns canned values.
 */
function makeClack(
	opts: {
		confirmResult?: boolean | symbol;
		noteError?: Error;
		logError?: Error;
	} = {},
): ScreensDeps["clack"] & {
	confirmCalls: Array<{ message: string }>;
	noteCalls: Array<{ message: string; title: string | undefined }>;
	logErrorCalls: string[];
	logInfoCalls: string[];
} {
	const confirmCalls: Array<{ message: string }> = [];
	const noteCalls: Array<{ message: string; title: string | undefined }> = [];
	const logErrorCalls: string[] = [];
	const logInfoCalls: string[] = [];

	return {
		confirm: async (confirmOpts: { message: string }) => {
			confirmCalls.push({ message: confirmOpts.message });
			return opts.confirmResult ?? true;
		},
		note: (message: string, title?: string) => {
			if (opts.noteError) throw opts.noteError;
			noteCalls.push({ message, title });
		},
		spinner: () => ({
			start: (_msg?: string) => {},
			stop: (_msg?: string, _code?: number) => {},
		}),
		log: {
			error: (message: string) => {
				if (opts.logError) throw opts.logError;
				logErrorCalls.push(message);
			},
			info: (message: string) => {
				logInfoCalls.push(message);
			},
		},
		// exposed for assertions
		confirmCalls,
		noteCalls,
		logErrorCalls,
		logInfoCalls,
	} as unknown as ScreensDeps["clack"] & {
		confirmCalls: Array<{ message: string }>;
		noteCalls: Array<{ message: string; title: string | undefined }>;
		logErrorCalls: string[];
		logInfoCalls: string[];
	};
}

// ---------------------------------------------------------------------------
// confirmRepoSwitch
// ---------------------------------------------------------------------------

describe("confirmRepoSwitch — returns true", () => {
	it("returns true when confirm resolves true", async () => {
		const clack = makeClack({ confirmResult: true });
		const result = await confirmRepoSwitch("old/repo", "new/repo", { clack });
		expect(result).toBe(true);
	});

	it("includes both old and new repo in the prompt message", async () => {
		const clack = makeClack({ confirmResult: true });
		await confirmRepoSwitch("owner/alpha", "owner/beta", { clack });
		expect(clack.confirmCalls[0]?.message).toContain("owner/alpha");
		expect(clack.confirmCalls[0]?.message).toContain("owner/beta");
	});
});

describe("confirmRepoSwitch — returns false on cancel", () => {
	it("returns false when confirm returns the cancel symbol", async () => {
		const clack = makeClack({ confirmResult: CANCEL });
		const result = await confirmRepoSwitch("old/repo", "new/repo", { clack });
		expect(result).toBe(false);
	});

	it("returns false when confirm returns false", async () => {
		const clack = makeClack({ confirmResult: false });
		const result = await confirmRepoSwitch("old/repo", "new/repo", { clack });
		expect(result).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// promptCheckUpdates
// ---------------------------------------------------------------------------

describe("promptCheckUpdates — returns true", () => {
	it("returns true when confirm resolves true", async () => {
		const clack = makeClack({ confirmResult: true });
		const result = await promptCheckUpdates({ clack });
		expect(result).toBe(true);
	});
});

describe("promptCheckUpdates — returns false on cancel", () => {
	it("returns false when confirm returns the cancel symbol", async () => {
		const clack = makeClack({ confirmResult: CANCEL });
		const result = await promptCheckUpdates({ clack });
		expect(result).toBe(false);
	});

	it("returns false when confirm returns false", async () => {
		const clack = makeClack({ confirmResult: false });
		const result = await promptCheckUpdates({ clack });
		expect(result).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// showFetchProgress
// ---------------------------------------------------------------------------

describe("showFetchProgress", () => {
	it("calls fn and returns its result", async () => {
		const clack = makeClack();
		const result = await showFetchProgress("Fetching…", async () => "hello", {
			clack,
		});
		expect(result).toBe("hello");
	});

	it("propagates rejection from fn", async () => {
		const clack = makeClack();
		const boom = new Error("network failure");
		await expect(
			showFetchProgress(
				"Fetching…",
				async () => {
					throw boom;
				},
				{ clack },
			),
		).rejects.toThrow("network failure");
	});

	it("starts spinner with the provided label", async () => {
		const startCalls: string[] = [];
		const clack = makeClack();
		clack.spinner = () => ({
			start: (msg?: string) => {
				startCalls.push(msg ?? "");
			},
			stop: (_msg?: string, _code?: number) => {},
		});
		await showFetchProgress("My Label", async () => 42, { clack });
		expect(startCalls).toHaveLength(1);
		expect(startCalls[0]).toContain("My Label");
	});

	it("stops spinner after fn resolves", async () => {
		const stopCalls: Array<string | undefined> = [];
		const clack = makeClack();
		clack.spinner = () => ({
			start: (_msg?: string) => {},
			stop: (msg?: string, _code?: number) => {
				stopCalls.push(msg);
			},
		});
		await showFetchProgress("label", async () => "done", { clack });
		expect(stopCalls).toHaveLength(1);
	});

	it("stops spinner even when fn rejects", async () => {
		const stopCalls: Array<string | undefined> = [];
		const clack = makeClack();
		clack.spinner = () => ({
			start: (_msg?: string) => {},
			stop: (msg?: string, _code?: number) => {
				stopCalls.push(msg);
			},
		});
		try {
			await showFetchProgress(
				"label",
				async () => {
					throw new Error("oops");
				},
				{ clack },
			);
		} catch {
			// expected
		}
		expect(stopCalls).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// showOAuthPrompt
// ---------------------------------------------------------------------------

describe("showOAuthPrompt", () => {
	it("calls note() with the user code visible in the message", () => {
		const clack = makeClack();
		showOAuthPrompt("ABCD-1234", "https://github.com/login/device", { clack });
		expect(clack.noteCalls[0]?.message).toContain("ABCD-1234");
	});

	it("calls note() with the verification URL visible in the message", () => {
		const clack = makeClack();
		showOAuthPrompt("ABCD-1234", "https://github.com/login/device", { clack });
		expect(clack.noteCalls[0]?.message).toContain(
			"https://github.com/login/device",
		);
	});
});

// ---------------------------------------------------------------------------
// showHostInfo
// ---------------------------------------------------------------------------

describe("showHostInfo", () => {
	it("includes platform and arch in the output", () => {
		const clack = makeClack();
		showHostInfo({ platform: "mac", arch: "arm" }, { clack });
		expect(clack.logInfoCalls[0]).toContain("mac");
		expect(clack.logInfoCalls[0]).toContain("arm");
	});

	it("formats non-Linux as [platform / arch]", () => {
		const clack = makeClack();
		showHostInfo({ platform: "windows", arch: "x86" }, { clack });
		expect(clack.logInfoCalls[0]).toBe("[windows / x86]");
	});

	it("formats Linux with distro and version as [linux / arch / distro version]", () => {
		const clack = makeClack();
		showHostInfo(
			{
				platform: "linux",
				arch: "x86",
				distro: "Debian GNU/Linux",
				version: "13",
			},
			{ clack },
		);
		expect(clack.logInfoCalls[0]).toBe("[linux / x86 / Debian GNU/Linux 13]");
	});

	it("formats Linux with distro but no version as [linux / arch / distro]", () => {
		const clack = makeClack();
		showHostInfo(
			{ platform: "linux", arch: "arm", distro: "Arch Linux" },
			{ clack },
		);
		expect(clack.logInfoCalls[0]).toBe("[linux / arm / Arch Linux]");
	});

	it("formats Linux without distro as [linux / arch]", () => {
		const clack = makeClack();
		showHostInfo({ platform: "linux", arch: "x86" }, { clack });
		expect(clack.logInfoCalls[0]).toBe("[linux / x86]");
	});

	it("calls log.info exactly once", () => {
		const clack = makeClack();
		showHostInfo({ platform: "mac", arch: "x86" }, { clack });
		expect(clack.logInfoCalls).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// showFatalError
// ---------------------------------------------------------------------------

describe("showFatalError", () => {
	it("calls process.exit(1)", () => {
		let exitCode: number | undefined;
		const clack = makeClack();
		// Import dynamically to inject fake exit
		const { showFatalError } = require("./screens.js");
		try {
			showFatalError("Something went wrong", {
				clack,
				exit: (code: number) => {
					exitCode = code;
					throw new Error("__EXIT__");
				},
			});
		} catch (err) {
			if ((err as Error).message !== "__EXIT__") throw err;
		}
		expect(exitCode).toBe(1);
	});

	it("calls log.error() before exiting", () => {
		const clack = makeClack();
		const { showFatalError } = require("./screens.js");
		try {
			showFatalError("fatal message here", {
				clack,
				exit: () => {
					throw new Error("__EXIT__");
				},
			});
		} catch (err) {
			if ((err as Error).message !== "__EXIT__") throw err;
		}
		expect(clack.logErrorCalls).toHaveLength(1);
		expect(clack.logErrorCalls[0]).toContain("fatal message here");
	});
});
