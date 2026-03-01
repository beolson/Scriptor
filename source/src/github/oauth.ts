const GITHUB_DEVICE_CODE_URL = "https://github.com/login/device/code";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const DEFAULT_SCOPE = "repo";

// ---------------------------------------------------------------------------
// Custom error types
// ---------------------------------------------------------------------------

/**
 * Thrown when the Device Flow fails (network error, token exchange error,
 * access denied, or the device code expires before the user authorizes).
 */
export class OAuthError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "OAuthError";
	}
}

// ---------------------------------------------------------------------------
// Injectable dependencies interface
// ---------------------------------------------------------------------------

/**
 * Injectable dependencies for `startOAuthFlow`. All fields have production
 * defaults inside the function; provide overrides in tests to avoid real
 * network usage.
 */
export interface OAuthDeps {
	/** Fetch-compatible function for all HTTP requests. */
	fetch: typeof globalThis.fetch;

	/** Opens the user's default browser at `url`. */
	openBrowser: (url: string) => Promise<void>;

	/**
	 * Called once the device code is obtained so the caller can display
	 * the user code and verification URI in the UI.
	 */
	onDeviceCode: (userCode: string, verificationUri: string) => void;

	/** OAuth scope to request. Defaults to "repo". */
	scope: string;
}

// ---------------------------------------------------------------------------
// Production defaults
// ---------------------------------------------------------------------------

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

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Device code response types
// ---------------------------------------------------------------------------

interface DeviceCodeResponse {
	device_code: string;
	user_code: string;
	verification_uri: string;
	expires_in: number;
	interval: number;
}

interface TokenResponse {
	access_token?: string;
	error?: string;
	error_description?: string;
	interval?: number;
}

// ---------------------------------------------------------------------------
// startOAuthFlow
// ---------------------------------------------------------------------------

/**
 * Runs the GitHub OAuth Device Flow.
 *
 * 1. Requests a device code from GitHub.
 * 2. Calls `deps.onDeviceCode` with the user-facing code and verification URL.
 * 3. Attempts to open the browser at the verification URL.
 * 4. Polls the GitHub token endpoint until the user authorizes or the code expires.
 * 5. Returns the access token string.
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
		fetch: fetchFn = globalThis.fetch,
		openBrowser = defaultOpenBrowser,
		onDeviceCode = () => {},
		scope = DEFAULT_SCOPE,
	} = deps;

	// ------------------------------------------------------------------
	// Step 1: Request device and user codes from GitHub.
	// ------------------------------------------------------------------
	let deviceResp: Response;
	try {
		deviceResp = await fetchFn(GITHUB_DEVICE_CODE_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				Accept: "application/json",
			},
			body: new URLSearchParams({ client_id: clientId, scope }).toString(),
		});
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		throw new OAuthError(`Network error requesting device code: ${msg}`);
	}

	if (!deviceResp.ok) {
		throw new OAuthError(
			`GitHub device code endpoint returned HTTP ${deviceResp.status}.`,
		);
	}

	let deviceData: DeviceCodeResponse;
	try {
		deviceData = (await deviceResp.json()) as DeviceCodeResponse;
	} catch {
		throw new OAuthError(
			"GitHub device code endpoint returned a non-JSON response.",
		);
	}

	const { device_code, user_code, verification_uri, expires_in, interval } =
		deviceData;

	if (!device_code || !user_code || !verification_uri) {
		throw new OAuthError(
			"Unexpected response shape from GitHub device code endpoint.",
		);
	}

	// ------------------------------------------------------------------
	// Step 2: Notify the caller so the UI can display the user code.
	// ------------------------------------------------------------------
	onDeviceCode(user_code, verification_uri);

	// ------------------------------------------------------------------
	// Step 3: Try to open the browser (non-fatal if it fails).
	// ------------------------------------------------------------------
	openBrowser(verification_uri).catch(() => {
		// User can navigate manually — the UI shows the URL.
	});

	// ------------------------------------------------------------------
	// Step 4: Poll the token endpoint until authorized or expired.
	// ------------------------------------------------------------------
	let pollIntervalMs = (interval ?? 5) * 1000;
	const deadline = Date.now() + (expires_in ?? 900) * 1000;

	while (Date.now() < deadline) {
		await sleep(pollIntervalMs);

		let tokenResp: Response;
		try {
			tokenResp = await fetchFn(GITHUB_TOKEN_URL, {
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
					Accept: "application/json",
				},
				body: new URLSearchParams({
					client_id: clientId,
					device_code,
					grant_type: "urn:ietf:params:oauth:grant-type:device_code",
				}).toString(),
			});
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			throw new OAuthError(`Network error polling for token: ${msg}`);
		}

		let tokenData: TokenResponse;
		try {
			tokenData = (await tokenResp.json()) as TokenResponse;
		} catch {
			throw new OAuthError(
				"GitHub token endpoint returned a non-JSON response.",
			);
		}

		if (typeof tokenData.access_token === "string" && tokenData.access_token) {
			return tokenData.access_token;
		}

		switch (tokenData.error) {
			case "authorization_pending":
				// Normal — user hasn't authorized yet. Keep polling.
				break;
			case "slow_down":
				// GitHub asks us to back off; use the returned interval + 5s buffer.
				pollIntervalMs = ((tokenData.interval ?? interval ?? 5) + 5) * 1000;
				break;
			case "expired_token":
				throw new OAuthError(
					"Device code expired before authorization was completed. Please try again.",
				);
			case "access_denied":
				throw new OAuthError("GitHub authorization was denied by the user.");
			default:
				if (tokenData.error) {
					const desc = tokenData.error_description
						? ` (${tokenData.error_description})`
						: "";
					throw new OAuthError(
						`GitHub OAuth token error: ${tokenData.error}${desc}`,
					);
				}
		}
	}

	throw new OAuthError(
		"Device authorization timed out before the user completed the flow.",
	);
}
