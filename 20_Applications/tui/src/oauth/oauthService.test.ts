import { describe, expect, it } from "bun:test";
import type { OAuthServiceDeps } from "./oauthService.js";
import { runDeviceFlow } from "./oauthService.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const FAKE_TOKEN = "gho_FakeAccessToken12345";
const FAKE_USER_CODE = "ABCD-1234";
const FAKE_VERIFICATION_URL = "https://github.com/login/device";

/**
 * Builds a minimal fake clack dep that records calls and returns canned values.
 */
function makeClack(
	opts: { noteError?: Error; spinnerStopError?: Error } = {},
): OAuthServiceDeps["clack"] & {
	noteCalls: Array<{ title: string | undefined; message: string }>;
	spinnerStartCalls: string[];
	spinnerStopCalls: string[];
} {
	const noteCalls: Array<{ title: string | undefined; message: string }> = [];
	const spinnerStartCalls: string[] = [];
	const spinnerStopCalls: string[] = [];

	const clack = {
		note: (message: string, title?: string) => {
			if (opts.noteError) throw opts.noteError;
			noteCalls.push({ title, message });
		},
		spinner: () => ({
			start: (message: string) => {
				spinnerStartCalls.push(message);
			},
			stop: (message?: string) => {
				if (opts.spinnerStopError) throw opts.spinnerStopError;
				spinnerStopCalls.push(message ?? "");
			},
		}),
		noteCalls,
		spinnerStartCalls,
		spinnerStopCalls,
	};

	return clack;
}

/**
 * Builds a fake createDeviceFlow dep.
 * `onVerification` is called synchronously with the verification data.
 * After onVerification, the returned auth function resolves with `token`.
 */
function makeCreateDeviceFlow(opts: {
	token?: string;
	userCode?: string;
	verificationUrl?: string;
	error?: Error;
	/** Throw before calling onVerification, simulating a failed device code request. */
	errorBeforeVerification?: Error;
}): OAuthServiceDeps["createDeviceFlow"] {
	return (options) => {
		return async (_authOptions) => {
			const {
				token = FAKE_TOKEN,
				userCode = FAKE_USER_CODE,
				verificationUrl = FAKE_VERIFICATION_URL,
				error,
				errorBeforeVerification,
			} = opts;

			if (errorBeforeVerification) {
				throw errorBeforeVerification;
			}

			// Call onVerification synchronously to simulate the device flow
			await options.onVerification({
				device_code: "fake_device_code",
				user_code: userCode,
				verification_uri: verificationUrl,
				expires_in: 900,
				interval: 5,
			});

			if (error) {
				throw error;
			}

			return { token };
		};
	};
}

// ---------------------------------------------------------------------------
// runDeviceFlow — successful flow
// ---------------------------------------------------------------------------

describe("runDeviceFlow — successful flow", () => {
	it("requests the 'repo' scope", async () => {
		const clack = makeClack();
		let capturedScopes: string[] | undefined;
		const createDeviceFlow: OAuthServiceDeps["createDeviceFlow"] = (
			options,
		) => {
			capturedScopes = (options as { scopes?: string[] }).scopes;
			return async (_authOptions) => {
				await options.onVerification({
					device_code: "fake_device_code",
					user_code: FAKE_USER_CODE,
					verification_uri: FAKE_VERIFICATION_URL,
					expires_in: 900,
					interval: 5,
				});
				return { token: FAKE_TOKEN };
			};
		};
		await runDeviceFlow({ clack, createDeviceFlow });
		expect(capturedScopes).toContain("repo");
	});

	it("returns the access token on success", async () => {
		const clack = makeClack();
		const createDeviceFlow = makeCreateDeviceFlow({ token: FAKE_TOKEN });
		const token = await runDeviceFlow({ clack, createDeviceFlow });
		expect(token).toBe(FAKE_TOKEN);
	});

	it("calls note() with the user code visible in the message", async () => {
		const clack = makeClack();
		const createDeviceFlow = makeCreateDeviceFlow({
			userCode: FAKE_USER_CODE,
			verificationUrl: FAKE_VERIFICATION_URL,
		});
		await runDeviceFlow({ clack, createDeviceFlow });
		expect(clack.noteCalls).toHaveLength(1);
		expect(clack.noteCalls[0]?.message).toContain(FAKE_USER_CODE);
	});

	it("calls note() with the verification URL visible in the message", async () => {
		const clack = makeClack();
		const createDeviceFlow = makeCreateDeviceFlow({
			userCode: FAKE_USER_CODE,
			verificationUrl: FAKE_VERIFICATION_URL,
		});
		await runDeviceFlow({ clack, createDeviceFlow });
		expect(clack.noteCalls[0]?.message).toContain(FAKE_VERIFICATION_URL);
	});

	it("starts the spinner with an 'authorization' message during polling", async () => {
		const clack = makeClack();
		const createDeviceFlow = makeCreateDeviceFlow({});
		await runDeviceFlow({ clack, createDeviceFlow });

		// The spinner start calls array should have the waiting message
		expect(clack.spinnerStartCalls.length).toBeGreaterThan(0);
		expect(clack.spinnerStartCalls[0]).toContain("authorization");
	});

	it("stops the spinner on success", async () => {
		const clack = makeClack();
		const createDeviceFlow = makeCreateDeviceFlow({});
		await runDeviceFlow({ clack, createDeviceFlow });
		expect(clack.spinnerStopCalls).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// runDeviceFlow — error during polling (after onVerification fires)
// ---------------------------------------------------------------------------

describe("runDeviceFlow — error during polling", () => {
	it("rethrows the error from createDeviceFlow", async () => {
		const clack = makeClack();
		const authError = new Error("OAuth authorization failed");
		const createDeviceFlow = makeCreateDeviceFlow({ error: authError });

		await expect(runDeviceFlow({ clack, createDeviceFlow })).rejects.toThrow(
			"OAuth authorization failed",
		);
	});

	it("stops the spinner before rethrowing", async () => {
		const clack = makeClack();
		const authError = new Error("device flow cancelled");
		const createDeviceFlow = makeCreateDeviceFlow({ error: authError });

		try {
			await runDeviceFlow({ clack, createDeviceFlow });
		} catch {
			// expected
		}

		expect(clack.spinnerStopCalls).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// runDeviceFlow — error before onVerification fires
// ---------------------------------------------------------------------------

describe("runDeviceFlow — error before onVerification fires", () => {
	it("rethrows the error", async () => {
		const clack = makeClack();
		const authError = new Error("GitHub OAuth App not found");
		const createDeviceFlow = makeCreateDeviceFlow({
			errorBeforeVerification: authError,
		});

		await expect(runDeviceFlow({ clack, createDeviceFlow })).rejects.toThrow(
			"GitHub OAuth App not found",
		);
	});

	it("does not call stop() when start() was never called", async () => {
		const clack = makeClack();
		const createDeviceFlow = makeCreateDeviceFlow({
			errorBeforeVerification: new Error("early failure"),
		});

		try {
			await runDeviceFlow({ clack, createDeviceFlow });
		} catch {
			// expected
		}

		expect(clack.spinnerStopCalls).toHaveLength(0);
	});
});
