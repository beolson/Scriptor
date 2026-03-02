import { describe, expect, test } from "bun:test";
import {
	getAllScriptIds,
	getScriptById,
	getScriptsByPlatform,
	loadScripts,
} from "./loadScripts";

describe("loadScripts", () => {
	test("returns a non-empty array of ScriptEntry objects", async () => {
		const scripts = await loadScripts();
		expect(Array.isArray(scripts)).toBe(true);
		expect(scripts.length).toBeGreaterThan(0);
		const first = scripts[0];
		expect(typeof first?.id).toBe("string");
		expect(typeof first?.name).toBe("string");
		expect(typeof first?.description).toBe("string");
		expect(["windows", "linux", "mac"]).toContain(first?.platform);
		expect(["x86", "arm"]).toContain(first?.arch);
		expect(typeof first?.script).toBe("string");
	});

	test("all entries have required fields", async () => {
		const scripts = await loadScripts();
		for (const entry of scripts) {
			expect(typeof entry.id).toBe("string");
			expect(entry.id.length).toBeGreaterThan(0);
			expect(typeof entry.name).toBe("string");
			expect(typeof entry.description).toBe("string");
			expect(["windows", "linux", "mac"]).toContain(entry.platform);
			expect(["x86", "arm"]).toContain(entry.arch);
			expect(typeof entry.script).toBe("string");
		}
	});
});

describe("getScriptsByPlatform", () => {
	test("returns only linux entries when filtering by linux", async () => {
		const linuxScripts = await getScriptsByPlatform("linux");
		expect(linuxScripts.length).toBeGreaterThan(0);
		for (const entry of linuxScripts) {
			expect(entry.platform).toBe("linux");
		}
	});

	test("returns only windows entries when filtering by windows", async () => {
		const windowsScripts = await getScriptsByPlatform("windows");
		expect(windowsScripts.length).toBeGreaterThan(0);
		for (const entry of windowsScripts) {
			expect(entry.platform).toBe("windows");
		}
	});

	test("returns only mac entries when filtering by mac", async () => {
		const macScripts = await getScriptsByPlatform("mac");
		expect(macScripts.length).toBeGreaterThan(0);
		for (const entry of macScripts) {
			expect(entry.platform).toBe("mac");
		}
	});

	test("returns empty array for unknown platform", async () => {
		const scripts = await getScriptsByPlatform("unknown");
		expect(scripts).toEqual([]);
	});
});

describe("getScriptById", () => {
	test("returns the expected entry for install-docker", async () => {
		const entry = await getScriptById("install-docker");
		expect(entry).toBeDefined();
		expect(entry?.id).toBe("install-docker");
		expect(entry?.platform).toBe("linux");
	});

	test("returns undefined for a nonexistent id", async () => {
		const entry = await getScriptById("nonexistent");
		expect(entry).toBeUndefined();
	});

	test("an entry with a spec field has it preserved as a string", async () => {
		const scripts = await loadScripts();
		const withSpec = scripts.filter((s) => s.spec !== undefined);
		expect(withSpec.length).toBeGreaterThan(0);
		for (const entry of withSpec) {
			expect(typeof entry.spec).toBe("string");
			expect(entry.spec?.length).toBeGreaterThan(0);
		}
	});

	test("missing optional fields are undefined not missing keys", async () => {
		const scripts = await loadScripts();
		// At least one entry should have no dependencies
		const noDeps = scripts.find((s) => s.dependencies === undefined);
		// We just check that accessing `.dependencies` doesn't throw
		expect(noDeps?.dependencies).toBeUndefined();
	});
});

describe("getAllScriptIds", () => {
	test("returns IDs for every entry", async () => {
		const allIds = await getAllScriptIds();
		const scripts = await loadScripts();
		expect(allIds.length).toBe(scripts.length);
		for (const entry of scripts) {
			expect(allIds).toContain(entry.id);
		}
	});

	test("returns only strings", async () => {
		const allIds = await getAllScriptIds();
		for (const id of allIds) {
			expect(typeof id).toBe("string");
		}
	});
});
