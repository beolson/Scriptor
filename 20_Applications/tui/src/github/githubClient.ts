import { setToken } from "../keychain/keychainService.js";
import { runDeviceFlow } from "./oauth.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FetchResponse = {
	ok: boolean;
	status: number;
	text: () => Promise<string>;
};

export interface GitHubClientDeps {
	fetchFn?: (url: string, init: RequestInit) => Promise<FetchResponse>;
	runDeviceFlowFn?: () => Promise<string>;
	setTokenFn?: (token: string) => void;
	sleepFn?: (ms: number) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RETRY_DELAYS = [1000, 2000, 4000];
const GITHUB_API_BASE = "https://api.github.com";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildUrl(path: string, repo: string): string {
	return `${GITHUB_API_BASE}/repos/${repo}/contents/${path}`;
}

function buildHeaders(token: string | undefined): Record<string, string> {
	const headers: Record<string, string> = {
		Accept: "application/vnd.github.raw+json",
	};
	if (token !== undefined) {
		headers.Authorization = `Bearer ${token}`;
	}
	return headers;
}

function isAuthError(status: number, token: string | undefined): boolean {
	if (status === 401 || status === 403) return true;
	if (status === 404 && token === undefined) return true;
	return false;
}

// ---------------------------------------------------------------------------
// fetchContent
// ---------------------------------------------------------------------------

export async function fetchContent(
	path: string,
	repo: string,
	token: string | undefined,
	deps?: GitHubClientDeps,
): Promise<string> {
	const fetchFn = deps?.fetchFn ?? (fetch as never);
	const runDeviceFlowFn = deps?.runDeviceFlowFn ?? runDeviceFlow;
	const setTokenFn = deps?.setTokenFn ?? setToken;
	const sleepFn =
		deps?.sleepFn ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));

	const url = buildUrl(path, repo);

	// Attempt a single fetch with the current token. Returns the response or
	// throws on network error (not on HTTP error status).
	async function attemptFetch(
		currentToken: string | undefined,
	): Promise<FetchResponse> {
		return fetchFn(url, {
			headers: buildHeaders(currentToken),
		});
	}

	// Network-error retry loop (up to 3 retries after the initial attempt).
	let lastError: unknown;
	for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
		let response: FetchResponse;

		try {
			response = await attemptFetch(token);
		} catch (err) {
			lastError = err;
			if (attempt < RETRY_DELAYS.length) {
				await sleepFn(RETRY_DELAYS[attempt] as number);
				continue;
			}
			// Exhausted all retries
			throw lastError;
		}

		// HTTP success
		if (response.ok) {
			return response.text();
		}

		// 404 with token present → throw immediately (repo not found, no re-auth)
		if (response.status === 404 && token !== undefined) {
			throw new Error(`GitHub returned 404 for ${url}`);
		}

		// Auth errors → run device flow, store token, retry once
		if (isAuthError(response.status, token)) {
			const newToken = await runDeviceFlowFn();
			setTokenFn(newToken);
			token = newToken;

			// Retry once with the new token
			const retryResponse = await attemptFetch(token);
			if (retryResponse.ok) {
				return retryResponse.text();
			}
			throw new Error(
				`GitHub returned ${retryResponse.status} after re-authentication`,
			);
		}

		// Other non-2xx HTTP errors — treat like network errors and retry
		lastError = new Error(`GitHub returned HTTP ${response.status}`);
		if (attempt < RETRY_DELAYS.length) {
			await sleepFn(RETRY_DELAYS[attempt] as number);
			continue;
		}
		throw lastError;
	}

	// Should not be reachable, but TypeScript requires it
	throw lastError ?? new Error("fetchContent: unexpected exit");
}
