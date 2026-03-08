const GITHUB_API_BASE = "https://api.github.com";
const REQUEST_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// Custom error types
// ---------------------------------------------------------------------------

/**
 * Thrown when a GitHub API request exceeds the 10-second timeout or the
 * underlying fetch is aborted due to a network timeout.
 */
export class NetworkTimeoutError extends Error {
	constructor(url: string) {
		super(`GitHub API request timed out after ${REQUEST_TIMEOUT_MS}ms: ${url}`);
		this.name = "NetworkTimeoutError";
	}
}

/**
 * Thrown when the GitHub API responds with 401 or 403, indicating that
 * authentication is required to access the resource.
 */
export class AuthRequiredError extends Error {
	constructor(url: string, status: number) {
		super(
			`GitHub API requires authentication (HTTP ${status}): ${url}. Trigger the OAuth flow to obtain a token.`,
		);
		this.name = "AuthRequiredError";
	}
}

/**
 * Thrown when a 404 response is received for the `scriptor.yaml` manifest
 * file, meaning the repository either does not exist or does not contain a
 * manifest.
 */
export class ManifestNotFoundError extends Error {
	constructor(repo: string) {
		super(
			`scriptor.yaml not found in repository "${repo}". Ensure the manifest exists at the repository root.`,
		);
		this.name = "ManifestNotFoundError";
	}
}

/**
 * Thrown when a 404 response is received while fetching a script file.
 * The `scriptPath` property carries the path that could not be fetched.
 */
export class ScriptFetchError extends Error {
	readonly scriptPath: string;

	constructor(repo: string, scriptPath: string) {
		const scriptName = scriptPath.split("/").at(-1) ?? scriptPath;
		super(
			`Failed to fetch script "${scriptName}" (path: ${scriptPath}) from repository "${repo}": file not found.`,
		);
		this.name = "ScriptFetchError";
		this.scriptPath = scriptPath;
	}
}

// ---------------------------------------------------------------------------
// GitHubClient
// ---------------------------------------------------------------------------

export interface GitHubClientOptions {
	/** Injectable fetch-compatible function (defaults to global fetch). */
	fetch?: typeof fetch;
	/** Optional OAuth/PAT token to include in the Authorization header. */
	token?: string;
}

/**
 * Thin GitHub API client that wraps the Commits and Contents REST endpoints.
 *
 * All requests have a 10-second timeout.  Provide an injectable `fetch`
 * function via `options.fetch` so tests can supply a mock without touching
 * the network.
 */
export class GitHubClient {
	private readonly fetchFn: typeof fetch;
	private readonly token: string | undefined;

	constructor(options: GitHubClientOptions = {}) {
		this.fetchFn = options.fetch ?? globalThis.fetch;
		this.token = options.token;
	}

	// -------------------------------------------------------------------------
	// Private helpers
	// -------------------------------------------------------------------------

	private buildHeaders(): Record<string, string> {
		const headers: Record<string, string> = {
			Accept: "application/vnd.github+json",
		};
		if (this.token) {
			headers.Authorization = `Bearer ${this.token}`;
		}
		return headers;
	}

	private async doFetch(url: string): Promise<Response> {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

		try {
			const response = await this.fetchFn(url, {
				headers: this.buildHeaders(),
				signal: controller.signal,
			});
			return response;
		} catch (err) {
			// AbortError or DOMException with name "TimeoutError" both indicate a
			// timeout / abort — wrap in our domain error.
			if (
				err instanceof Error &&
				(err.name === "AbortError" || err.name === "TimeoutError")
			) {
				throw new NetworkTimeoutError(url);
			}
			throw err;
		} finally {
			clearTimeout(timer);
		}
	}

	private handleAuthError(url: string, status: number): never {
		throw new AuthRequiredError(url, status);
	}

	// -------------------------------------------------------------------------
	// Public API
	// -------------------------------------------------------------------------

	/**
	 * Returns the SHA of the latest commit on the default branch of `repo`.
	 *
	 * @param repo - Repository in `owner/repo` format.
	 */
	async getLatestCommitHash(repo: string): Promise<string> {
		const url = `${GITHUB_API_BASE}/repos/${repo}/commits?per_page=1`;
		const response = await this.doFetch(url);

		if (
			response.status === 401 ||
			response.status === 403 ||
			response.status === 404
		) {
			this.handleAuthError(url, response.status);
		}

		if (!response.ok) {
			throw new Error(
				`GitHub Commits API returned HTTP ${response.status} for repository "${repo}"`,
			);
		}

		const data = (await response.json()) as Array<{ sha: string }>;
		const sha = data[0]?.sha;
		if (typeof sha !== "string" || sha === "") {
			throw new Error(
				`Unexpected response shape from GitHub Commits API for "${repo}"`,
			);
		}
		return sha;
	}

	/**
	 * Fetches the raw text content of a file from the GitHub Contents API.
	 *
	 * @param repo - Repository in `owner/repo` format.
	 * @param path - Path to the file within the repository (e.g. `scriptor.yaml`).
	 */
	async fetchFile(repo: string, path: string): Promise<string> {
		const url = `${GITHUB_API_BASE}/repos/${repo}/contents/${path}`;
		const response = await this.doFetch(url);

		if (response.status === 401 || response.status === 403) {
			this.handleAuthError(url, response.status);
		}

		if (response.status === 404) {
			const isManifest =
				path === "scriptor.yaml" || path.endsWith("/scriptor.yaml");
			if (isManifest) {
				throw new ManifestNotFoundError(repo);
			}
			throw new ScriptFetchError(repo, path);
		}

		if (!response.ok) {
			throw new Error(
				`GitHub Contents API returned HTTP ${response.status} for "${path}" in "${repo}"`,
			);
		}

		const data = (await response.json()) as {
			content: string;
			encoding: string;
		};

		if (data.encoding !== "base64") {
			throw new Error(
				`Unsupported content encoding "${data.encoding}" from GitHub Contents API for "${path}"`,
			);
		}

		// Buffer.from handles embedded newlines in GitHub's base64 and correctly
		// decodes multi-byte UTF-8 characters (unlike atob which is Latin-1 only).
		return Buffer.from(data.content, "base64").toString("utf-8");
	}
}
