import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CacheService } from "./cacheService";

let testDir: string;
let cache: CacheService;

beforeEach(() => {
	testDir = join(tmpdir(), `scriptor-cache-test-${Date.now()}`);
	mkdirSync(testDir, { recursive: true });
	cache = new CacheService(testDir);
});

afterEach(() => {
	rmSync(testDir, { recursive: true, force: true });
});

describe("getStoredCommitHash", () => {
	test("returns null when no commit hash is stored", async () => {
		const hash = await cache.getStoredCommitHash();

		expect(hash).toBeNull();
	});

	test("returns the stored hash string after saving", async () => {
		await cache.saveCommitHash("abc123def456");

		const hash = await cache.getStoredCommitHash();

		expect(hash).toBe("abc123def456");
	});

	test("returns null when cache directory does not exist yet", async () => {
		const freshCache = new CacheService(join(testDir, "nonexistent"));

		const hash = await freshCache.getStoredCommitHash();

		expect(hash).toBeNull();
	});
});

describe("saveCommitHash", () => {
	test("creates cache directory if it does not exist", async () => {
		const newBase = join(testDir, "new-base");
		const freshCache = new CacheService(newBase);

		await freshCache.saveCommitHash("deadbeef");

		const hash = await freshCache.getStoredCommitHash();
		expect(hash).toBe("deadbeef");
	});

	test("overwrites previously stored hash", async () => {
		await cache.saveCommitHash("first-hash");
		await cache.saveCommitHash("second-hash");

		const hash = await cache.getStoredCommitHash();

		expect(hash).toBe("second-hash");
	});
});

describe("getCachedManifest", () => {
	test("returns null when no manifest is cached", async () => {
		const manifest = await cache.getCachedManifest();

		expect(manifest).toBeNull();
	});

	test("returns the cached manifest YAML string after saving", async () => {
		const yaml = "scripts:\n  - id: setup\n    platform: linux\n";

		await cache.saveManifest(yaml);
		const result = await cache.getCachedManifest();

		expect(result).toBe(yaml);
	});
});

describe("saveManifest", () => {
	test("creates cache directory if it does not exist", async () => {
		const newBase = join(testDir, "manifest-base");
		const freshCache = new CacheService(newBase);

		await freshCache.saveManifest("- id: test\n");

		const result = await freshCache.getCachedManifest();
		expect(result).toBe("- id: test\n");
	});

	test("overwrites previously cached manifest", async () => {
		await cache.saveManifest("old: manifest\n");
		await cache.saveManifest("new: manifest\n");

		const result = await cache.getCachedManifest();

		expect(result).toBe("new: manifest\n");
	});
});

describe("getCachedScript", () => {
	test("returns null when script is not cached", async () => {
		const content = await cache.getCachedScript("setup");

		expect(content).toBeNull();
	});

	test("returns the cached script content after saving", async () => {
		const scriptContent = "#!/bin/bash\napt-get update\n";

		await cache.saveScript("setup", scriptContent);
		const result = await cache.getCachedScript("setup");

		expect(result).toBe(scriptContent);
	});

	test("returns null for a different script id", async () => {
		await cache.saveScript("setup", "#!/bin/bash\necho setup\n");

		const result = await cache.getCachedScript("teardown");

		expect(result).toBeNull();
	});
});

describe("saveScript", () => {
	test("creates cache directory if it does not exist", async () => {
		const newBase = join(testDir, "script-base");
		const freshCache = new CacheService(newBase);

		await freshCache.saveScript("install", "#!/bin/bash\necho install\n");

		const result = await freshCache.getCachedScript("install");
		expect(result).toBe("#!/bin/bash\necho install\n");
	});

	test("overwrites previously cached script content", async () => {
		await cache.saveScript("deploy", "old content\n");
		await cache.saveScript("deploy", "new content\n");

		const result = await cache.getCachedScript("deploy");

		expect(result).toBe("new content\n");
	});

	test("stores multiple scripts independently", async () => {
		await cache.saveScript("alpha", "alpha script\n");
		await cache.saveScript("beta", "beta script\n");

		const alpha = await cache.getCachedScript("alpha");
		const beta = await cache.getCachedScript("beta");

		expect(alpha).toBe("alpha script\n");
		expect(beta).toBe("beta script\n");
	});
});

describe("isCacheStale", () => {
	test("returns true when no commit hash is stored", async () => {
		const stale = await cache.isCacheStale("latest-hash");

		expect(stale).toBe(true);
	});

	test("returns true when stored hash differs from latest", async () => {
		await cache.saveCommitHash("old-hash");

		const stale = await cache.isCacheStale("new-hash");

		expect(stale).toBe(true);
	});

	test("returns false when stored hash matches latest", async () => {
		await cache.saveCommitHash("current-hash");

		const stale = await cache.isCacheStale("current-hash");

		expect(stale).toBe(false);
	});

	test("returns true after hash is updated to a new value", async () => {
		await cache.saveCommitHash("v1");
		await cache.saveCommitHash("v2");

		const staleV1 = await cache.isCacheStale("v1");
		const staleV2 = await cache.isCacheStale("v2");

		expect(staleV1).toBe(true);
		expect(staleV2).toBe(false);
	});
});
