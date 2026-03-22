// ---------------------------------------------------------------------------
// GitHub API Client
//
// All network calls to GitHub are routed through this module.
//
// Error model:
//   - HTTP 401 or 403           → throws AuthRequired
//   - Any other non-2xx or fetch throws → throws NetworkError
// ---------------------------------------------------------------------------

import type { Repo } from "../repo/types.js";

// ---------------------------------------------------------------------------
// Custom error types
// ---------------------------------------------------------------------------

/**
 * Thrown when GitHub returns HTTP 401 or 403.
 * Callers should trigger the OAuth device flow in response.
 */
export class AuthRequired extends Error {
	readonly status: number;

	constructor(status: number) {
		super(`GitHub returned HTTP ${status} — authentication required`);
		this.name = "AuthRequired";
		this.status = status;
	}
}

/**
 * Thrown on fetch failures or non-2xx responses that are not auth-related.
 */
export class NetworkError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "NetworkError";
	}
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReleaseAsset {
	name: string;
	downloadUrl: string;
}

export interface LatestRelease {
	tag: string;
	assets: ReleaseAsset[];
}

// ---------------------------------------------------------------------------
// Injectable deps
// ---------------------------------------------------------------------------

export interface GitHubClientDeps {
	fetch: (url: string, init?: RequestInit) => Promise<Response>;
	writeFile: (path: string, data: Uint8Array) => Promise<void>;
}

const defaultDeps: GitHubClientDeps = {
	fetch: globalThis.fetch.bind(globalThis),
	writeFile: async (path: string, data: Uint8Array) => {
		await Bun.write(path, data);
	},
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Throws AuthRequired or NetworkError based on the HTTP status code. */
function throwForStatus(status: number): never {
	if (status === 401 || status === 403) {
		throw new AuthRequired(status);
	}
	throw new NetworkError(`GitHub returned HTTP ${status}`);
}

// ---------------------------------------------------------------------------
// fetchManifest
// ---------------------------------------------------------------------------

/**
 * Fetches the raw `scriptor.yaml` manifest from the default branch of the
 * given repo via the GitHub raw content endpoint.
 *
 * Sends an Authorization header when `token` is provided.
 * Throws `AuthRequired` on 401/403, `NetworkError` on other failures.
 */
export async function fetchManifest(
	repo: Repo,
	token?: string,
	deps?: Partial<GitHubClientDeps>,
): Promise<string> {
	const resolved = { ...defaultDeps, ...deps };
	const url = `https://api.github.com/repos/${repo.owner}/${repo.name}/contents/scriptor.yaml`;

	const headers: Record<string, string> = {
		Accept: "application/vnd.github.raw+json",
	};
	if (token) {
		headers.Authorization = `Bearer ${token}`;
	}

	let response: Response;
	try {
		response = await resolved.fetch(url, { headers });
	} catch (err) {
		throw new NetworkError(err instanceof Error ? err.message : "fetch failed");
	}

	if (!response.ok) {
		// raw.githubusercontent.com returns 404 for private repos when no auth
		// token is provided, rather than 401/403 like the REST API. Treat 404
		// as AuthRequired when no token was supplied so the OAuth device flow
		// is triggered for private repos.
		if (response.status === 404 && !token) {
			throw new AuthRequired(404);
		}
		if (response.status === 404) {
			throw new NetworkError(`GitHub returned HTTP 404 — ${url}`);
		}
		throwForStatus(response.status);
	}

	return response.text();
}

// ---------------------------------------------------------------------------
// fetchLatestRelease
// ---------------------------------------------------------------------------

/**
 * Fetches the latest release from the `beolson/Scriptor` repository.
 * Returns the tag name and the list of release assets.
 *
 * Throws `NetworkError` on any failure.
 */
export async function fetchLatestRelease(
	deps?: Partial<GitHubClientDeps>,
): Promise<LatestRelease> {
	const resolved = { ...defaultDeps, ...deps };
	const url = "https://api.github.com/repos/beolson/Scriptor/releases/latest";

	let response: Response;
	try {
		response = await resolved.fetch(url, {
			headers: {
				Accept: "application/vnd.github+json",
			},
		});
	} catch (err) {
		throw new NetworkError(err instanceof Error ? err.message : "fetch failed");
	}

	if (!response.ok) {
		throw new NetworkError(`GitHub returned HTTP ${response.status}`);
	}

	const json = (await response.json()) as {
		tag_name: string;
		assets: Array<{ name: string; browser_download_url: string }>;
	};

	return {
		tag: json.tag_name,
		assets: json.assets.map((a) => ({
			name: a.name,
			downloadUrl: a.browser_download_url,
		})),
	};
}

// ---------------------------------------------------------------------------
// downloadBinary
// ---------------------------------------------------------------------------

/**
 * Downloads a binary asset from `url` and writes it to `destPath`.
 *
 * Throws `NetworkError` on any fetch failure or non-2xx response.
 */
export async function downloadBinary(
	url: string,
	destPath: string,
	deps?: Partial<GitHubClientDeps>,
): Promise<void> {
	const resolved = { ...defaultDeps, ...deps };

	let response: Response;
	try {
		response = await resolved.fetch(url);
	} catch (err) {
		throw new NetworkError(err instanceof Error ? err.message : "fetch failed");
	}

	if (!response.ok) {
		throw new NetworkError(`Download returned HTTP ${response.status}`);
	}

	const buffer = await response.arrayBuffer();
	await resolved.writeFile(destPath, new Uint8Array(buffer));
}
