import { describe, expect, it } from "bun:test";
import type { Repo } from "../repo/types.js";
import type { CacheDeps } from "./cacheService.js";
import { cacheExists, readManifest, writeCache } from "./cacheService.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const REPO: Repo = { owner: "acme", name: "scripts" };

/**
 * Build a fake filesystem from an initial file map.
 * Tracks mkdir calls so we can assert directory creation.
 */
function makeFakeFs(
	files: Map<string, string>,
): CacheDeps & { mkdirCalls: string[] } {
	const mkdirCalls: string[] = [];

	return {
		mkdirCalls,
		fileExists: async (path: string) => files.has(path),
		readFile: async (path: string) => {
			const content = files.get(path);
			if (content === undefined) {
				const err = new Error(
					`ENOENT: no such file: ${path}`,
				) as NodeJS.ErrnoException;
				err.code = "ENOENT";
				throw err;
			}
			return content;
		},
		writeFile: async (path: string, content: string) => {
			files.set(path, content);
		},
		mkdir: async (path: string) => {
			mkdirCalls.push(path);
		},
	};
}

// ---------------------------------------------------------------------------
// cacheExists
// ---------------------------------------------------------------------------

describe("cacheExists", () => {
	it("returns false when manifest file does not exist", async () => {
		const fs = makeFakeFs(new Map());
		const result = await cacheExists(REPO, fs);
		expect(result).toBe(false);
	});

	it("returns true when manifest file exists at the expected path", async () => {
		const files = new Map([
			[
				`${process.env.HOME ?? "~"}/.scriptor/cache/acme/scripts/manifest.yaml`,
				"scripts: []",
			],
		]);
		const fs = makeFakeFs(files);
		const result = await cacheExists(REPO, fs);
		expect(result).toBe(true);
	});

	it("returns false for a different repo when only one repo is cached", async () => {
		const files = new Map([
			[
				`${process.env.HOME ?? "~"}/.scriptor/cache/acme/scripts/manifest.yaml`,
				"scripts: []",
			],
		]);
		const fs = makeFakeFs(files);
		const otherRepo: Repo = { owner: "other", name: "repo" };
		const result = await cacheExists(otherRepo, fs);
		expect(result).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// readManifest
// ---------------------------------------------------------------------------

describe("readManifest", () => {
	it("returns the raw YAML string from the cache", async () => {
		const manifestContent =
			"scripts:\n  - id: test\n    platform: linux\n    arch: x86\n";
		const files = new Map([
			[
				`${process.env.HOME ?? "~"}/.scriptor/cache/acme/scripts/manifest.yaml`,
				manifestContent,
			],
		]);
		const fs = makeFakeFs(files);
		const result = await readManifest(REPO, fs);
		expect(result).toBe(manifestContent);
	});

	it("throws when manifest file does not exist", async () => {
		const fs = makeFakeFs(new Map());
		await expect(readManifest(REPO, fs)).rejects.toThrow();
	});
});

// ---------------------------------------------------------------------------
// writeCache
// ---------------------------------------------------------------------------

describe("writeCache", () => {
	it("writes manifest.yaml to the correct path", async () => {
		const files = new Map<string, string>();
		const fs = makeFakeFs(files);
		const manifestContent = "scripts: []";

		await writeCache(REPO, manifestContent, new Map(), fs);

		const expectedPath = `${process.env.HOME ?? "~"}/.scriptor/cache/acme/scripts/manifest.yaml`;
		expect(files.has(expectedPath)).toBe(true);
		expect(files.get(expectedPath)).toBe(manifestContent);
	});

	it("writes each script file at the expected path under scripts/", async () => {
		const files = new Map<string, string>();
		const fs = makeFakeFs(files);
		const scripts = new Map([
			["linux/ubuntu/install-git.sh", "#!/bin/bash\napt-get install -y git"],
			["windows/setup.ps1", "Write-Host 'setup'"],
		]);

		await writeCache(REPO, "scripts: []", scripts, fs);

		const base = `${process.env.HOME ?? "~"}/.scriptor/cache/acme/scripts`;
		expect(files.get(`${base}/scripts/linux/ubuntu/install-git.sh`)).toBe(
			"#!/bin/bash\napt-get install -y git",
		);
		expect(files.get(`${base}/scripts/windows/setup.ps1`)).toBe(
			"Write-Host 'setup'",
		);
	});

	it("creates the cache directory before writing", async () => {
		const files = new Map<string, string>();
		const fs = makeFakeFs(files);

		await writeCache(REPO, "scripts: []", new Map(), fs);

		expect(fs.mkdirCalls.length).toBeGreaterThan(0);
	});

	it("creates subdirectories for each script path", async () => {
		const files = new Map<string, string>();
		const fs = makeFakeFs(files);
		const scripts = new Map([["linux/ubuntu/install-git.sh", "#!/bin/bash"]]);

		await writeCache(REPO, "scripts: []", scripts, fs);

		// At least one mkdir call should contain a path with "scripts/linux/ubuntu"
		const hasSubdirCall = fs.mkdirCalls.some((p) =>
			p.includes("scripts/linux/ubuntu"),
		);
		expect(hasSubdirCall).toBe(true);
	});

	it("writes all script files including those with nested paths", async () => {
		const files = new Map<string, string>();
		const fs = makeFakeFs(files);
		const scripts = new Map([
			["mac/arm/brew-setup.sh", "#!/bin/bash\nbrew install"],
			["linux/debian/update.sh", "#!/bin/bash\napt update"],
			["linux/ubuntu/22.04/git.sh", "#!/bin/bash\napt install git"],
		]);

		await writeCache(REPO, "scripts: []", scripts, fs);

		const base = `${process.env.HOME ?? "~"}/.scriptor/cache/acme/scripts/scripts`;
		expect(files.has(`${base}/mac/arm/brew-setup.sh`)).toBe(true);
		expect(files.has(`${base}/linux/debian/update.sh`)).toBe(true);
		expect(files.has(`${base}/linux/ubuntu/22.04/git.sh`)).toBe(true);
	});

	it("handles empty scripts map (manifest only)", async () => {
		const files = new Map<string, string>();
		const fs = makeFakeFs(files);

		await expect(
			writeCache(REPO, "scripts: []", new Map(), fs),
		).resolves.toBeUndefined();

		const expectedPath = `${process.env.HOME ?? "~"}/.scriptor/cache/acme/scripts/manifest.yaml`;
		expect(files.has(expectedPath)).toBe(true);
	});
});
