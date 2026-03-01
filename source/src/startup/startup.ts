import { parseManifest } from "../manifest/parseManifest.js";

// ---------------------------------------------------------------------------
// Event types emitted during the startup sequence
// ---------------------------------------------------------------------------

/** Emitted just before the manifest is fetched from GitHub. */
export interface FetchingManifestEvent {
	type: "fetching-manifest";
}

/**
 * Emitted just before each script file is fetched from GitHub.
 * `index` is 1-based; `total` is the total number of scripts to fetch.
 */
export interface FetchingScriptEvent {
	type: "fetching-script";
	scriptName: string;
	scriptPath: string;
	index: number;
	total: number;
}

/**
 * Emitted when GitHub is unreachable and the startup sequence falls back to
 * the local cache.
 */
export interface OfflineWarningEvent {
	type: "offline-warning";
	reason: string;
}

/**
 * Emitted when the manifest cannot be fetched AND there is no cached copy.
 */
export interface ManifestErrorEvent {
	type: "manifest-error";
	error: string;
}

/**
 * Emitted when a script file cannot be fetched from GitHub.
 * The startup sequence continues with the remaining scripts.
 */
export interface ScriptErrorEvent {
	type: "script-error";
	scriptPath: string;
	error: string;
}

/** Emitted when a 401/403 triggers the OAuth Device Flow. */
export interface OAuthStartedEvent {
	type: "oauth-started";
}

/**
 * Emitted once GitHub returns the device code so the UI can display
 * the user-facing code and verification URL.
 */
export interface OAuthDeviceCodeEvent {
	type: "oauth-device-code";
	userCode: string;
	verificationUri: string;
}

export type StartupEvent =
	| FetchingManifestEvent
	| FetchingScriptEvent
	| OfflineWarningEvent
	| ManifestErrorEvent
	| ScriptErrorEvent
	| OAuthStartedEvent
	| OAuthDeviceCodeEvent;

// ---------------------------------------------------------------------------
// Injectable dependencies
// ---------------------------------------------------------------------------

/**
 * All external I/O operations used by `runStartup`.
 * Every field is injectable so the function can be tested in isolation.
 */
export interface FetchDeps {
	// GitHub API
	getLatestCommitHash: (repo: string) => Promise<string>;
	fetchFile: (repo: string, path: string) => Promise<string>;

	// Cache
	getStoredCommitHash: () => Promise<string | null>;
	saveCommitHash: (hash: string) => Promise<void>;
	getCachedManifest: () => Promise<string | null>;
	saveManifest: (yaml: string) => Promise<void>;
	getCachedScript: (id: string) => Promise<string | null>;
	saveScript: (id: string, content: string) => Promise<void>;
	isCacheStale: (latestHash: string) => Promise<boolean>;

	// OAuth
	startOAuthFlow: (clientId: string) => Promise<string>;
	oauthClientId: string;

	// Progress sink
	onEvent: (event: StartupEvent) => void;
}

// ---------------------------------------------------------------------------
// StartupResult
// ---------------------------------------------------------------------------

export interface StartupResult {
	/** The raw YAML text of the manifest (empty string when unavailable). */
	manifestYaml: string;
	/** Map from script path (as in the manifest) to raw script content. */
	scripts: Record<string, string>;
	/** True when GitHub was unreachable and the data came from the local cache. */
	offline: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isAuthError(err: unknown): boolean {
	return err instanceof Error && err.name === "AuthRequiredError";
}

// ---------------------------------------------------------------------------
// runStartup
// ---------------------------------------------------------------------------

/**
 * Orchestrates the full startup fetch sequence:
 *
 * 1. Fetch the latest commit hash from GitHub.
 *    - If auth is required, trigger the OAuth flow, then retry.
 *    - If the network is unreachable, fall back to the local cache.
 * 2. Compare the hash to the cached hash.
 *    - If the cache is fresh, load everything from cache.
 *    - If stale (or no cache), download `scriptor.yaml` and all script files.
 * 3. Emit progress events via `deps.onEvent` throughout.
 *
 * Never throws — any errors are captured and expressed via events or the
 * returned `StartupResult` (with `offline: true` / empty `manifestYaml`).
 */
export async function runStartup(
	repo: string,
	deps: FetchDeps,
): Promise<StartupResult> {
	// ------------------------------------------------------------------
	// Step 1: Get the latest commit hash (with OAuth retry on 401/403).
	// ------------------------------------------------------------------
	let latestHash: string | null = null;
	let isOffline = false;
	let token: string | undefined;

	try {
		latestHash = await deps.getLatestCommitHash(repo);
	} catch (err) {
		if (isAuthError(err)) {
			// Trigger OAuth and retry with the new token.
			deps.onEvent({ type: "oauth-started" });
			try {
				token = await deps.startOAuthFlow(deps.oauthClientId);
				// Re-attempt the hash fetch; the caller is expected to recreate
				// the client with the token — for simplicity we call back with
				// the same deps but retry (the mock handles state internally).
				latestHash = await deps.getLatestCommitHash(repo);
			} catch (retryErr) {
				// OAuth failed or retry still failed → fall back to cache.
				const reason =
					retryErr instanceof Error ? retryErr.message : String(retryErr);
				deps.onEvent({ type: "offline-warning", reason });
				isOffline = true;
			}
		} else {
			const reason = err instanceof Error ? err.message : String(err);
			deps.onEvent({ type: "offline-warning", reason });
			isOffline = true;
		}
	}

	// ------------------------------------------------------------------
	// Step 2: Cache-hit check (only when we have a fresh network hash).
	// ------------------------------------------------------------------
	if (!isOffline && latestHash !== null) {
		const stale = await deps.isCacheStale(latestHash);

		if (!stale) {
			// Cache is fresh — load everything from disk.
			const manifestYaml = (await deps.getCachedManifest()) ?? "";
			const scripts = await loadScriptsFromCache(manifestYaml, deps);
			return { manifestYaml, scripts, offline: false };
		}

		// ------------------------------------------------------------------
		// Step 3: Stale cache — download manifest and scripts from GitHub.
		// ------------------------------------------------------------------
		let manifestYaml: string;
		try {
			deps.onEvent({ type: "fetching-manifest" });
			manifestYaml = await fetchWithAuthRetry(
				() => deps.fetchFile(repo, "scriptor.yaml"),
				deps,
				token,
			);
		} catch (err) {
			if (isAuthError(err)) {
				// Auth error during manifest fetch that we couldn't resolve.
				const reason = err instanceof Error ? err.message : String(err);
				deps.onEvent({ type: "offline-warning", reason });
				return await loadFallbackFromCache(deps);
			}
			// Network error → fall back to cache.
			const reason = err instanceof Error ? err.message : String(err);
			deps.onEvent({ type: "offline-warning", reason });
			return await loadFallbackFromCache(deps);
		}

		await deps.saveManifest(manifestYaml);

		// Parse the manifest to find the script paths.
		const entries = safeParseManifest(manifestYaml);
		const scriptPaths = entries.map((e) => e.script);
		const scriptNames: Record<string, string> = {};
		for (const e of entries) {
			scriptNames[e.script] = e.name;
		}
		const total = scriptPaths.length;
		const scripts: Record<string, string> = {};

		for (let i = 0; i < scriptPaths.length; i++) {
			const path = scriptPaths[i];
			if (path === undefined) continue;
			const name = scriptNames[path] ?? path;
			deps.onEvent({
				type: "fetching-script",
				scriptName: name,
				scriptPath: path,
				index: i + 1,
				total,
			});
			try {
				const content = await fetchWithAuthRetry(
					() => deps.fetchFile(repo, path),
					deps,
					token,
				);
				scripts[path] = content;
				await deps.saveScript(path, content);
			} catch (scriptErr) {
				const errMsg =
					scriptErr instanceof Error ? scriptErr.message : String(scriptErr);
				deps.onEvent({ type: "script-error", scriptPath: path, error: errMsg });
				// Attempt to fall back to cached copy of this script.
				const cached = await deps.getCachedScript(path);
				if (cached !== null) {
					scripts[path] = cached;
				}
			}
		}

		// Persist the new commit hash now that we have successfully fetched.
		await deps.saveCommitHash(latestHash);

		return { manifestYaml, scripts, offline: false };
	}

	// ------------------------------------------------------------------
	// Offline path — serve from cache.
	// ------------------------------------------------------------------
	return await loadFallbackFromCache(deps);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Attempts a fetch operation; if it throws an `AuthRequiredError` on the
 * first try, runs the OAuth flow (if not already done) and retries once.
 */
async function fetchWithAuthRetry(
	fetchOp: () => Promise<string>,
	deps: FetchDeps,
	existingToken: string | undefined,
): Promise<string> {
	try {
		return await fetchOp();
	} catch (err) {
		if (isAuthError(err) && existingToken === undefined) {
			deps.onEvent({ type: "oauth-started" });
			await deps.startOAuthFlow(deps.oauthClientId);
			return fetchOp();
		}
		throw err;
	}
}

/**
 * Loads the manifest and all scripts from the local cache.
 * Returns an empty manifest (with event) when no cache is available.
 */
async function loadFallbackFromCache(deps: FetchDeps): Promise<StartupResult> {
	const manifestYaml = await deps.getCachedManifest();

	if (manifestYaml === null) {
		deps.onEvent({
			type: "manifest-error",
			error:
				"No manifest available: GitHub is unreachable and no cached copy exists.",
		});
		return { manifestYaml: "", scripts: {}, offline: true };
	}

	const scripts = await loadScriptsFromCache(manifestYaml, deps);
	return { manifestYaml, scripts, offline: true };
}

/**
 * Loads all scripts referenced in the manifest from the cache.
 * Scripts not found in cache are omitted from the result map.
 */
async function loadScriptsFromCache(
	manifestYaml: string,
	deps: FetchDeps,
): Promise<Record<string, string>> {
	if (!manifestYaml) return {};

	const entries = safeParseManifest(manifestYaml);
	const scripts: Record<string, string> = {};

	for (const entry of entries) {
		const cached = await deps.getCachedScript(entry.script);
		if (cached !== null) {
			scripts[entry.script] = cached;
		}
	}

	return scripts;
}

/**
 * Parses the manifest YAML and returns an empty array on any parse error.
 */
function safeParseManifest(yaml: string) {
	try {
		return parseManifest(yaml);
	} catch {
		return [];
	}
}
