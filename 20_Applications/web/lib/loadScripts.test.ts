import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { getScriptById, getScriptsByPlatform } from "./loadScripts";

const fixtureRoot = join(import.meta.dir, "__fixtures__");
const deps = {
	manifestPath: join(fixtureRoot, "scriptor.yaml"),
	repoRoot: fixtureRoot,
};

describe("getScriptsByPlatform", () => {
	it("returns only linux-platform scripts for 'linux'", async () => {
		const scripts = await getScriptsByPlatform("linux", deps);
		expect(scripts.length).toBe(2);
		for (const s of scripts) {
			expect(s.platform).toBe("linux");
		}
	});

	it("returns only windows-platform scripts for 'windows'", async () => {
		const scripts = await getScriptsByPlatform("windows", deps);
		expect(scripts.length).toBe(1);
		expect(scripts[0].platform).toBe("windows");
		expect(scripts[0].id).toBe("test-win");
	});

	it("returns linux scripts when platform is 'invalid' (default)", async () => {
		const scripts = await getScriptsByPlatform("invalid", deps);
		expect(scripts.length).toBe(2);
		for (const s of scripts) {
			expect(s.platform).toBe("linux");
		}
	});

	it("populates scriptSource with file contents", async () => {
		const scripts = await getScriptsByPlatform("linux", deps);
		const script = scripts.find((s) => s.id === "test-script");
		expect(script).toBeDefined();
		expect(script?.scriptSource).toContain("Hello from test-script");
	});

	it("populates spec when .spec.md exists", async () => {
		const scripts = await getScriptsByPlatform("linux", deps);
		const script = scripts.find((s) => s.id === "test-script");
		expect(script).toBeDefined();
		expect(script?.spec).toContain("Test Script Spec");
	});

	it("sets spec to undefined when .spec.md is absent", async () => {
		const scripts = await getScriptsByPlatform("linux", deps);
		const script = scripts.find((s) => s.id === "test-no-spec");
		expect(script).toBeDefined();
		expect(script?.spec).toBeUndefined();
	});

	it("correctly maps inputs from InputDef entries", async () => {
		const scripts = await getScriptsByPlatform("linux", deps);
		const script = scripts.find((s) => s.id === "test-script");
		expect(script).toBeDefined();
		expect(script?.inputs).toHaveLength(1);
		expect(script?.inputs[0].id).toBe("username");
		expect(script?.inputs[0].type).toBe("string");
		expect(script?.inputs[0].label).toBe("Username");
		expect(script?.inputs[0].required).toBe(true);
	});

	it("sets inputs to empty array when no inputs defined", async () => {
		const scripts = await getScriptsByPlatform("linux", deps);
		const script = scripts.find((s) => s.id === "test-no-spec");
		expect(script).toBeDefined();
		expect(script?.inputs).toEqual([]);
	});

	it("sets distro and version from os.name and os.version", async () => {
		const scripts = await getScriptsByPlatform("linux", deps);
		const script = scripts.find((s) => s.id === "test-script");
		expect(script).toBeDefined();
		expect(script?.distro).toBe("Debian GNU/Linux");
		expect(script?.version).toBe("13");
	});
});

describe("getScriptById", () => {
	it("returns the correct script for a known id", async () => {
		const script = await getScriptById("test-script", deps);
		expect(script).toBeDefined();
		expect(script?.id).toBe("test-script");
		expect(script?.name).toBe("Test Script");
	});

	it("returns undefined for an unknown id", async () => {
		const script = await getScriptById("does-not-exist", deps);
		expect(script).toBeUndefined();
	});

	it("populates scriptSource for a found script", async () => {
		const script = await getScriptById("test-win", deps);
		expect(script).toBeDefined();
		expect(script?.scriptSource).toContain("Hello from test-win");
	});

	it("throws when a required script file is missing (via missing-script fixture)", async () => {
		const missingFileDeps = {
			manifestPath: join(fixtureRoot, "missing-script.yaml"),
			repoRoot: fixtureRoot,
		};
		// getScriptById calls loadAllScripts which throws when a script file is missing
		await expect(
			getScriptById("missing-file", missingFileDeps),
		).rejects.toThrow();
	});
});

describe("build-time error: missing script file", () => {
	it("throws when a script file does not exist", async () => {
		const missingFileDeps = {
			manifestPath: join(fixtureRoot, "missing-script.yaml"),
			repoRoot: fixtureRoot,
		};
		await expect(
			getScriptsByPlatform("linux", missingFileDeps),
		).rejects.toThrow();
	});
});
