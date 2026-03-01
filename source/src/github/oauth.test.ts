import { describe, expect, test } from "bun:test";
import {
	type OAuthDeps,
	OAuthError,
	OAuthPortUnavailableError,
	startOAuthFlow,
} from "./oauth";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * A lightweight fake server that simulates a Bun HTTP server.
 * It provides a `simulateCallback(url)` helper to invoke the handler as
 * if a real browser redirected to the callback URL.
 */
function makeFakeServer() {
	let handler: ((req: Request) => Response | Promise<Response>) | null = null;
	let stopped = false;

	const server = {
		port: 0 as number, // set by the factory when instantiated
		stop() {
			stopped = true;
		},
		get isStopped() {
			return stopped;
		},
		/** Simulate the browser hitting the callback URL. */
		async simulateCallback(url: string): Promise<Response> {
			if (!handler) throw new Error("No handler registered");
			return handler(new Request(url));
		},
	};

	const factory = (
		port: number,
		fetch: (req: Request) => Response | Promise<Response>,
	): typeof server => {
		handler = fetch;
		server.port = port;
		return server;
	};

	return { server, factory };
}

/**
 * Creates a mock fetch that returns a successful token exchange response.
 */
function makeTokenFetch(accessToken: string): typeof fetch {
	return async (_input: RequestInfo | URL, _init?: RequestInit) => {
		return new Response(
			JSON.stringify({ access_token: accessToken, token_type: "bearer" }),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			},
		);
	};
}

/**
 * Creates a mock fetch that returns an error response from the token endpoint.
 */
function makeErrorTokenFetch(errorCode: string): typeof fetch {
	return async (_input: RequestInfo | URL, _init?: RequestInit) => {
		return new Response(
			JSON.stringify({
				error: errorCode,
				error_description: "Something went wrong",
			}),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			},
		);
	};
}

/**
 * Creates a mock fetch that throws a network error.
 */
function makeNetworkErrorFetch(): typeof fetch {
	return async () => {
		throw new Error("Network failure");
	};
}

/**
 * Builds a minimal OAuthDeps with sensible defaults for testing.
 * Override specific fields as needed per test.
 */
function _makeDeps(overrides: Partial<OAuthDeps> = {}): OAuthDeps {
	const { server, factory } = makeFakeServer();

	const defaultDeps: OAuthDeps = {
		createServer: factory,
		openBrowser: async (_url: string) => {
			// no-op; simulates browser opening
		},
		fetch: makeTokenFetch("gho_fakeaccesstoken"),
		primaryPort: 9876,
		fallbackPorts: [9877, 9878],
	};

	const deps = { ...defaultDeps, ...overrides };

	// If we used the default factory, wire up auto-callback simulation
	if (!overrides.createServer) {
		// Return a special version of deps that exposes the fake server
		(deps as OAuthDeps & { _fakeServer: typeof server })._fakeServer = server;
	}

	return deps;
}

// ---------------------------------------------------------------------------
// Helper that runs the flow and triggers the callback concurrently
// ---------------------------------------------------------------------------

/**
 * Starts the OAuth flow and then immediately simulates the browser callback.
 * Returns the resolved access token.
 */
async function runFlowWithCallback(
	clientId: string,
	code: string,
	deps?: Partial<OAuthDeps>,
): Promise<string> {
	const { server, factory } = makeFakeServer();

	const fullDeps: OAuthDeps = {
		createServer: factory,
		openBrowser: async (_url: string) => {
			// Trigger the callback after a tick so the server is already listening
			setTimeout(() => {
				const callbackUrl = `http://localhost:${server.port}/callback?code=${code}`;
				server.simulateCallback(callbackUrl).catch(() => {
					// ignore
				});
			}, 0);
		},
		fetch: makeTokenFetch("gho_fakeaccesstoken"),
		primaryPort: 9876,
		fallbackPorts: [9877, 9878],
		...deps,
	};

	return startOAuthFlow(clientId, fullDeps);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("startOAuthFlow — server creation", () => {
	test("creates a server on the primary port first", async () => {
		const portsUsed: number[] = [];
		const { server, factory } = makeFakeServer();

		const trackingFactory: OAuthDeps["createServer"] = (port, fetch) => {
			portsUsed.push(port);
			return factory(port, fetch);
		};

		const flowPromise = startOAuthFlow("client_id_123", {
			createServer: trackingFactory,
			openBrowser: async () => {
				setTimeout(() => {
					const callbackUrl = `http://localhost:${server.port}/callback?code=auth_code_abc`;
					server.simulateCallback(callbackUrl).catch(() => {});
				}, 0);
			},
			fetch: makeTokenFetch("gho_token"),
			primaryPort: 9876,
			fallbackPorts: [9877, 9878],
		});

		await flowPromise;

		expect(portsUsed[0]).toBe(9876);
	});

	test("falls back to alternate ports if primary is in use", async () => {
		const portsUsed: number[] = [];
		const { server, factory } = makeFakeServer();

		// Primary port throws EADDRINUSE; only the second port succeeds
		const trackingFactory: OAuthDeps["createServer"] = (port, fetchFn) => {
			portsUsed.push(port);
			if (port === 9876) {
				throw Object.assign(new Error("address in use"), {
					code: "EADDRINUSE",
				});
			}
			return factory(port, fetchFn);
		};

		const flowPromise = startOAuthFlow("client_id_123", {
			createServer: trackingFactory,
			openBrowser: async () => {
				setTimeout(() => {
					server
						.simulateCallback(
							`http://localhost:${server.port}/callback?code=auth_code_abc`,
						)
						.catch(() => {});
				}, 0);
			},
			fetch: makeTokenFetch("gho_token"),
			primaryPort: 9876,
			fallbackPorts: [9877, 9878],
		});

		await flowPromise;

		expect(portsUsed).toContain(9876);
		expect(portsUsed).toContain(9877);
		// Should have stopped at 9877 — not tried 9878
		expect(portsUsed).not.toContain(9878);
	});

	test("throws OAuthPortUnavailableError when all ports are in use", async () => {
		const alwaysFailFactory: OAuthDeps["createServer"] = (_port, _fetchFn) => {
			throw Object.assign(new Error("address in use"), { code: "EADDRINUSE" });
		};

		const flowPromise = startOAuthFlow("client_id_123", {
			createServer: alwaysFailFactory,
			openBrowser: async () => {},
			fetch: makeTokenFetch("gho_token"),
			primaryPort: 9876,
			fallbackPorts: [9877],
		});

		await expect(flowPromise).rejects.toBeInstanceOf(OAuthPortUnavailableError);
	});

	test("OAuthPortUnavailableError message lists the ports attempted", async () => {
		const alwaysFailFactory: OAuthDeps["createServer"] = (_port, _fetchFn) => {
			throw Object.assign(new Error("address in use"), { code: "EADDRINUSE" });
		};

		let caughtError: unknown;
		try {
			await startOAuthFlow("client_id_123", {
				createServer: alwaysFailFactory,
				openBrowser: async () => {},
				fetch: makeTokenFetch("gho_token"),
				primaryPort: 9876,
				fallbackPorts: [9877],
			});
		} catch (e) {
			caughtError = e;
		}

		expect(caughtError).toBeInstanceOf(OAuthPortUnavailableError);
		expect((caughtError as OAuthPortUnavailableError).message).toContain(
			"9876",
		);
		expect((caughtError as OAuthPortUnavailableError).message).toContain(
			"9877",
		);
	});
});

describe("startOAuthFlow — browser opening", () => {
	test("opens the browser with a GitHub authorization URL", async () => {
		const openedUrls: string[] = [];
		const { server, factory } = makeFakeServer();

		await startOAuthFlow("my_client_id", {
			createServer: factory,
			openBrowser: async (url: string) => {
				openedUrls.push(url);
				setTimeout(() => {
					server
						.simulateCallback(
							`http://localhost:${server.port}/callback?code=abc`,
						)
						.catch(() => {});
				}, 0);
			},
			fetch: makeTokenFetch("gho_token"),
			primaryPort: 9876,
			fallbackPorts: [],
		});

		expect(openedUrls).toHaveLength(1);
		expect(openedUrls[0]).toContain("github.com/login/oauth/authorize");
	});

	test("authorization URL includes the client_id", async () => {
		const openedUrls: string[] = [];
		const { server, factory } = makeFakeServer();

		await startOAuthFlow("my_unique_client_id", {
			createServer: factory,
			openBrowser: async (url: string) => {
				openedUrls.push(url);
				setTimeout(() => {
					server
						.simulateCallback(
							`http://localhost:${server.port}/callback?code=abc`,
						)
						.catch(() => {});
				}, 0);
			},
			fetch: makeTokenFetch("gho_token"),
			primaryPort: 9876,
			fallbackPorts: [],
		});

		expect(openedUrls[0]).toContain("client_id=my_unique_client_id");
	});

	test("authorization URL includes a redirect_uri pointing to the callback port", async () => {
		const openedUrls: string[] = [];
		const { server, factory } = makeFakeServer();

		await startOAuthFlow("client_id_123", {
			createServer: factory,
			openBrowser: async (url: string) => {
				openedUrls.push(url);
				setTimeout(() => {
					server
						.simulateCallback(
							`http://localhost:${server.port}/callback?code=abc`,
						)
						.catch(() => {});
				}, 0);
			},
			fetch: makeTokenFetch("gho_token"),
			primaryPort: 9876,
			fallbackPorts: [],
		});

		expect(openedUrls[0]).toContain("redirect_uri=");
		expect(openedUrls[0]).toContain("9876");
	});
});

describe("startOAuthFlow — callback parsing", () => {
	test("resolves the promise with the access token on successful callback", async () => {
		const token = await runFlowWithCallback("client_id", "myauthcode", {
			fetch: makeTokenFetch("gho_real_token"),
		});

		expect(token).toBe("gho_real_token");
	});

	test("the callback server correctly parses the code query parameter", async () => {
		const capturedCodes: string[] = [];

		const { server, factory } = makeFakeServer();

		const capturingFetch: typeof fetch = async (input, init) => {
			// Extract code from the POST body
			const body = await new Request(input as string, init).text();
			const params = new URLSearchParams(body);
			const code = params.get("code");
			if (code) capturedCodes.push(code);

			return new Response(
				JSON.stringify({ access_token: "gho_tok", token_type: "bearer" }),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
		};

		await startOAuthFlow("client_id", {
			createServer: factory,
			openBrowser: async () => {
				setTimeout(() => {
					server
						.simulateCallback(
							`http://localhost:${server.port}/callback?code=specific_code_123`,
						)
						.catch(() => {});
				}, 0);
			},
			fetch: capturingFetch,
			primaryPort: 9876,
			fallbackPorts: [],
		});

		expect(capturedCodes).toContain("specific_code_123");
	});

	test("returns a non-empty access token string", async () => {
		const token = await runFlowWithCallback("client_id", "code_xyz");
		expect(typeof token).toBe("string");
		expect(token.length).toBeGreaterThan(0);
	});
});

describe("startOAuthFlow — token exchange", () => {
	test("calls the GitHub token endpoint to exchange the code", async () => {
		const requestedUrls: string[] = [];

		const capturingFetch: typeof fetch = async (input, _init) => {
			requestedUrls.push(input.toString());
			return new Response(
				JSON.stringify({ access_token: "gho_tok", token_type: "bearer" }),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
		};

		await runFlowWithCallback("client_id", "code", { fetch: capturingFetch });

		expect(requestedUrls).toHaveLength(1);
		expect(requestedUrls[0]).toContain("github.com/login/oauth/access_token");
	});

	test("sends client_id and code in the token exchange request", async () => {
		const requestBodies: string[] = [];

		const capturingFetch: typeof fetch = async (input, init) => {
			const body = await new Request(input as string, init).text();
			requestBodies.push(body);
			return new Response(
				JSON.stringify({ access_token: "gho_tok", token_type: "bearer" }),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
		};

		await runFlowWithCallback("my_client_id_456", "the_auth_code", {
			fetch: capturingFetch,
		});

		expect(requestBodies).toHaveLength(1);
		const params = new URLSearchParams(requestBodies[0]);
		expect(params.get("client_id")).toBe("my_client_id_456");
		expect(params.get("code")).toBe("the_auth_code");
	});

	test("rejects with OAuthError when token exchange returns an error field", async () => {
		const { server, factory } = makeFakeServer();

		const flowPromise = startOAuthFlow("client_id", {
			createServer: factory,
			openBrowser: async () => {
				setTimeout(() => {
					server
						.simulateCallback(
							`http://localhost:${server.port}/callback?code=bad_code`,
						)
						.catch(() => {});
				}, 0);
			},
			fetch: makeErrorTokenFetch("bad_verification_code"),
			primaryPort: 9876,
			fallbackPorts: [],
		});

		await expect(flowPromise).rejects.toBeInstanceOf(OAuthError);
	});

	test("OAuthError message contains the error code from GitHub", async () => {
		const { server, factory } = makeFakeServer();

		let caughtError: unknown;
		try {
			await startOAuthFlow("client_id", {
				createServer: factory,
				openBrowser: async () => {
					setTimeout(() => {
						server
							.simulateCallback(
								`http://localhost:${server.port}/callback?code=bad_code`,
							)
							.catch(() => {});
					}, 0);
				},
				fetch: makeErrorTokenFetch("bad_verification_code"),
				primaryPort: 9876,
				fallbackPorts: [],
			});
		} catch (e) {
			caughtError = e;
		}

		expect(caughtError).toBeInstanceOf(OAuthError);
		expect((caughtError as OAuthError).message).toContain(
			"bad_verification_code",
		);
	});

	test("rejects with OAuthError when token exchange fetch throws a network error", async () => {
		const { server, factory } = makeFakeServer();

		const flowPromise = startOAuthFlow("client_id", {
			createServer: factory,
			openBrowser: async () => {
				setTimeout(() => {
					server
						.simulateCallback(
							`http://localhost:${server.port}/callback?code=code`,
						)
						.catch(() => {});
				}, 0);
			},
			fetch: makeNetworkErrorFetch(),
			primaryPort: 9876,
			fallbackPorts: [],
		});

		await expect(flowPromise).rejects.toBeInstanceOf(OAuthError);
	});
});

describe("startOAuthFlow — server shutdown", () => {
	test("stops the server after a successful token exchange", async () => {
		let createdServer: ReturnType<typeof makeFakeServer>["server"] | null =
			null;
		const { server, factory } = makeFakeServer();

		const trackingFactory: OAuthDeps["createServer"] = (port, fetchFn) => {
			const srv = factory(port, fetchFn);
			createdServer = srv as typeof server;
			return srv;
		};

		await startOAuthFlow("client_id", {
			createServer: trackingFactory,
			openBrowser: async () => {
				setTimeout(() => {
					server
						.simulateCallback(
							`http://localhost:${server.port}/callback?code=ok_code`,
						)
						.catch(() => {});
				}, 0);
			},
			fetch: makeTokenFetch("gho_token"),
			primaryPort: 9876,
			fallbackPorts: [],
		});

		expect(createdServer).not.toBeNull();
		expect((createdServer as typeof server).isStopped).toBe(true);
	});

	test("stops the server even when token exchange fails", async () => {
		let createdServer: ReturnType<typeof makeFakeServer>["server"] | null =
			null;
		const { server, factory } = makeFakeServer();

		const trackingFactory: OAuthDeps["createServer"] = (port, fetchFn) => {
			const srv = factory(port, fetchFn);
			createdServer = srv as typeof server;
			return srv;
		};

		try {
			await startOAuthFlow("client_id", {
				createServer: trackingFactory,
				openBrowser: async () => {
					setTimeout(() => {
						server
							.simulateCallback(
								`http://localhost:${server.port}/callback?code=bad_code`,
							)
							.catch(() => {});
					}, 0);
				},
				fetch: makeErrorTokenFetch("bad_verification_code"),
				primaryPort: 9876,
				fallbackPorts: [],
			});
		} catch {
			// expected
		}

		expect(createdServer).not.toBeNull();
		expect((createdServer as typeof server).isStopped).toBe(true);
	});
});
