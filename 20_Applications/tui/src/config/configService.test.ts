import { describe, expect, it } from "bun:test";
import type { ConfigDeps } from "./configService.js";
import { readConfig, writeConfig } from "./configService.js";

// ---------------------------------------------------------------------------
// Fake fs helpers
// ---------------------------------------------------------------------------

function makeFakeFs(
	files: Map<string, string>,
): Pick<ConfigDeps, "readFile" | "writeFile" | "mkdir"> {
	return {
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
		mkdir: async (_path: string) => {
			// no-op — directory always created successfully
		},
	};
}

// ---------------------------------------------------------------------------
// readConfig tests
// ---------------------------------------------------------------------------

describe("readConfig", () => {
	it("returns empty config when file does not exist", async () => {
		const fs = makeFakeFs(new Map());
		const config = await readConfig({ ...fs });
		expect(config).toEqual({});
	});

	it("returns empty config when YAML is corrupt", async () => {
		const files = new Map([
			["/home/user/.scriptor/config", ": : invalid yaml ::"],
		]);
		const fs = makeFakeFs(files);
		const config = await readConfig({
			...fs,
			configPath: "/home/user/.scriptor/config",
		});
		expect(config).toEqual({});
	});

	it("returns empty config when YAML is not an object (null)", async () => {
		const files = new Map([["/home/user/.scriptor/config", "null\n"]]);
		const fs = makeFakeFs(files);
		const config = await readConfig({
			...fs,
			configPath: "/home/user/.scriptor/config",
		});
		expect(config).toEqual({});
	});

	it("returns empty config when YAML is not an object (string)", async () => {
		const files = new Map([
			["/home/user/.scriptor/config", '"just a string"\n'],
		]);
		const fs = makeFakeFs(files);
		const config = await readConfig({
			...fs,
			configPath: "/home/user/.scriptor/config",
		});
		expect(config).toEqual({});
	});

	it("returns empty config when YAML is not an object (number)", async () => {
		const files = new Map([["/home/user/.scriptor/config", "42\n"]]);
		const fs = makeFakeFs(files);
		const config = await readConfig({
			...fs,
			configPath: "/home/user/.scriptor/config",
		});
		expect(config).toEqual({});
	});

	it("returns parsed config with repo field", async () => {
		const files = new Map([
			["/home/user/.scriptor/config", "repo: owner/my-repo\n"],
		]);
		const fs = makeFakeFs(files);
		const config = await readConfig({
			...fs,
			configPath: "/home/user/.scriptor/config",
		});
		expect(config).toEqual({ repo: "owner/my-repo" });
	});

	it("ignores unknown fields (extra keys are stripped)", async () => {
		const yaml = "repo: owner/my-repo\nunknown_key: some-value\n";
		const files = new Map([["/home/user/.scriptor/config", yaml]]);
		const fs = makeFakeFs(files);
		const config = await readConfig({
			...fs,
			configPath: "/home/user/.scriptor/config",
		});
		expect(config).toEqual({ repo: "owner/my-repo" });
		expect((config as Record<string, unknown>).unknown_key).toBeUndefined();
	});

	it("returns empty config when repo field has wrong type", async () => {
		const files = new Map([["/home/user/.scriptor/config", "repo: 123\n"]]);
		const fs = makeFakeFs(files);
		const config = await readConfig({
			...fs,
			configPath: "/home/user/.scriptor/config",
		});
		expect(config).toEqual({});
	});
});

// ---------------------------------------------------------------------------
// writeConfig tests
// ---------------------------------------------------------------------------

describe("writeConfig", () => {
	it("writes YAML file at the config path", async () => {
		const files = new Map<string, string>();
		const fs = makeFakeFs(files);
		await writeConfig(
			{ repo: "owner/my-repo" },
			{ ...fs, configPath: "/home/user/.scriptor/config" },
		);
		expect(files.has("/home/user/.scriptor/config")).toBe(true);
		const written = files.get("/home/user/.scriptor/config") ?? "";
		expect(written).toContain("owner/my-repo");
	});

	it("calls mkdir to ensure parent directory exists", async () => {
		const mkdirCalls: string[] = [];
		const files = new Map<string, string>();
		const deps: ConfigDeps = {
			readFile: async () => {
				throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
			},
			writeFile: async (path, content) => {
				files.set(path, content);
			},
			mkdir: async (path) => {
				mkdirCalls.push(path);
			},
			configPath: "/home/user/.scriptor/config",
		};
		await writeConfig({ repo: "owner/my-repo" }, deps);
		expect(mkdirCalls.length).toBeGreaterThan(0);
	});

	it("round-trips: written config can be read back correctly", async () => {
		const files = new Map<string, string>();
		const fs = makeFakeFs(files);
		const deps: ConfigDeps = {
			...fs,
			configPath: "/home/user/.scriptor/config",
		};

		await writeConfig({ repo: "owner/round-trip" }, deps);
		const config = await readConfig(deps);
		expect(config).toEqual({ repo: "owner/round-trip" });
	});

	it("round-trips empty config (no repo field)", async () => {
		const files = new Map<string, string>();
		const fs = makeFakeFs(files);
		const deps: ConfigDeps = {
			...fs,
			configPath: "/home/user/.scriptor/config",
		};

		await writeConfig({}, deps);
		const config = await readConfig(deps);
		expect(config).toEqual({});
	});
});
