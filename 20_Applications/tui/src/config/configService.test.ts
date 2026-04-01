import { describe, expect, it } from "bun:test";
import { DEFAULT_REPO } from "../config.js";
import { readConfig, resolveRepo, writeConfig } from "./configService.js";

// ---------------------------------------------------------------------------
// readConfig
// ---------------------------------------------------------------------------

describe("readConfig", () => {
	it("returns { repo } when file contains valid YAML with a repo field", async () => {
		const result = await readConfig({
			readFileFn: async () => "repo: beolson/my-scripts\n",
		});
		expect(result.repo).toBe("beolson/my-scripts");
	});

	it("returns {} when readFileFn throws (missing file)", async () => {
		const result = await readConfig({
			readFileFn: async () => {
				throw new Error("ENOENT");
			},
		});
		expect(result).toEqual({});
	});

	it("returns {} when YAML is invalid", async () => {
		const result = await readConfig({
			readFileFn: async () => "key: : bad yaml :::",
		});
		expect(result).toEqual({});
	});

	it("returns {} when YAML is valid but repo field is absent (Zod strips unknown fields only, repo optional)", async () => {
		const result = await readConfig({
			readFileFn: async () => "something: else\n",
		});
		expect(result).toEqual({});
	});

	it("strips unknown fields from YAML (Zod strict optional passthrough)", async () => {
		const result = await readConfig({
			readFileFn: async () => "repo: beolson/scripts\nextra_field: ignored\n",
		});
		expect(result.repo).toBe("beolson/scripts");
		expect((result as Record<string, unknown>).extra_field).toBeUndefined();
	});

	it("returns {} when file is empty string", async () => {
		const result = await readConfig({
			readFileFn: async () => "",
		});
		expect(result).toEqual({});
	});
});

// ---------------------------------------------------------------------------
// writeConfig
// ---------------------------------------------------------------------------

describe("writeConfig", () => {
	it("calls writeFileFn with a valid YAML string", async () => {
		let capturedPath = "";
		let capturedContent = "";

		await writeConfig(
			{ repo: "beolson/my-scripts" },
			{
				writeFileFn: async (path, content) => {
					capturedPath = path;
					capturedContent = content;
				},
			},
		);

		expect(capturedPath).toContain(".scriptor");
		expect(capturedContent).toContain("beolson/my-scripts");
	});

	it("writes content that round-trips back to the same config via readConfig", async () => {
		let stored = "";

		await writeConfig(
			{ repo: "beolson/round-trip" },
			{
				writeFileFn: async (_path, content) => {
					stored = content;
				},
			},
		);

		const result = await readConfig({
			readFileFn: async () => stored,
		});
		expect(result.repo).toBe("beolson/round-trip");
	});
});

// ---------------------------------------------------------------------------
// resolveRepo
// ---------------------------------------------------------------------------

describe("resolveRepo", () => {
	it("returns DEFAULT_REPO when no config and cliRepo is DEFAULT_REPO", async () => {
		const result = await resolveRepo(DEFAULT_REPO, {
			readFileFn: async () => {
				throw new Error("ENOENT");
			},
			writeFileFn: async () => {},
			confirmFn: async () => {
				throw new Error("confirm should not be called");
			},
		});
		expect(result).toBe(DEFAULT_REPO);
	});

	it("returns config repo when cliRepo is DEFAULT_REPO and config has a repo", async () => {
		const result = await resolveRepo(DEFAULT_REPO, {
			readFileFn: async () => "repo: beolson/saved-repo\n",
			writeFileFn: async () => {},
			confirmFn: async () => {
				throw new Error("confirm should not be called");
			},
		});
		expect(result).toBe("beolson/saved-repo");
	});

	it("shows confirm prompt when cliRepo differs from config repo", async () => {
		let confirmCalled = false;
		await resolveRepo("beolson/new-repo", {
			readFileFn: async () => "repo: beolson/old-repo\n",
			writeFileFn: async () => {},
			confirmFn: async (_message) => {
				confirmCalled = true;
				return false;
			},
		});
		expect(confirmCalled).toBe(true);
	});

	it("confirm prompt message contains both cliRepo and config.repo", async () => {
		let capturedMessage = "";
		await resolveRepo("beolson/new-repo", {
			readFileFn: async () => "repo: beolson/old-repo\n",
			writeFileFn: async () => {},
			confirmFn: async (message) => {
				capturedMessage = message;
				return false;
			},
		});
		expect(capturedMessage).toContain("beolson/new-repo");
		expect(capturedMessage).toContain("beolson/old-repo");
	});

	it("on confirm → saves cliRepo to config and returns cliRepo", async () => {
		let writtenContent = "";
		const result = await resolveRepo("beolson/new-repo", {
			readFileFn: async () => "repo: beolson/old-repo\n",
			writeFileFn: async (_path, content) => {
				writtenContent = content;
			},
			confirmFn: async () => true,
		});
		expect(result).toBe("beolson/new-repo");
		expect(writtenContent).toContain("beolson/new-repo");
	});

	it("on decline → returns config repo without writing", async () => {
		let writeCalled = false;
		const result = await resolveRepo("beolson/new-repo", {
			readFileFn: async () => "repo: beolson/old-repo\n",
			writeFileFn: async () => {
				writeCalled = true;
			},
			confirmFn: async () => false,
		});
		expect(result).toBe("beolson/old-repo");
		expect(writeCalled).toBe(false);
	});

	it("returns cliRepo directly when config has no repo and cliRepo is non-default", async () => {
		let confirmCalled = false;
		let writeCalled = false;
		const result = await resolveRepo("beolson/non-default", {
			readFileFn: async () => {
				throw new Error("ENOENT");
			},
			writeFileFn: async () => {
				writeCalled = true;
			},
			confirmFn: async () => {
				confirmCalled = true;
				return false;
			},
		});
		expect(result).toBe("beolson/non-default");
		expect(confirmCalled).toBe(false);
		expect(writeCalled).toBe(false);
	});
});
