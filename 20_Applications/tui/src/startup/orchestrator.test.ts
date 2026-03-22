// ---------------------------------------------------------------------------
// Startup Orchestrator Tests
//
// All deps are injected as fakes. Each branch of the startup sequence is
// driven by a test-first approach.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "bun:test";
import { AuthRequired, NetworkError } from "../github/githubClient.js";
import type { OrchestratorDeps } from "./orchestrator.js";
import { runStartup } from "./orchestrator.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CACHED_MANIFEST = "scripts:\n  - id: test-script";
const FETCHED_MANIFEST = "scripts:\n  - id: fetched-script";

/**
 * Builds a complete fake deps object with sensible defaults (cache present,
 * no token, confirm resolves true, fetch succeeds).
 * Override individual properties to test specific branches.
 */
const FAKE_HOST = { platform: "linux" as const, arch: "x86" as const };

function makeDeps(overrides: Partial<OrchestratorDeps> = {}): OrchestratorDeps {
	return {
		readConfig: async () => ({}),
		writeConfig: async () => {},
		cacheExists: async () => true,
		readManifest: async () => CACHED_MANIFEST,
		writeCache: async () => {},
		fetchManifest: async () => FETCHED_MANIFEST,
		readLocalManifest: async () => ({
			manifest: FETCHED_MANIFEST,
			gitRoot: "/fake/git/root",
		}),
		keychainGet: async () => null,
		keychainSet: async () => {},
		runDeviceFlow: async () => "new-token",
		detectHost: async () => FAKE_HOST,
		confirmRepoSwitch: async () => true,
		promptCheckUpdates: async () => false,
		showFetchProgress: async (_label, fn) => fn(),
		showHostInfo: () => {},
		showFatalError: (_msg) => {
			throw new Error("showFatalError called");
		},
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Repo resolution
// ---------------------------------------------------------------------------

describe("repo resolution — default repo", () => {
	it("uses beolson/Scriptor when no flag and no config", async () => {
		let fetchedOwner: string | undefined;
		let fetchedName: string | undefined;
		const deps = makeDeps({
			cacheExists: async () => false,
			fetchManifest: async (repo) => {
				fetchedOwner = repo.owner;
				fetchedName = repo.name;
				return FETCHED_MANIFEST;
			},
		});
		await runStartup({}, deps);
		expect(fetchedOwner).toBe("beolson");
		expect(fetchedName).toBe("Scriptor");
	});

	it("uses config.repo when no flag is provided", async () => {
		let fetchedOwner: string | undefined;
		const deps = makeDeps({
			readConfig: async () => ({ repo: "owner/stored-repo" }),
			cacheExists: async () => false,
			fetchManifest: async (repo) => {
				fetchedOwner = repo.owner;
				return FETCHED_MANIFEST;
			},
		});
		await runStartup({}, deps);
		expect(fetchedOwner).toBe("owner");
	});

	it("uses --repo flag when provided, ignoring config", async () => {
		let fetchedOwner: string | undefined;
		const deps = makeDeps({
			readConfig: async () => ({ repo: "owner/stored-repo" }),
			cacheExists: async () => false,
			fetchManifest: async (repo) => {
				fetchedOwner = repo.owner;
				return FETCHED_MANIFEST;
			},
		});
		await runStartup(
			{ repo: { owner: "flag-owner", name: "flag-repo" } },
			deps,
		);
		expect(fetchedOwner).toBe("flag-owner");
	});
});

// ---------------------------------------------------------------------------
// Repo switch confirmation
// ---------------------------------------------------------------------------

describe("repo switch — flag differs from config", () => {
	it("prompts for confirmation when flag differs from stored config", async () => {
		let confirmCalled = false;
		const deps = makeDeps({
			readConfig: async () => ({ repo: "old/repo" }),
			confirmRepoSwitch: async () => {
				confirmCalled = true;
				return true;
			},
			cacheExists: async () => false,
			fetchManifest: async () => FETCHED_MANIFEST,
		});
		await runStartup({ repo: { owner: "new", name: "repo" } }, deps);
		expect(confirmCalled).toBe(true);
	});

	it("updates config when user confirms repo switch", async () => {
		let writtenRepo: string | undefined;
		const deps = makeDeps({
			readConfig: async () => ({ repo: "old/repo" }),
			confirmRepoSwitch: async () => true,
			writeConfig: async (config) => {
				writtenRepo = config.repo;
			},
			cacheExists: async () => false,
			fetchManifest: async () => FETCHED_MANIFEST,
		});
		await runStartup({ repo: { owner: "new", name: "repo" } }, deps);
		expect(writtenRepo).toBe("new/repo");
	});

	it("does NOT update config when user declines repo switch", async () => {
		let writeConfigCalled = false;
		const deps = makeDeps({
			readConfig: async () => ({ repo: "old/repo" }),
			confirmRepoSwitch: async () => false,
			writeConfig: async () => {
				writeConfigCalled = true;
			},
			cacheExists: async () => false,
			fetchManifest: async () => FETCHED_MANIFEST,
		});
		await runStartup({ repo: { owner: "new", name: "repo" } }, deps);
		expect(writeConfigCalled).toBe(false);
	});

	it("uses old repo when user declines repo switch", async () => {
		let fetchedOwner: string | undefined;
		const deps = makeDeps({
			readConfig: async () => ({ repo: "old/repo" }),
			confirmRepoSwitch: async () => false,
			cacheExists: async () => false,
			fetchManifest: async (repo) => {
				fetchedOwner = repo.owner;
				return FETCHED_MANIFEST;
			},
		});
		await runStartup({ repo: { owner: "new", name: "repo" } }, deps);
		expect(fetchedOwner).toBe("old");
	});

	it("does not prompt when flag matches stored config", async () => {
		let confirmCalled = false;
		const deps = makeDeps({
			readConfig: async () => ({ repo: "same/repo" }),
			confirmRepoSwitch: async () => {
				confirmCalled = true;
				return true;
			},
			cacheExists: async () => false,
			fetchManifest: async () => FETCHED_MANIFEST,
		});
		await runStartup({ repo: { owner: "same", name: "repo" } }, deps);
		expect(confirmCalled).toBe(false);
	});

	it("does not prompt when no flag is provided", async () => {
		let confirmCalled = false;
		const deps = makeDeps({
			readConfig: async () => ({ repo: "stored/repo" }),
			confirmRepoSwitch: async () => {
				confirmCalled = true;
				return true;
			},
			cacheExists: async () => false,
			fetchManifest: async () => FETCHED_MANIFEST,
		});
		await runStartup({}, deps);
		expect(confirmCalled).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Cache-first startup
// ---------------------------------------------------------------------------

describe("cache-first startup", () => {
	it("returns cached manifest when cache exists and user declines update", async () => {
		const deps = makeDeps({
			cacheExists: async () => true,
			readManifest: async () => CACHED_MANIFEST,
			promptCheckUpdates: async () => false,
		});
		const result = await runStartup({}, deps);
		expect(result.manifest).toBe(CACHED_MANIFEST);
	});

	it("prompts for update check when cache exists", async () => {
		let promptCalled = false;
		const deps = makeDeps({
			cacheExists: async () => true,
			promptCheckUpdates: async () => {
				promptCalled = true;
				return false;
			},
		});
		await runStartup({}, deps);
		expect(promptCalled).toBe(true);
	});

	it("does NOT call fetchManifest when cache exists and user declines update", async () => {
		let fetchCalled = false;
		const deps = makeDeps({
			cacheExists: async () => true,
			promptCheckUpdates: async () => false,
			fetchManifest: async () => {
				fetchCalled = true;
				return FETCHED_MANIFEST;
			},
		});
		await runStartup({}, deps);
		expect(fetchCalled).toBe(false);
	});

	it("fetches and updates cache when user accepts update", async () => {
		let writeCacheCalled = false;
		const deps = makeDeps({
			cacheExists: async () => true,
			promptCheckUpdates: async () => true,
			fetchManifest: async () => FETCHED_MANIFEST,
			writeCache: async () => {
				writeCacheCalled = true;
			},
		});
		const result = await runStartup({}, deps);
		expect(result.manifest).toBe(FETCHED_MANIFEST);
		expect(writeCacheCalled).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// First run (no cache)
// ---------------------------------------------------------------------------

describe("first run — no cache", () => {
	it("fetches immediately without prompting for updates", async () => {
		let promptCalled = false;
		const deps = makeDeps({
			cacheExists: async () => false,
			promptCheckUpdates: async () => {
				promptCalled = true;
				return true;
			},
			fetchManifest: async () => FETCHED_MANIFEST,
		});
		await runStartup({}, deps);
		expect(promptCalled).toBe(false);
	});

	it("returns fetched manifest", async () => {
		const deps = makeDeps({
			cacheExists: async () => false,
			fetchManifest: async () => FETCHED_MANIFEST,
		});
		const result = await runStartup({}, deps);
		expect(result.manifest).toBe(FETCHED_MANIFEST);
	});

	it("writes cache after successful fetch", async () => {
		let writeCacheCalled = false;
		const deps = makeDeps({
			cacheExists: async () => false,
			fetchManifest: async () => FETCHED_MANIFEST,
			writeCache: async () => {
				writeCacheCalled = true;
			},
		});
		await runStartup({}, deps);
		expect(writeCacheCalled).toBe(true);
	});

	it("calls showFatalError when no cache and network fails", async () => {
		let fatalCalled = false;
		const deps = makeDeps({
			cacheExists: async () => false,
			fetchManifest: async () => {
				throw new NetworkError("Network unavailable");
			},
			showFatalError: (_msg) => {
				fatalCalled = true;
				throw new Error("__FATAL__");
			},
		});
		try {
			await runStartup({}, deps);
		} catch (err) {
			if ((err as Error).message !== "__FATAL__") throw err;
		}
		expect(fatalCalled).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Token handling
// ---------------------------------------------------------------------------

describe("token — stored token sent proactively", () => {
	it("passes stored token to fetchManifest", async () => {
		let tokenUsed: string | undefined;
		const deps = makeDeps({
			keychainGet: async () => "stored-token",
			cacheExists: async () => false,
			fetchManifest: async (_repo, token) => {
				tokenUsed = token;
				return FETCHED_MANIFEST;
			},
		});
		await runStartup({}, deps);
		expect(tokenUsed).toBe("stored-token");
	});

	it("passes undefined token when no token is stored", async () => {
		let tokenUsed: string | undefined | null = "sentinel";
		const deps = makeDeps({
			keychainGet: async () => null,
			cacheExists: async () => false,
			fetchManifest: async (_repo, token) => {
				tokenUsed = token;
				return FETCHED_MANIFEST;
			},
		});
		await runStartup({}, deps);
		expect(tokenUsed).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// OAuth device flow
// ---------------------------------------------------------------------------

describe("OAuth — triggered on AuthRequired", () => {
	it("runs device flow on 401 when no token is stored", async () => {
		let deviceFlowCalled = false;
		const deps = makeDeps({
			keychainGet: async () => null,
			cacheExists: async () => false,
			fetchManifest: async (_repo, token) => {
				if (!token) throw new AuthRequired(401);
				return FETCHED_MANIFEST;
			},
			runDeviceFlow: async () => {
				deviceFlowCalled = true;
				return "new-token";
			},
		});
		await runStartup({}, deps);
		expect(deviceFlowCalled).toBe(true);
	});

	it("retries fetch with new token after device flow succeeds", async () => {
		const deps = makeDeps({
			keychainGet: async () => null,
			cacheExists: async () => false,
			fetchManifest: async (_repo, token) => {
				if (!token) throw new AuthRequired(401);
				return FETCHED_MANIFEST;
			},
			runDeviceFlow: async () => "new-token",
		});
		const result = await runStartup({}, deps);
		expect(result.manifest).toBe(FETCHED_MANIFEST);
	});

	it("stores new token in keychain after device flow", async () => {
		let storedToken: string | undefined;
		const deps = makeDeps({
			keychainGet: async () => null,
			cacheExists: async () => false,
			fetchManifest: async (_repo, token) => {
				if (!token) throw new AuthRequired(401);
				return FETCHED_MANIFEST;
			},
			runDeviceFlow: async () => "new-token",
			keychainSet: async (_key, value) => {
				storedToken = value;
			},
		});
		await runStartup({}, deps);
		expect(storedToken).toBe("new-token");
	});

	it("re-triggers device flow when stored token receives 401 (expired)", async () => {
		let deviceFlowCalled = false;
		const deps = makeDeps({
			keychainGet: async () => "expired-token",
			cacheExists: async () => false,
			fetchManifest: async (_repo, token) => {
				// Both the initial call (with expired token) and potentially without token throw AuthRequired
				if (token === "expired-token" || !token) throw new AuthRequired(401);
				return FETCHED_MANIFEST;
			},
			runDeviceFlow: async () => {
				deviceFlowCalled = true;
				return "refreshed-token";
			},
		});
		await runStartup({}, deps);
		expect(deviceFlowCalled).toBe(true);
	});

	it("calls showFatalError when no cache and network fails even after OAuth", async () => {
		let fatalCalled = false;
		const deps = makeDeps({
			keychainGet: async () => null,
			cacheExists: async () => false,
			fetchManifest: async () => {
				throw new NetworkError("Network unavailable");
			},
			showFatalError: (_msg) => {
				fatalCalled = true;
				throw new Error("__FATAL__");
			},
		});
		try {
			await runStartup({}, deps);
		} catch (err) {
			if ((err as Error).message !== "__FATAL__") throw err;
		}
		expect(fatalCalled).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

describe("return value", () => {
	it("returns ManifestResult with repo and manifest", async () => {
		const deps = makeDeps({
			cacheExists: async () => false,
			fetchManifest: async () => FETCHED_MANIFEST,
		});
		const result = await runStartup(
			{ repo: { owner: "my", name: "repo" } },
			deps,
		);
		expect(result.manifest).toBe(FETCHED_MANIFEST);
		expect(result.repo).toEqual({ owner: "my", name: "repo" });
	});
});

// ---------------------------------------------------------------------------
// Platform detection
// ---------------------------------------------------------------------------

describe("platform detection", () => {
	it("calls detectHost on every startup", async () => {
		let detected = false;
		const deps = makeDeps({
			cacheExists: async () => false,
			detectHost: async () => {
				detected = true;
				return FAKE_HOST;
			},
		});
		await runStartup({}, deps);
		expect(detected).toBe(true);
	});

	it("calls showHostInfo with the detected host", async () => {
		const customHost = { platform: "mac" as const, arch: "arm" as const };
		let shownHost: typeof customHost | undefined;
		const deps = makeDeps({
			cacheExists: async () => false,
			detectHost: async () => customHost,
			showHostInfo: (h) => {
				shownHost = h as typeof customHost;
			},
		});
		await runStartup({}, deps);
		expect(shownHost).toEqual(customHost);
	});

	it("calls showHostInfo before promptCheckUpdates", async () => {
		const order: string[] = [];
		const deps = makeDeps({
			cacheExists: async () => true,
			showHostInfo: () => {
				order.push("showHostInfo");
			},
			promptCheckUpdates: async () => {
				order.push("promptCheckUpdates");
				return false;
			},
		});
		await runStartup({}, deps);
		expect(order.indexOf("showHostInfo")).toBeLessThan(
			order.indexOf("promptCheckUpdates"),
		);
	});

	it("propagates host in ManifestResult (normal flow)", async () => {
		const customHost = {
			platform: "linux" as const,
			arch: "arm" as const,
			distro: "Ubuntu",
			version: "22.04",
		};
		const deps = makeDeps({
			cacheExists: async () => false,
			detectHost: async () => customHost,
		});
		const result = await runStartup({}, deps);
		expect(result.host).toEqual(customHost);
	});

	it("propagates host in ManifestResult (cached flow)", async () => {
		const customHost = { platform: "windows" as const, arch: "x86" as const };
		const deps = makeDeps({
			cacheExists: async () => true,
			promptCheckUpdates: async () => false,
			detectHost: async () => customHost,
		});
		const result = await runStartup({}, deps);
		expect(result.host).toEqual(customHost);
	});

	it("propagates host in ManifestResult (local mode)", async () => {
		const customHost = { platform: "mac" as const, arch: "arm" as const };
		const deps = makeDeps({
			detectHost: async () => customHost,
			readLocalManifest: async () => ({
				manifest: LOCAL_MANIFEST,
				gitRoot: FAKE_GIT_ROOT,
			}),
		});
		const result = await runStartup({ localMode: true }, deps);
		expect(result.host).toEqual(customHost);
	});

	it("calls showHostInfo even in local mode", async () => {
		let hostInfoShown = false;
		const deps = makeDeps({
			showHostInfo: () => {
				hostInfoShown = true;
			},
			readLocalManifest: async () => ({
				manifest: LOCAL_MANIFEST,
				gitRoot: FAKE_GIT_ROOT,
			}),
		});
		await runStartup({ localMode: true }, deps);
		expect(hostInfoShown).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Local mode
// ---------------------------------------------------------------------------

const LOCAL_MANIFEST = "scripts:\n  - id: local-script";
const FAKE_GIT_ROOT = "/home/user/projects/my-repo";

describe("local mode", () => {
	it("calls readLocalManifest and returns its manifest", async () => {
		const deps = makeDeps({
			readLocalManifest: async () => ({
				manifest: LOCAL_MANIFEST,
				gitRoot: FAKE_GIT_ROOT,
			}),
		});
		const result = await runStartup({ localMode: true }, deps);
		expect(result.manifest).toBe(LOCAL_MANIFEST);
	});

	it("returns localRoot from the git root", async () => {
		const deps = makeDeps({
			readLocalManifest: async () => ({
				manifest: LOCAL_MANIFEST,
				gitRoot: FAKE_GIT_ROOT,
			}),
		});
		const result = await runStartup({ localMode: true }, deps);
		expect(result.localRoot).toBe(FAKE_GIT_ROOT);
	});

	it("returns repo sentinel { owner: 'local', name: 'local' }", async () => {
		const deps = makeDeps({
			readLocalManifest: async () => ({
				manifest: LOCAL_MANIFEST,
				gitRoot: FAKE_GIT_ROOT,
			}),
		});
		const result = await runStartup({ localMode: true }, deps);
		expect(result.repo).toEqual({ owner: "local", name: "local" });
	});

	it("does not call fetchManifest", async () => {
		let fetchCalled = false;
		const deps = makeDeps({
			readLocalManifest: async () => ({
				manifest: LOCAL_MANIFEST,
				gitRoot: FAKE_GIT_ROOT,
			}),
			fetchManifest: async () => {
				fetchCalled = true;
				return FETCHED_MANIFEST;
			},
		});
		await runStartup({ localMode: true }, deps);
		expect(fetchCalled).toBe(false);
	});

	it("does not call keychainGet", async () => {
		let keychainCalled = false;
		const deps = makeDeps({
			readLocalManifest: async () => ({
				manifest: LOCAL_MANIFEST,
				gitRoot: FAKE_GIT_ROOT,
			}),
			keychainGet: async () => {
				keychainCalled = true;
				return null;
			},
		});
		await runStartup({ localMode: true }, deps);
		expect(keychainCalled).toBe(false);
	});

	it("does not call promptCheckUpdates", async () => {
		let promptCalled = false;
		const deps = makeDeps({
			readLocalManifest: async () => ({
				manifest: LOCAL_MANIFEST,
				gitRoot: FAKE_GIT_ROOT,
			}),
			promptCheckUpdates: async () => {
				promptCalled = true;
				return true;
			},
		});
		await runStartup({ localMode: true }, deps);
		expect(promptCalled).toBe(false);
	});

	it("does not call readConfig or writeConfig", async () => {
		let readConfigCalled = false;
		let writeConfigCalled = false;
		const deps = makeDeps({
			readLocalManifest: async () => ({
				manifest: LOCAL_MANIFEST,
				gitRoot: FAKE_GIT_ROOT,
			}),
			readConfig: async () => {
				readConfigCalled = true;
				return {};
			},
			writeConfig: async () => {
				writeConfigCalled = true;
			},
		});
		await runStartup({ localMode: true }, deps);
		expect(readConfigCalled).toBe(false);
		expect(writeConfigCalled).toBe(false);
	});

	it("does not call cacheExists or writeCache", async () => {
		let cacheExistsCalled = false;
		let writeCacheCalled = false;
		const deps = makeDeps({
			readLocalManifest: async () => ({
				manifest: LOCAL_MANIFEST,
				gitRoot: FAKE_GIT_ROOT,
			}),
			cacheExists: async () => {
				cacheExistsCalled = true;
				return false;
			},
			writeCache: async () => {
				writeCacheCalled = true;
			},
		});
		await runStartup({ localMode: true }, deps);
		expect(cacheExistsCalled).toBe(false);
		expect(writeCacheCalled).toBe(false);
	});

	it("propagates LocalRepoError from readLocalManifest", async () => {
		const { LocalRepoError } = await import("./localRepo.js");
		const deps = makeDeps({
			readLocalManifest: async () => {
				throw new LocalRepoError("Not in a git repo");
			},
		});
		await expect(runStartup({ localMode: true }, deps)).rejects.toThrow(
			"Not in a git repo",
		);
	});
});
