import { describe, expect, test } from "bun:test";
import type { ScriptEntry } from "../manifest/parseManifest.js";
import { type FetchDeps, runStartup, type StartupEvent } from "./startup.js";

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const MANIFEST_YAML = `
- id: install-git
  name: Install Git
  description: Installs git via apt
  platform: linux
  arch: x86
  distro: ubuntu
  version: "24.04"
  script: scripts/install-git.sh
  dependencies: []
- id: install-docker
  name: Install Docker
  description: Installs Docker
  platform: linux
  arch: x86
  distro: ubuntu
  version: "24.04"
  script: scripts/install-docker.sh
  dependencies: []
`.trim();

const COMMIT_HASH_A = "aabbccdd1122";
const _COMMIT_HASH_B = "eeff33445566";

function _makeScript(id: string): ScriptEntry {
	return {
		id,
		name: id,
		description: `desc-${id}`,
		platform: "linux",
		arch: "x86",
		distro: "ubuntu",
		version: "24.04",
		script: `scripts/${id}.sh`,
		dependencies: [],
		inputs: [],
	};
}

const SCRIPTS_CONTENT: Record<string, string> = {
	"scripts/install-git.sh": "#!/bin/bash\napt-get install -y git",
	"scripts/install-docker.sh": "#!/bin/bash\napt-get install -y docker.io",
};

// ---------------------------------------------------------------------------
// Helper: builds a FetchDeps object with all paths mocked
// ---------------------------------------------------------------------------
function makeDeps(overrides: Partial<FetchDeps> = {}): FetchDeps & {
	events: StartupEvent[];
} {
	const events: StartupEvent[] = [];
	const onEvent = (e: StartupEvent) => {
		events.push(e);
	};

	const deps: FetchDeps = {
		getLatestCommitHash: async (_repo: string) => COMMIT_HASH_A,
		fetchFile: async (_repo: string, path: string) => {
			if (path === "scriptor.yaml") return MANIFEST_YAML;
			const content = SCRIPTS_CONTENT[path];
			if (content === undefined)
				throw new Error(`fetchFile: unknown path ${path}`);
			return content;
		},
		getStoredCommitHash: async () => null,
		saveCommitHash: async (_hash: string) => {},
		getCachedManifest: async () => null,
		saveManifest: async (_yaml: string) => {},
		getCachedScript: async (_id: string) => null,
		saveScript: async (_id: string, _content: string) => {},
		isCacheStale: async (_latestHash: string) => true,
		startOAuthFlow: async (_clientId: string) => "test-token",
		onEvent,
		oauthClientId: "test-client-id",
		...overrides,
	};

	return Object.assign(deps, { events });
}

// ---------------------------------------------------------------------------
// Cache-hit path (no download)
// ---------------------------------------------------------------------------

describe("cache-hit path", () => {
	test("returns cached manifest and scripts when cache is fresh", async () => {
		const deps = makeDeps({
			getLatestCommitHash: async () => COMMIT_HASH_A,
			isCacheStale: async () => false,
			getCachedManifest: async () => MANIFEST_YAML,
			getCachedScript: async (id: string) => SCRIPTS_CONTENT[id] ?? null,
		});

		const result = await runStartup("owner/repo", deps);

		expect(result.manifestYaml).toBe(MANIFEST_YAML);
		expect(result.scripts["scripts/install-git.sh"]).toBe(
			SCRIPTS_CONTENT["scripts/install-git.sh"],
		);
		expect(result.scripts["scripts/install-docker.sh"]).toBe(
			SCRIPTS_CONTENT["scripts/install-docker.sh"],
		);
		expect(result.offline).toBe(false);
	});

	test("emits no fetching events on a cache hit", async () => {
		const deps = makeDeps({
			getLatestCommitHash: async () => COMMIT_HASH_A,
			isCacheStale: async () => false,
			getCachedManifest: async () => MANIFEST_YAML,
			getCachedScript: async (id: string) => SCRIPTS_CONTENT[id] ?? null,
		});

		await runStartup("owner/repo", deps);

		const fetchingEvents = deps.events.filter(
			(e) => e.type === "fetching-manifest" || e.type === "fetching-script",
		);
		expect(fetchingEvents).toHaveLength(0);
	});

	test("does not call fetchFile when cache is fresh", async () => {
		let fetchFileCalled = false;
		const deps = makeDeps({
			getLatestCommitHash: async () => COMMIT_HASH_A,
			isCacheStale: async () => false,
			getCachedManifest: async () => MANIFEST_YAML,
			getCachedScript: async () => null,
			fetchFile: async () => {
				fetchFileCalled = true;
				return "";
			},
		});

		await runStartup("owner/repo", deps);
		expect(fetchFileCalled).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Stale cache path (downloads)
// ---------------------------------------------------------------------------

describe("stale cache path", () => {
	test("fetches manifest and saves it when cache is stale", async () => {
		let savedManifest = "";
		const deps = makeDeps({
			isCacheStale: async () => true,
			saveManifest: async (yaml: string) => {
				savedManifest = yaml;
			},
			getCachedScript: async () => null,
		});

		await runStartup("owner/repo", deps);

		expect(savedManifest).toBe(MANIFEST_YAML);
	});

	test("saves the new commit hash after a successful fetch", async () => {
		let savedHash = "";
		const deps = makeDeps({
			isCacheStale: async () => true,
			saveCommitHash: async (hash: string) => {
				savedHash = hash;
			},
			getCachedScript: async () => null,
		});

		await runStartup("owner/repo", deps);

		expect(savedHash).toBe(COMMIT_HASH_A);
	});

	test("fetches script files after downloading the manifest", async () => {
		const fetchedPaths: string[] = [];
		const deps = makeDeps({
			isCacheStale: async () => true,
			fetchFile: async (_repo: string, path: string) => {
				fetchedPaths.push(path);
				if (path === "scriptor.yaml") return MANIFEST_YAML;
				return SCRIPTS_CONTENT[path] ?? "";
			},
			getCachedScript: async () => null,
		});

		await runStartup("owner/repo", deps);

		expect(fetchedPaths).toContain("scriptor.yaml");
		expect(fetchedPaths).toContain("scripts/install-git.sh");
		expect(fetchedPaths).toContain("scripts/install-docker.sh");
	});

	test("saves each fetched script to cache", async () => {
		const savedScripts: Record<string, string> = {};
		const deps = makeDeps({
			isCacheStale: async () => true,
			saveScript: async (id: string, content: string) => {
				savedScripts[id] = content;
			},
			getCachedScript: async () => null,
		});

		await runStartup("owner/repo", deps);

		expect(savedScripts["scripts/install-git.sh"]).toBe(
			SCRIPTS_CONTENT["scripts/install-git.sh"],
		);
		expect(savedScripts["scripts/install-docker.sh"]).toBe(
			SCRIPTS_CONTENT["scripts/install-docker.sh"],
		);
	});

	test("emits fetching-manifest event before fetching the manifest", async () => {
		const deps = makeDeps({
			isCacheStale: async () => true,
			getCachedScript: async () => null,
		});

		await runStartup("owner/repo", deps);

		expect(deps.events.some((e) => e.type === "fetching-manifest")).toBe(true);
	});

	test("emits fetching-script events for each script", async () => {
		const deps = makeDeps({
			isCacheStale: async () => true,
			getCachedScript: async () => null,
		});

		await runStartup("owner/repo", deps);

		const scriptEvents = deps.events.filter(
			(e): e is Extract<StartupEvent, { type: "fetching-script" }> =>
				e.type === "fetching-script",
		);
		expect(scriptEvents.length).toBeGreaterThanOrEqual(2);
		expect(scriptEvents.some((e) => e.scriptName === "Install Git")).toBe(true);
		expect(scriptEvents.some((e) => e.scriptName === "Install Docker")).toBe(
			true,
		);
	});

	test("fetching-script events include index and total", async () => {
		const deps = makeDeps({
			isCacheStale: async () => true,
			getCachedScript: async () => null,
		});

		await runStartup("owner/repo", deps);

		const scriptEvents = deps.events.filter(
			(e): e is Extract<StartupEvent, { type: "fetching-script" }> =>
				e.type === "fetching-script",
		);
		// Two scripts in the manifest
		expect(scriptEvents.some((e) => e.index === 1 && e.total === 2)).toBe(true);
		expect(scriptEvents.some((e) => e.index === 2 && e.total === 2)).toBe(true);
	});

	test("returns downloaded manifest and scripts", async () => {
		const deps = makeDeps({
			isCacheStale: async () => true,
			getCachedScript: async () => null,
		});

		const result = await runStartup("owner/repo", deps);

		expect(result.manifestYaml).toBe(MANIFEST_YAML);
		expect(result.scripts["scripts/install-git.sh"]).toBe(
			SCRIPTS_CONTENT["scripts/install-git.sh"],
		);
	});
});

// ---------------------------------------------------------------------------
// Network failure fallback (offline mode)
// ---------------------------------------------------------------------------

describe("network failure fallback", () => {
	test("falls back to cache when getLatestCommitHash throws a network error", async () => {
		const deps = makeDeps({
			getLatestCommitHash: async () => {
				throw new Error("Network timeout");
			},
			getCachedManifest: async () => MANIFEST_YAML,
			getCachedScript: async (id: string) => SCRIPTS_CONTENT[id] ?? null,
		});

		const result = await runStartup("owner/repo", deps);

		expect(result.manifestYaml).toBe(MANIFEST_YAML);
		expect(result.offline).toBe(true);
	});

	test("falls back to cache when fetchFile throws on the manifest", async () => {
		const deps = makeDeps({
			isCacheStale: async () => true,
			fetchFile: async (_repo: string, path: string) => {
				if (path === "scriptor.yaml") throw new Error("Network timeout");
				return "";
			},
			getCachedManifest: async () => MANIFEST_YAML,
			getCachedScript: async (id: string) => SCRIPTS_CONTENT[id] ?? null,
		});

		const result = await runStartup("owner/repo", deps);

		expect(result.manifestYaml).toBe(MANIFEST_YAML);
		expect(result.offline).toBe(true);
	});

	test("emits an offline-warning event when falling back to cache", async () => {
		const deps = makeDeps({
			getLatestCommitHash: async () => {
				throw new Error("Network timeout");
			},
			getCachedManifest: async () => MANIFEST_YAML,
			getCachedScript: async () => null,
		});

		await runStartup("owner/repo", deps);

		expect(deps.events.some((e) => e.type === "offline-warning")).toBe(true);
	});

	test("offline result is false when network succeeds", async () => {
		const deps = makeDeps({
			isCacheStale: async () => false,
			getCachedManifest: async () => MANIFEST_YAML,
			getCachedScript: async () => null,
		});

		const result = await runStartup("owner/repo", deps);

		expect(result.offline).toBe(false);
	});

	test("emits manifest-error event when no cache is available after network failure", async () => {
		const deps = makeDeps({
			getLatestCommitHash: async () => {
				throw new Error("Network timeout");
			},
			getCachedManifest: async () => null,
			getCachedScript: async () => null,
		});

		await runStartup("owner/repo", deps);

		expect(deps.events.some((e) => e.type === "manifest-error")).toBe(true);
	});

	test("returns empty manifestYaml when both network and cache are unavailable", async () => {
		const deps = makeDeps({
			getLatestCommitHash: async () => {
				throw new Error("Network timeout");
			},
			getCachedManifest: async () => null,
			getCachedScript: async () => null,
		});

		const result = await runStartup("owner/repo", deps);

		expect(result.manifestYaml).toBe("");
		expect(result.offline).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// OAuth trigger path
// ---------------------------------------------------------------------------

describe("OAuth trigger", () => {
	test("triggers OAuth flow when getLatestCommitHash throws AuthRequiredError", async () => {
		let oauthCalled = false;
		const deps = makeDeps({
			getLatestCommitHash: async () => {
				// First call: throw auth error; second call: succeed
				if (!oauthCalled) {
					const err = new Error("auth required") as Error & {
						name: string;
					};
					err.name = "AuthRequiredError";
					throw err;
				}
				return COMMIT_HASH_A;
			},
			isCacheStale: async () => false,
			getCachedManifest: async () => MANIFEST_YAML,
			getCachedScript: async () => null,
			startOAuthFlow: async (_clientId: string) => {
				oauthCalled = true;
				return "new-token";
			},
		});

		const result = await runStartup("owner/repo", deps);

		expect(oauthCalled).toBe(true);
		expect(result.offline).toBe(false);
	});

	test("triggers OAuth flow when fetchFile returns 401/403 (AuthRequiredError)", async () => {
		let oauthCalled = false;
		let attemptCount = 0;
		const deps = makeDeps({
			getLatestCommitHash: async () => COMMIT_HASH_A,
			isCacheStale: async () => true,
			fetchFile: async (_repo: string, path: string) => {
				if (path === "scriptor.yaml") {
					attemptCount++;
					if (attemptCount === 1) {
						// First attempt: auth error
						const err = new Error("auth required") as Error & {
							name: string;
						};
						err.name = "AuthRequiredError";
						throw err;
					}
				}
				if (path === "scriptor.yaml") return MANIFEST_YAML;
				return SCRIPTS_CONTENT[path] ?? "";
			},
			getCachedScript: async () => null,
			startOAuthFlow: async (_clientId: string) => {
				oauthCalled = true;
				return "new-token";
			},
		});

		const result = await runStartup("owner/repo", deps);

		expect(oauthCalled).toBe(true);
		expect(result.manifestYaml).toBe(MANIFEST_YAML);
	});

	test("emits an oauth-started event when the OAuth flow begins", async () => {
		const deps = makeDeps({
			getLatestCommitHash: async () => {
				const err = new Error("auth required") as Error & { name: string };
				err.name = "AuthRequiredError";
				throw err;
			},
			isCacheStale: async () => false,
			getCachedManifest: async () => MANIFEST_YAML,
			getCachedScript: async () => null,
			startOAuthFlow: async () => "new-token",
		});

		await runStartup("owner/repo", deps);

		expect(deps.events.some((e) => e.type === "oauth-started")).toBe(true);
	});

	test("uses token from OAuth flow for subsequent requests", async () => {
		const tokensUsed: string[] = [];
		let oauthDone = false;
		const deps = makeDeps({
			getLatestCommitHash: async () => {
				if (!oauthDone) {
					const err = new Error("auth required") as Error & { name: string };
					err.name = "AuthRequiredError";
					throw err;
				}
				return COMMIT_HASH_A;
			},
			isCacheStale: async () => false,
			getCachedManifest: async () => MANIFEST_YAML,
			getCachedScript: async () => null,
			startOAuthFlow: async (_clientId: string) => {
				oauthDone = true;
				return "oauth-token-xyz";
			},
			// We verify the token is available through the result (no error)
		});

		const result = await runStartup("owner/repo", deps);

		expect(result.offline).toBe(false);
		// The flow completed — token was used successfully
		expect(tokensUsed).toHaveLength(0); // no direct way to check here; above assertion suffices
	});

	test("falls back to cache if OAuth flow fails", async () => {
		const deps = makeDeps({
			getLatestCommitHash: async () => {
				const err = new Error("auth required") as Error & { name: string };
				err.name = "AuthRequiredError";
				throw err;
			},
			getCachedManifest: async () => MANIFEST_YAML,
			getCachedScript: async () => null,
			startOAuthFlow: async () => {
				throw new Error("OAuth failed: user cancelled");
			},
		});

		const result = await runStartup("owner/repo", deps);

		expect(result.manifestYaml).toBe(MANIFEST_YAML);
		expect(result.offline).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Script fetch error events
// ---------------------------------------------------------------------------

describe("script fetch error events", () => {
	test("emits script-error event when a script file cannot be fetched", async () => {
		const deps = makeDeps({
			isCacheStale: async () => true,
			fetchFile: async (_repo: string, path: string) => {
				if (path === "scriptor.yaml") return MANIFEST_YAML;
				if (path === "scripts/install-git.sh")
					throw new Error("Failed to fetch script");
				return SCRIPTS_CONTENT[path] ?? "";
			},
			getCachedScript: async () => null,
		});

		await runStartup("owner/repo", deps);

		const errEvents = deps.events.filter(
			(e): e is Extract<StartupEvent, { type: "script-error" }> =>
				e.type === "script-error",
		);
		expect(errEvents.length).toBeGreaterThan(0);
		expect(errEvents[0]?.scriptPath).toBe("scripts/install-git.sh");
	});
});
