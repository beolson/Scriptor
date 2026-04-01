import { describe, expect, it } from "bun:test";
import { GITHUB_CLIENT_ID } from "../config.js";
import { runDeviceFlow } from "./oauth.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Verification = {
	device_code: string;
	user_code: string;
	verification_uri: string;
	expires_in: number;
	interval: number;
};

type AuthFnResult = { token: string };

/**
 * Builds a mock `createAuthFn` that captures the options passed to it and
 * returns a mock auth callable whose invocation resolves with `{ token }`.
 */
function makeMockCreateAuth(token: string): {
	calls: Array<{
		clientType?: string;
		clientId: string;
		scopes?: string[];
		onVerification: (v: Verification) => void;
	}>;
	fn: (opts: {
		clientType?: string;
		clientId: string;
		scopes?: string[];
		onVerification: (v: Verification) => void;
	}) => (_authOpts: { type: string }) => Promise<AuthFnResult>;
} {
	const calls: Array<{
		clientType?: string;
		clientId: string;
		scopes?: string[];
		onVerification: (v: Verification) => void;
	}> = [];
	return {
		calls,
		fn: (opts) => {
			calls.push(opts);
			return async (_authOpts) => ({ token });
		},
	};
}

const MOCK_VERIFICATION: Verification = {
	device_code: "dev_code_123",
	user_code: "ABCD-1234",
	verification_uri: "https://github.com/login/device",
	expires_in: 900,
	interval: 5,
};

// ---------------------------------------------------------------------------
// runDeviceFlow — calls createAuthFn with correct options
// ---------------------------------------------------------------------------

describe("runDeviceFlow — createAuthFn options", () => {
	it("calls createAuthFn with clientType 'oauth-app'", async () => {
		const { calls, fn } = makeMockCreateAuth("tok");
		await runDeviceFlow({
			createAuthFn: fn as never,
			logNoteFn: async () => {},
		});
		expect(calls.length).toBe(1);
		// biome-ignore lint/style/noNonNullAssertion: length asserted above
		expect(calls[0]!.clientType).toBe("oauth-app");
	});

	it("calls createAuthFn with clientId from GITHUB_CLIENT_ID", async () => {
		const { calls, fn } = makeMockCreateAuth("tok");
		await runDeviceFlow({
			createAuthFn: fn as never,
			logNoteFn: async () => {},
		});
		// biome-ignore lint/style/noNonNullAssertion: length asserted above
		expect(calls[0]!.clientId).toBe(GITHUB_CLIENT_ID);
	});

	it("calls createAuthFn with scopes containing 'repo'", async () => {
		const { calls, fn } = makeMockCreateAuth("tok");
		await runDeviceFlow({
			createAuthFn: fn as never,
			logNoteFn: async () => {},
		});
		// biome-ignore lint/style/noNonNullAssertion: length asserted above
		expect(calls[0]!.scopes).toContain("repo");
	});
});

// ---------------------------------------------------------------------------
// runDeviceFlow — onVerification calls logNoteFn
// ---------------------------------------------------------------------------

describe("runDeviceFlow — onVerification", () => {
	it("onVerification callback calls logNoteFn with a string containing the verification URI", async () => {
		const logNotes: string[] = [];

		// Build a createAuthFn that immediately triggers onVerification
		const createAuthFn = (opts: {
			onVerification: (v: Verification) => void;
		}) => {
			return async (_authOpts: { type: string }) => {
				// Simulate the library calling onVerification before resolving
				opts.onVerification(MOCK_VERIFICATION);
				return { token: "ghp_test" };
			};
		};

		await runDeviceFlow({
			createAuthFn: createAuthFn as never,
			logNoteFn: async (msg: string) => {
				logNotes.push(msg);
			},
		});

		expect(logNotes.length).toBeGreaterThan(0);
		const combined = logNotes.join(" ");
		expect(combined).toContain("https://github.com/login/device");
	});

	it("onVerification callback includes the user code in the log message", async () => {
		const logNotes: string[] = [];

		const createAuthFn = (opts: {
			onVerification: (v: Verification) => void;
		}) => {
			return async (_authOpts: { type: string }) => {
				opts.onVerification(MOCK_VERIFICATION);
				return { token: "ghp_test" };
			};
		};

		await runDeviceFlow({
			createAuthFn: createAuthFn as never,
			logNoteFn: async (msg: string) => {
				logNotes.push(msg);
			},
		});

		const combined = logNotes.join(" ");
		expect(combined).toContain("ABCD-1234");
	});
});

// ---------------------------------------------------------------------------
// runDeviceFlow — return value
// ---------------------------------------------------------------------------

describe("runDeviceFlow — return value", () => {
	it("returns the token string on success", async () => {
		const { fn } = makeMockCreateAuth("ghp_returned_token");
		const token = await runDeviceFlow({
			createAuthFn: fn as never,
			logNoteFn: async () => {},
		});
		expect(token).toBe("ghp_returned_token");
	});
});

// ---------------------------------------------------------------------------
// runDeviceFlow — error propagation
// ---------------------------------------------------------------------------

describe("runDeviceFlow — error propagation", () => {
	it("lets errors thrown by createAuthFn propagate to the caller", async () => {
		const createAuthFn = (_opts: unknown) => {
			throw new Error("access_denied");
		};

		await expect(
			runDeviceFlow({
				createAuthFn: createAuthFn as never,
				logNoteFn: async () => {},
			}),
		).rejects.toThrow("access_denied");
	});

	it("lets errors thrown by the auth() call propagate to the caller", async () => {
		const createAuthFn = (_opts: unknown) => {
			return async (_authOpts: unknown) => {
				throw new Error("expired_token");
			};
		};

		await expect(
			runDeviceFlow({
				createAuthFn: createAuthFn as never,
				logNoteFn: async () => {},
			}),
		).rejects.toThrow("expired_token");
	});
});
