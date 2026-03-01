const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";

// ---------------------------------------------------------------------------
// Custom error types
// ---------------------------------------------------------------------------

/**
 * Thrown when the token exchange fails (GitHub returns an error, the request
 * errors out, or the response shape is unexpected).
 */
export class OAuthError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "OAuthError";
	}
}

/**
 * Thrown when every candidate port (primary + all fallbacks) is already in
 * use and no callback server can be started.
 */
export class OAuthPortUnavailableError extends Error {
	constructor(ports: number[]) {
		super(
			`OAuth callback server could not bind to any of the candidate ports: ${ports.join(", ")}. Ensure at least one port is free and registered in the GitHub OAuth App.`,
		);
		this.name = "OAuthPortUnavailableError";
	}
}

// ---------------------------------------------------------------------------
// Injectable dependencies interface
// ---------------------------------------------------------------------------

/**
 * Minimal server handle returned by `createServer`.
 *
 * In production this is a `Bun.Server` instance; in tests it is a lightweight
 * fake that lets the test trigger the callback directly.
 */
export interface OAuthServer {
	readonly port: number;
	stop(): void;
}

/**
 * Injectable dependencies for `startOAuthFlow`.  All fields have production
 * defaults inside the function; provide overrides in tests to avoid real
 * network/port usage.
 */
export interface OAuthDeps {
	/**
	 * Creates an HTTP server on `port` that calls `fetch` for every request.
	 * Should throw an error with `code === "EADDRINUSE"` when the port is
	 * already bound.
	 */
	createServer: (
		port: number,
		fetch: (req: Request) => Response | Promise<Response>,
	) => OAuthServer;

	/**
	 * Opens the user's default browser at `url`.
	 */
	openBrowser: (url: string) => Promise<void>;

	/**
	 * Fetch-compatible function used for the GitHub token exchange request.
	 */
	fetch: typeof globalThis.fetch;

	/** Primary port to try first for the callback server. */
	primaryPort: number;

	/** Ordered list of fallback ports to try if the primary is unavailable. */
	fallbackPorts: number[];
}

// ---------------------------------------------------------------------------
// Production defaults
// ---------------------------------------------------------------------------

const DEFAULT_PRIMARY_PORT = 9876;
const DEFAULT_FALLBACK_PORTS = [9877, 9878];

function defaultCreateServer(
	port: number,
	handler: (req: Request) => Response | Promise<Response>,
): OAuthServer {
	return Bun.serve({ port, fetch: handler });
}

async function defaultOpenBrowser(url: string): Promise<void> {
	const platform = process.platform;
	let cmd: string;
	if (platform === "win32") {
		cmd = `start "" "${url}"`;
	} else if (platform === "darwin") {
		cmd = `open "${url}"`;
	} else {
		cmd = `xdg-open "${url}"`;
	}
	await Bun.$`sh -c ${cmd}`.quiet();
}

// ---------------------------------------------------------------------------
// startOAuthFlow
// ---------------------------------------------------------------------------

/**
 * Runs the GitHub OAuth Authorization Code flow.
 *
 * 1. Starts a temporary localhost HTTP server to receive the OAuth callback.
 * 2. Opens the user's browser to GitHub's authorization page.
 * 3. Waits for the browser to redirect back with an auth code.
 * 4. Exchanges the auth code for an access token via the GitHub token endpoint.
 * 5. Stops the server and resolves with the access token string.
 *
 * The token is returned in memory only — it is never written to disk.
 *
 * @param clientId - The GitHub OAuth App client ID embedded in the binary.
 * @param deps     - Injectable dependencies (defaults to production implementations).
 */
export async function startOAuthFlow(
	clientId: string,
	deps: Partial<OAuthDeps> = {},
): Promise<string> {
	const {
		createServer = defaultCreateServer,
		openBrowser = defaultOpenBrowser,
		fetch: fetchFn = globalThis.fetch,
		primaryPort = DEFAULT_PRIMARY_PORT,
		fallbackPorts = DEFAULT_FALLBACK_PORTS,
	} = deps;

	const ports = [primaryPort, ...fallbackPorts];

	// ------------------------------------------------------------------
	// 1. Try to bind the callback server on one of the candidate ports.
	// ------------------------------------------------------------------
	let server: OAuthServer | null = null;
	const attemptedPorts: number[] = [];

	return new Promise<string>((resolve, reject) => {
		// We need to set up the server synchronously before opening the browser.
		// The resolution happens asynchronously once the callback arrives.

		let boundPort: number | null = null;

		for (const port of ports) {
			attemptedPorts.push(port);
			try {
				server = createServer(port, handleRequest);
				boundPort = port;
				break;
			} catch (err) {
				const isAddrinuse =
					err instanceof Error &&
					(err as NodeJS.ErrnoException).code === "EADDRINUSE";
				if (isAddrinuse) {
					// Try the next port
					continue;
				}
				// Unexpected error — propagate immediately
				reject(err);
				return;
			}
		}

		if (server === null || boundPort === null) {
			reject(new OAuthPortUnavailableError(attemptedPorts));
			return;
		}

		const callbackUrl = `http://localhost:${boundPort}/callback`;

		// Build the GitHub authorization URL
		const authorizeParams = new URLSearchParams({
			client_id: clientId,
			redirect_uri: callbackUrl,
			scope: "repo",
		});
		const authorizeUrl = `${GITHUB_AUTHORIZE_URL}?${authorizeParams.toString()}`;

		// ------------------------------------------------------------------
		// Handler called by the callback server for each incoming request.
		// ------------------------------------------------------------------
		function handleRequest(req: Request): Response | Promise<Response> {
			const url = new URL(req.url);
			const code = url.searchParams.get("code");

			if (!code) {
				// Not the callback we're waiting for; return a friendly error page.
				return new Response(
					"<html><body><p>Missing <code>code</code> parameter.</p></body></html>",
					{ status: 400, headers: { "Content-Type": "text/html" } },
				);
			}

			// Exchange the code for a token asynchronously.
			exchangeCode(code)
				.then((token) => {
					shutdownAndResolve(token);
				})
				.catch((err) => {
					shutdownAndReject(err);
				});

			return new Response(
				"<html><body><p>Authentication successful! You may close this tab.</p></body></html>",
				{ status: 200, headers: { "Content-Type": "text/html" } },
			);
		}

		function shutdownAndResolve(token: string): void {
			server?.stop();
			resolve(token);
		}

		function shutdownAndReject(err: unknown): void {
			server?.stop();
			reject(err);
		}

		// ------------------------------------------------------------------
		// Exchange auth code for an access token.
		// ------------------------------------------------------------------
		async function exchangeCode(code: string): Promise<string> {
			const body = new URLSearchParams({
				client_id: clientId,
				code,
				redirect_uri: callbackUrl,
			});

			let response: Response;
			try {
				response = await fetchFn(GITHUB_TOKEN_URL, {
					method: "POST",
					headers: {
						"Content-Type": "application/x-www-form-urlencoded",
						Accept: "application/json",
					},
					body: body.toString(),
				});
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				throw new OAuthError(
					`Network error during GitHub token exchange: ${msg}`,
				);
			}

			let data: unknown;
			try {
				data = await response.json();
			} catch {
				throw new OAuthError(
					`GitHub token endpoint returned a non-JSON response (HTTP ${response.status}).`,
				);
			}

			if (typeof data !== "object" || data === null) {
				throw new OAuthError(
					"Unexpected response shape from GitHub token endpoint.",
				);
			}

			const record = data as Record<string, unknown>;

			// GitHub signals errors in the JSON body even on 200 responses.
			if (typeof record.error === "string") {
				const desc =
					typeof record.error_description === "string"
						? ` (${record.error_description})`
						: "";
				throw new OAuthError(
					`GitHub OAuth token exchange failed: ${record.error}${desc}`,
				);
			}

			const token = record.access_token;
			if (typeof token !== "string" || token === "") {
				throw new OAuthError(
					"GitHub token endpoint did not return an access_token.",
				);
			}

			return token;
		}

		// ------------------------------------------------------------------
		// 2. Open the browser (async; don't await — the server handles the
		//    callback independently).
		// ------------------------------------------------------------------
		openBrowser(authorizeUrl).catch((err) => {
			// If the browser can't be opened the user won't be able to complete
			// the flow; surface a clear error.
			shutdownAndReject(
				new OAuthError(
					`Failed to open the browser for GitHub OAuth authorization: ${err instanceof Error ? err.message : String(err)}`,
				),
			);
		});
	});
}
