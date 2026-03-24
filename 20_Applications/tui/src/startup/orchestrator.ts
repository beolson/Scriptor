// ---------------------------------------------------------------------------
// Startup Orchestrator
//
// Coordinates all services and screens into the startup sequence:
//   1. Resolve repo (flag → config → default)
//   2. Confirm repo switch if flag differs from stored config
//   3. Check keychain for stored OAuth token
//   4. If cache exists → prompt for updates; else fetch immediately
//   5. Fetch manifest + platform-matching scripts (with OAuth retry on 401/403)
//      - fetchScript retried up to 3 times before aborting
//   6. Write cache (manifest + scripts) after successful fetch
//   7. Return ManifestResult
//
// All deps are injectable so the orchestrator can be unit-tested without
// a TTY, filesystem, network, or real keychain.
// ---------------------------------------------------------------------------

import type { Config } from "../config/types.js";
import { AuthRequired } from "../github/githubClient.js";
import type { HostInfo } from "../host/types.js";
import type { ScriptEntry } from "../manifest/types.js";
import { repoToString } from "../repo/parseRepo.js";
import type { Repo } from "../repo/types.js";

// ---------------------------------------------------------------------------
// Default repo
// ---------------------------------------------------------------------------

const DEFAULT_REPO: Repo = { owner: "beolson", name: "Scriptor" };
const KEYCHAIN_KEY = "scriptor-github-token";
const SCRIPT_FETCH_ATTEMPTS = 3;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface StartupOptions {
	/** Detected host — always provided by the caller (program.ts). */
	host: HostInfo;
	/** Parsed Repo from the --repo CLI flag, or undefined if not supplied. */
	repo?: Repo;
	/**
	 * When true, read scriptor.yaml directly from the local git root instead
	 * of fetching from GitHub. Skips cache, OAuth, and update checks entirely.
	 * Set by --repo=local on the CLI.
	 */
	localMode?: boolean;
}

export interface ManifestResult {
	/** The resolved repo used for this startup. Sentinel { owner:"local", name:"local" } in local mode. */
	repo: Repo;
	/** The raw YAML manifest string (from cache or network). */
	manifest: string;
	/** Detected host platform, arch, and (on Linux) distro/version. */
	host: HostInfo;
	/**
	 * Absolute path to the local git root. Only set when localMode is true.
	 * Downstream code (script execution) uses this to locate script files on disk.
	 */
	localRoot?: string;
}

// ---------------------------------------------------------------------------
// Injectable deps
// ---------------------------------------------------------------------------

export interface OrchestratorDeps {
	// Config service
	readConfig: () => Promise<Config>;
	writeConfig: (config: Config) => Promise<void>;

	// Cache service
	cacheExists: (repo: Repo) => Promise<boolean>;
	readManifest: (repo: Repo) => Promise<string>;
	writeCache: (
		repo: Repo,
		manifest: string,
		scripts: Map<string, string>,
	) => Promise<void>;

	// GitHub API client
	fetchManifest: (repo: Repo, token?: string) => Promise<string>;
	fetchScript: (repo: Repo, path: string, token?: string) => Promise<string>;

	// Manifest parsing + host filtering (synchronous; returns [] on error)
	parseAndFilterScripts: (manifest: string, host: HostInfo) => ScriptEntry[];

	// Local repo reader (used when localMode is true)
	readLocalManifest: () => Promise<{ manifest: string; gitRoot: string }>;

	// Keychain service
	keychainGet: (key: string) => Promise<string | null>;
	keychainSet: (key: string, value: string) => Promise<void>;

	// OAuth service
	runDeviceFlow: () => Promise<string>;

	// Startup screens
	confirmRepoSwitch: (oldRepo: string, newRepo: string) => Promise<boolean>;
	promptCheckUpdates: () => Promise<boolean>;
	showFetchProgress: <T>(
		label: string,
		fn: () => Promise<T>,
		stopLabel?: string,
	) => Promise<T>;
	showFatalError: (message: string) => never;
}

// ---------------------------------------------------------------------------
// Default deps (wired to real implementations)
// ---------------------------------------------------------------------------

function makeDefaultDeps(): OrchestratorDeps {
	// Lazy imports to avoid circular deps and keep the module testable without
	// real side effects at import time.
	return {
		readConfig: async () => {
			const { readConfig } = await import("../config/configService.js");
			return readConfig();
		},
		writeConfig: async (config) => {
			const { writeConfig } = await import("../config/configService.js");
			return writeConfig(config);
		},
		cacheExists: async (repo) => {
			const { cacheExists } = await import("../cache/cacheService.js");
			return cacheExists(repo);
		},
		readManifest: async (repo) => {
			const { readManifest } = await import("../cache/cacheService.js");
			return readManifest(repo);
		},
		writeCache: async (repo, manifest, scripts) => {
			const { writeCache } = await import("../cache/cacheService.js");
			return writeCache(repo, manifest, scripts);
		},
		fetchManifest: async (repo, token) => {
			const { fetchManifest } = await import("../github/githubClient.js");
			return fetchManifest(repo, token);
		},
		fetchScript: async (repo, path, token) => {
			const { fetchScript } = await import("../github/githubClient.js");
			return fetchScript(repo, path, token);
		},
		parseAndFilterScripts: (manifest, host) => {
			try {
				const { parseManifest } =
					require("../manifest/parseManifest.js") as typeof import("../manifest/parseManifest.js");
				const { filterManifest } =
					require("../manifest/filterManifest.js") as typeof import("../manifest/filterManifest.js");
				const parsed = parseManifest(manifest, {
					log: { error: () => {} },
					exit: (() => {
						throw new Error("manifest parse error");
					}) as (code: number) => never,
				});
				return filterManifest(parsed, host);
			} catch {
				return [];
			}
		},
		readLocalManifest: async () => {
			const { readLocalManifest } = await import("./localRepo.js");
			return readLocalManifest();
		},
		keychainGet: async (key) => {
			const { keychainGet } = await import("../keychain/keychainService.js");
			return keychainGet(key);
		},
		keychainSet: async (key, value) => {
			const { keychainSet } = await import("../keychain/keychainService.js");
			return keychainSet(key, value);
		},
		runDeviceFlow: async () => {
			const { runDeviceFlow } = await import("../oauth/oauthService.js");
			return runDeviceFlow();
		},
		confirmRepoSwitch: async (oldRepo, newRepo) => {
			const { confirmRepoSwitch } = await import("./screens.js");
			return confirmRepoSwitch(oldRepo, newRepo);
		},
		promptCheckUpdates: async () => {
			const { promptCheckUpdates } = await import("./screens.js");
			return promptCheckUpdates();
		},
		showFetchProgress: async (label, fn, stopLabel) => {
			const { showFetchProgress } = await import("./screens.js");
			return showFetchProgress(label, fn, undefined, stopLabel);
		},
		showFatalError: (message) => {
			const { showFatalError } =
				require("./screens.js") as typeof import("./screens.js");
			return showFatalError(message);
		},
	};
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Retries `fn` up to `maxAttempts` times before re-throwing the last error. */
async function withRetry<T>(
	fn: () => Promise<T>,
	maxAttempts: number,
): Promise<T> {
	let lastErr: unknown;
	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		try {
			return await fn();
		} catch (err) {
			lastErr = err;
		}
	}
	throw lastErr;
}

/**
 * Downloads all script files for the given entries in parallel.
 * Each file is retried up to SCRIPT_FETCH_ATTEMPTS times.
 * Cache key = entry.script with leading "scripts/" stripped, so files land at
 * ~/.scriptor/cache/<owner>/<repo>/scripts/<platform>/<distro>/script.sh
 * mirroring the git repo structure.
 */
async function downloadScripts(
	entries: ScriptEntry[],
	repo: Repo,
	token: string | undefined,
	deps: Pick<OrchestratorDeps, "fetchScript">,
): Promise<Map<string, string>> {
	const scripts = new Map<string, string>();
	await Promise.all(
		entries.map(async (entry) => {
			const content = await withRetry(
				() => deps.fetchScript(repo, entry.script, token),
				SCRIPT_FETCH_ATTEMPTS,
			);
			// Strip leading "scripts/" so the key matches cacheService's scriptPath helper.
			const key = entry.script.replace(/^scripts\//, "");
			scripts.set(key, content);
		}),
	);
	return scripts;
}

/**
 * Parses a stored "owner/repo" string from config back into a Repo object.
 * Falls back to the default repo if parsing fails.
 */
function parseStoredRepo(stored: string): Repo {
	const parts = stored.split("/");
	if (parts.length === 2 && parts[0] && parts[1]) {
		return { owner: parts[0], name: parts[1] };
	}
	return DEFAULT_REPO;
}

// ---------------------------------------------------------------------------
// runStartup
// ---------------------------------------------------------------------------

/**
 * Runs the full startup sequence and returns a ManifestResult containing
 * the resolved repo and the raw YAML manifest string.
 *
 * `opts.host` must be pre-detected by the caller (program.ts) so it can be
 * included in the intro title before any prompts appear.
 *
 * This function never returns normally if it encounters a fatal error
 * (no cache + no network): it calls `deps.showFatalError()` which exits.
 */
export async function runStartup(
	opts: StartupOptions,
	deps: OrchestratorDeps = makeDefaultDeps(),
): Promise<ManifestResult> {
	const { host } = opts;

	// -------------------------------------------------------------------------
	// Local mode: read directly from the git root, skip everything else.
	// -------------------------------------------------------------------------
	if (opts.localMode) {
		const { manifest, gitRoot } = await deps.readLocalManifest();
		return {
			repo: { owner: "local", name: "local" },
			manifest,
			host,
			localRoot: gitRoot,
		};
	}

	// -------------------------------------------------------------------------
	// Step 1: Read stored config
	// -------------------------------------------------------------------------
	const config = await deps.readConfig();

	// -------------------------------------------------------------------------
	// Step 2: Resolve the effective repo
	//   Priority: --repo flag → config.repo → default
	// -------------------------------------------------------------------------
	let repo: Repo;

	if (opts.repo) {
		// A --repo flag was supplied. Check if it differs from stored config.
		const storedRepoStr = config.repo;
		const flagRepoStr = repoToString(opts.repo);

		if (storedRepoStr && storedRepoStr !== flagRepoStr) {
			// Prompt the user to confirm the switch.
			const confirmed = await deps.confirmRepoSwitch(
				storedRepoStr,
				flagRepoStr,
			);
			if (confirmed) {
				// Update config with the new repo.
				await deps.writeConfig({ ...config, repo: flagRepoStr });
				repo = opts.repo;
			} else {
				// User declined — continue with the stored repo.
				repo = parseStoredRepo(storedRepoStr);
			}
		} else {
			// Flag matches stored config, or no stored config — use flag directly.
			repo = opts.repo;
		}
	} else if (config.repo) {
		// No flag — use stored config repo.
		repo = parseStoredRepo(config.repo);
	} else {
		// No flag, no config — use the default.
		repo = DEFAULT_REPO;
	}

	// -------------------------------------------------------------------------
	// Step 3: Check keychain for a stored OAuth token
	// -------------------------------------------------------------------------
	const storedToken = await deps.keychainGet(KEYCHAIN_KEY);
	let token: string | undefined = storedToken ?? undefined;

	// -------------------------------------------------------------------------
	// Step 4: Determine whether to fetch or use cache
	// -------------------------------------------------------------------------
	const hasCache = await deps.cacheExists(repo);

	if (hasCache) {
		// Cache exists — prompt the user to check for updates.
		const wantsUpdate = await deps.promptCheckUpdates();

		if (!wantsUpdate) {
			// User declined — return cached manifest (scripts already on disk).
			const manifest = await deps.readManifest(repo);
			return { repo, manifest, host };
		}

		// User accepted — fall through to the fetch path below (with a stop label).
	}

	const fetchStopLabel = hasCache ? "Scripts updated" : undefined;

	// -------------------------------------------------------------------------
	// Step 5+6: Fetch manifest + platform-matching scripts, then write cache.
	// Both operations run under a single spinner.
	// -------------------------------------------------------------------------
	type FetchAll = { manifest: string; scripts: Map<string, string> };

	const doFetchAll = async (
		fetchToken?: string,
		stopLabel?: string,
	): Promise<FetchAll> => {
		return deps.showFetchProgress(
			"Fetching…",
			async () => {
				const manifest = await deps.fetchManifest(repo, fetchToken);
				const entries = deps.parseAndFilterScripts(manifest, host);
				const scripts = await downloadScripts(entries, repo, fetchToken, deps);
				return { manifest, scripts };
			},
			stopLabel,
		);
	};

	let fetched: FetchAll;
	try {
		fetched = await doFetchAll(token, fetchStopLabel);
	} catch (err) {
		if (err instanceof AuthRequired) {
			// Trigger device flow to get a new token.
			const newToken = await deps.runDeviceFlow();
			token = newToken;

			// Persist the token in the keychain.
			await deps.keychainSet(KEYCHAIN_KEY, newToken);

			// Retry the full fetch+scripts with the new token.
			try {
				fetched = await doFetchAll(newToken, fetchStopLabel);
			} catch (retryErr) {
				if (!hasCache) {
					deps.showFatalError(
						retryErr instanceof Error ? retryErr.message : "Failed to fetch",
					);
				}
				throw retryErr;
			}
		} else if (!hasCache) {
			// Network/fetch error with no cache — fatal.
			deps.showFatalError(
				err instanceof Error ? err.message : "Failed to fetch manifest",
			);
			// showFatalError never returns, but TypeScript doesn't know that
			// from this side of the injectable boundary, so unreachable:
			throw err;
		} else {
			throw err;
		}
	}

	await deps.writeCache(repo, fetched.manifest, fetched.scripts);

	return { repo, manifest: fetched.manifest, host };
}
