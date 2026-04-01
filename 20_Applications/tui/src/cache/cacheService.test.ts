import { describe, expect, it } from "bun:test";
import type { Repo } from "../types.js";
import {
	cacheExists,
	promptCacheUpdate,
	readCachedManifest,
	readCachedScript,
	writeCachedManifest,
	writeCachedScript,
} from "./cacheService.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const repo: Repo = { owner: "beolson", name: "Scriptor" };
const otherRepo: Repo = { owner: "acme", name: "tools" };

// ---------------------------------------------------------------------------
// cacheExists
// ---------------------------------------------------------------------------

describe("cacheExists", () => {
	it("returns true when existsFn returns true for the manifest path", async () => {
		const result = await cacheExists(repo, {
			existsFn: async () => true,
		});
		expect(result).toBe(true);
	});

	it("returns false when existsFn returns false", async () => {
		const result = await cacheExists(repo, {
			existsFn: async () => false,
		});
		expect(result).toBe(false);
	});

	it("calls existsFn with a path containing repo owner and name", async () => {
		let capturedPath = "";
		await cacheExists(repo, {
			existsFn: async (path) => {
				capturedPath = path;
				return false;
			},
		});
		expect(capturedPath).toContain("beolson");
		expect(capturedPath).toContain("Scriptor");
	});

	it("calls existsFn with a path ending in manifest.yaml", async () => {
		let capturedPath = "";
		await cacheExists(repo, {
			existsFn: async (path) => {
				capturedPath = path;
				return false;
			},
		});
		expect(capturedPath).toEndWith("manifest.yaml");
	});
});

// ---------------------------------------------------------------------------
// readCachedManifest
// ---------------------------------------------------------------------------

describe("readCachedManifest", () => {
	it("returns content when readFileFn resolves", async () => {
		const result = await readCachedManifest(repo, {
			readFileFn: async () => "manifest content",
		});
		expect(result).toBe("manifest content");
	});

	it("returns undefined when readFileFn throws", async () => {
		const result = await readCachedManifest(repo, {
			readFileFn: async () => {
				throw new Error("ENOENT");
			},
		});
		expect(result).toBeUndefined();
	});

	it("calls readFileFn with the correct path (owner/name/manifest.yaml)", async () => {
		let capturedPath = "";
		await readCachedManifest(repo, {
			readFileFn: async (path) => {
				capturedPath = path;
				return "";
			},
		});
		expect(capturedPath).toContain("beolson");
		expect(capturedPath).toContain("Scriptor");
		expect(capturedPath).toEndWith("manifest.yaml");
	});
});

// ---------------------------------------------------------------------------
// writeCachedManifest
// ---------------------------------------------------------------------------

describe("writeCachedManifest", () => {
	it("calls writeFileFn with the correct path and content", async () => {
		let capturedPath = "";
		let capturedContent = "";
		await writeCachedManifest(repo, "the manifest", {
			writeFileFn: async (path, content) => {
				capturedPath = path;
				capturedContent = content;
			},
		});
		expect(capturedPath).toContain("beolson");
		expect(capturedPath).toContain("Scriptor");
		expect(capturedPath).toEndWith("manifest.yaml");
		expect(capturedContent).toBe("the manifest");
	});
});

// ---------------------------------------------------------------------------
// readCachedScript
// ---------------------------------------------------------------------------

describe("readCachedScript", () => {
	it("returns content when readFileFn resolves", async () => {
		const result = await readCachedScript(
			repo,
			"scripts/Debian/13/install-bun.sh",
			{
				readFileFn: async () => "#!/bin/bash\necho hi",
			},
		);
		expect(result).toBe("#!/bin/bash\necho hi");
	});

	it("returns undefined when readFileFn throws", async () => {
		const result = await readCachedScript(
			repo,
			"scripts/Debian/13/missing.sh",
			{
				readFileFn: async () => {
					throw new Error("ENOENT");
				},
			},
		);
		expect(result).toBeUndefined();
	});

	it("uses scriptPath verbatim as sub-path under cache root", async () => {
		let capturedPath = "";
		const scriptPath = "scripts/Debian/13/install-bun.sh";
		await readCachedScript(repo, scriptPath, {
			readFileFn: async (path) => {
				capturedPath = path;
				return "";
			},
		});
		expect(capturedPath).toContain("beolson");
		expect(capturedPath).toContain("Scriptor");
		expect(capturedPath).toEndWith(scriptPath);
	});
});

// ---------------------------------------------------------------------------
// writeCachedScript
// ---------------------------------------------------------------------------

describe("writeCachedScript", () => {
	it("writes to the same path that readCachedScript would read", async () => {
		let writtenPath = "";
		let readPath = "";
		const scriptPath = "scripts/Debian/13/install-bun.sh";

		await writeCachedScript(repo, scriptPath, "content", {
			writeFileFn: async (path) => {
				writtenPath = path;
			},
		});
		await readCachedScript(repo, scriptPath, {
			readFileFn: async (path) => {
				readPath = path;
				return "";
			},
		});
		expect(writtenPath).toBe(readPath);
	});

	it("calls writeFileFn with content", async () => {
		let capturedContent = "";
		await writeCachedScript(repo, "scripts/mac/setup.sh", "script content", {
			writeFileFn: async (_path, content) => {
				capturedContent = content;
			},
		});
		expect(capturedContent).toBe("script content");
	});

	it("uses scriptPath verbatim as sub-path under cache root", async () => {
		let capturedPath = "";
		const scriptPath = "scripts/windows/setup.ps1";
		await writeCachedScript(repo, scriptPath, "code", {
			writeFileFn: async (path) => {
				capturedPath = path;
			},
		});
		expect(capturedPath).toContain("beolson");
		expect(capturedPath).toContain("Scriptor");
		expect(capturedPath).toEndWith(scriptPath);
	});
});

// ---------------------------------------------------------------------------
// promptCacheUpdate
// ---------------------------------------------------------------------------

describe("promptCacheUpdate", () => {
	it("calls confirmFn with the exact message 'Cache found. Check for updates?'", async () => {
		let capturedMessage = "";
		await promptCacheUpdate({
			confirmFn: async (message) => {
				capturedMessage = message;
				return false;
			},
		});
		expect(capturedMessage).toBe("Cache found. Check for updates?");
	});

	it("returns true when confirmFn returns true", async () => {
		const result = await promptCacheUpdate({
			confirmFn: async () => true,
		});
		expect(result).toBe(true);
	});

	it("returns false when confirmFn returns false", async () => {
		const result = await promptCacheUpdate({
			confirmFn: async () => false,
		});
		expect(result).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Cache root isolation
// ---------------------------------------------------------------------------

describe("cache root", () => {
	it("two different Repo values produce different cache roots", async () => {
		let pathForRepo = "";
		let pathForOther = "";

		await cacheExists(repo, {
			existsFn: async (path) => {
				pathForRepo = path;
				return false;
			},
		});
		await cacheExists(otherRepo, {
			existsFn: async (path) => {
				pathForOther = path;
				return false;
			},
		});
		expect(pathForRepo).not.toBe(pathForOther);
	});

	it("cache root includes repo.owner and repo.name as path segments", async () => {
		let capturedPath = "";
		await cacheExists(
			{ owner: "org", name: "proj" },
			{
				existsFn: async (path) => {
					capturedPath = path;
					return false;
				},
			},
		);
		// path segments: .../cache/org/proj/manifest.yaml
		expect(capturedPath).toContain("/org/");
		expect(capturedPath).toContain("/proj/");
	});
});
