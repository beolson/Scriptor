import { describe, expect, test } from "bun:test";
import { type OAuthDeps, OAuthError, startOAuthFlow } from "./oauth";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a minimal device-code response body.
 * interval=0 so tests don't actually sleep between polls.
 */
function makeDeviceCodeBody(overrides: Record<string, unknown> = {}): string {
	return JSON.stringify({
		device_code: "dev_code_abc",
		user_code: "ABCD-1234",
		verification_uri: "https://github.com/login/device",
		expires_in: 900,
		interval: 0,
		...overrides,
	});
}

/**
 * Builds a mock fetch that returns a device-code response on the first call,
 * then returns each subsequent response from `pollResponses` in order.
 */
function makeFetch(pollResponses: object[]): typeof fetch {
	let call = 0;
	return async () => {
		if (call === 0) {
			call++;
			return new Response(makeDeviceCodeBody(), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}
		const body = pollResponses[call - 1] ?? { error: "expired_token" };
		call++;
		return new Response(JSON.stringify(body), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	};
}

/** Deps with a successful token after one pending poll. */
function makeSuccessDeps(
	overrides: Partial<OAuthDeps> = {},
): Partial<OAuthDeps> {
	return {
		fetch: makeFetch([
			{ error: "authorization_pending" },
			{ access_token: "gho_faketoken", token_type: "bearer" },
		]),
		openBrowser: async () => {},
		onDeviceCode: () => {},
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Device code request
// ---------------------------------------------------------------------------

describe("startOAuthFlow — device code request", () => {
	test("posts to the GitHub device code endpoint", async () => {
		const requestedUrls: string[] = [];
		const capturingFetch: typeof fetch = async (input, _init) => {
			requestedUrls.push(input.toString());
			// First call: device code
			if (requestedUrls.length === 1) {
				return new Response(makeDeviceCodeBody(), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			}
			// Second call: token
			return new Response(JSON.stringify({ access_token: "gho_tok" }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		};

		await startOAuthFlow("client_id", {
			...makeSuccessDeps(),
			fetch: capturingFetch,
		});

		expect(requestedUrls[0]).toContain("github.com/login/device/code");
	});

	test("includes client_id and scope in the device code request", async () => {
		const requestBodies: string[] = [];
		const capturingFetch: typeof fetch = async (input, _init) => {
			const body = await new Request(input as string, init).text();
			requestBodies.push(body);
			if (requestBodies.length === 1) {
				return new Response(makeDeviceCodeBody(), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			}
			return new Response(JSON.stringify({ access_token: "gho_tok" }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		};

		await startOAuthFlow("my_client_id", {
			...makeSuccessDeps(),
			fetch: capturingFetch,
			scope: "repo",
		});

		const params = new URLSearchParams(requestBodies[0]);
		expect(params.get("client_id")).toBe("my_client_id");
		expect(params.get("scope")).toBe("repo");
	});

	test("throws OAuthError when device code endpoint returns non-ok status", async () => {
		const fetchFn: typeof fetch = async () =>
			new Response("{}", { status: 500 });

		await expect(
			startOAuthFlow("client_id", {
				...makeSuccessDeps(),
				fetch: fetchFn,
			}),
		).rejects.toBeInstanceOf(OAuthError);
	});

	test("throws OAuthError when device code fetch throws a network error", async () => {
		const fetchFn: typeof fetch = async () => {
			throw new Error("Network failure");
		};

		await expect(
			startOAuthFlow("client_id", {
				...makeSuccessDeps(),
				fetch: fetchFn,
			}),
		).rejects.toBeInstanceOf(OAuthError);
	});
});

// ---------------------------------------------------------------------------
// onDeviceCode callback
// ---------------------------------------------------------------------------

describe("startOAuthFlow — onDeviceCode callback", () => {
	test("calls onDeviceCode with the user code and verification URI", async () => {
		const calls: Array<{ userCode: string; verificationUri: string }> = [];

		await startOAuthFlow("client_id", {
			...makeSuccessDeps(),
			onDeviceCode: (userCode, verificationUri) => {
				calls.push({ userCode, verificationUri });
			},
		});

		expect(calls).toHaveLength(1);
		expect(calls[0]?.userCode).toBe("ABCD-1234");
		expect(calls[0]?.verificationUri).toBe("https://github.com/login/device");
	});
});

// ---------------------------------------------------------------------------
// Browser opening
// ---------------------------------------------------------------------------

describe("startOAuthFlow — browser opening", () => {
	test("opens the browser at the verification URI", async () => {
		const openedUrls: string[] = [];

		await startOAuthFlow("client_id", {
			...makeSuccessDeps(),
			openBrowser: async (url) => {
				openedUrls.push(url);
			},
		});

		expect(openedUrls).toHaveLength(1);
		expect(openedUrls[0]).toContain("github.com/login/device");
	});

	test("does not reject if openBrowser throws", async () => {
		await expect(
			startOAuthFlow("client_id", {
				...makeSuccessDeps(),
				openBrowser: async () => {
					throw new Error("no browser available");
				},
			}),
		).resolves.toBe("gho_faketoken");
	});
});

// ---------------------------------------------------------------------------
// Token polling
// ---------------------------------------------------------------------------

describe("startOAuthFlow — token polling", () => {
	test("resolves with the access token on success", async () => {
		const token = await startOAuthFlow(
			"client_id",
			makeSuccessDeps({ fetch: makeFetch([{ access_token: "gho_mytoken" }]) }),
		);

		expect(token).toBe("gho_mytoken");
	});

	test("keeps polling through authorization_pending responses", async () => {
		const token = await startOAuthFlow(
			"client_id",
			makeSuccessDeps({
				fetch: makeFetch([
					{ error: "authorization_pending" },
					{ error: "authorization_pending" },
					{ access_token: "gho_eventually" },
				]),
			}),
		);

		expect(token).toBe("gho_eventually");
	});

	test("polls the GitHub token endpoint", async () => {
		const requestedUrls: string[] = [];
		let call = 0;
		const capturingFetch: typeof fetch = async (input) => {
			requestedUrls.push(input.toString());
			if (call++ === 0) {
				return new Response(makeDeviceCodeBody(), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			}
			return new Response(JSON.stringify({ access_token: "gho_tok" }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		};

		await startOAuthFlow("client_id", {
			...makeSuccessDeps(),
			fetch: capturingFetch,
		});

		expect(requestedUrls.some((u) => u.includes("access_token"))).toBe(true);
	});

	test("sends device_code and grant_type in poll request", async () => {
		const pollBodies: string[] = [];
		let call = 0;
		const capturingFetch: typeof fetch = async (input, _init) => {
			if (call++ === 0) {
				return new Response(makeDeviceCodeBody(), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			}
			const body = await new Request(input as string, init).text();
			pollBodies.push(body);
			return new Response(JSON.stringify({ access_token: "gho_tok" }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		};

		await startOAuthFlow("my_client", {
			...makeSuccessDeps(),
			fetch: capturingFetch,
		});

		const params = new URLSearchParams(pollBodies[0]);
		expect(params.get("device_code")).toBe("dev_code_abc");
		expect(params.get("grant_type")).toBe(
			"urn:ietf:params:oauth:grant-type:device_code",
		);
		expect(params.get("client_id")).toBe("my_client");
	});

	test("throws OAuthError on expired_token", async () => {
		await expect(
			startOAuthFlow(
				"client_id",
				makeSuccessDeps({ fetch: makeFetch([{ error: "expired_token" }]) }),
			),
		).rejects.toBeInstanceOf(OAuthError);
	});

	test("throws OAuthError on access_denied", async () => {
		await expect(
			startOAuthFlow(
				"client_id",
				makeSuccessDeps({ fetch: makeFetch([{ error: "access_denied" }]) }),
			),
		).rejects.toBeInstanceOf(OAuthError);
	});

	test("throws OAuthError with error code in message for unknown errors", async () => {
		let err: unknown;
		try {
			await startOAuthFlow(
				"client_id",
				makeSuccessDeps({
					fetch: makeFetch([{ error: "some_unknown_error" }]),
				}),
			);
		} catch (e) {
			err = e;
		}

		expect(err).toBeInstanceOf(OAuthError);
		expect((err as OAuthError).message).toContain("some_unknown_error");
	});

	test("throws OAuthError when poll fetch throws a network error", async () => {
		let call = 0;
		const fetchFn: typeof fetch = async () => {
			if (call++ === 0) {
				return new Response(makeDeviceCodeBody(), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			}
			throw new Error("Network failure");
		};

		await expect(
			startOAuthFlow("client_id", { ...makeSuccessDeps(), fetch: fetchFn }),
		).rejects.toBeInstanceOf(OAuthError);
	});
});
