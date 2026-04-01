import { describe, expect, it } from "bun:test";
import type { HostInfo, ScriptEntry } from "../types.js";
import { filterManifest } from "./filterManifest.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeScript(
	overrides: Partial<ScriptEntry> & { id: string },
): ScriptEntry {
	const { id, name, description, os, script, ...rest } = overrides;
	return {
		id,
		name: name ?? `Script ${id}`,
		description: description ?? "A script",
		os: os ?? {
			name: "Debian GNU/Linux",
			version: "12",
			arch: "x64",
		},
		script: script ?? `scripts/linux/${id}.sh`,
		...rest,
	};
}

const DEBIAN_X64_HOST: HostInfo = {
	osName: "Debian GNU/Linux",
	osVersion: "12",
	arch: "x64",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("filterManifest", () => {
	describe("os.name matching", () => {
		it("includes entry when os.name matches host.osName", () => {
			const script = makeScript({
				id: "a",
				os: { name: "Debian GNU/Linux", arch: "x64" },
			});
			const result = filterManifest({ scripts: [script] }, DEBIAN_X64_HOST);
			expect(result).toHaveLength(1);
			expect(result[0]?.id).toBe("a");
		});

		it("excludes entry when os.name does not match host.osName", () => {
			const script = makeScript({
				id: "a",
				os: { name: "Ubuntu", arch: "x64" },
			});
			const result = filterManifest({ scripts: [script] }, DEBIAN_X64_HOST);
			expect(result).toHaveLength(0);
		});

		it("excludes all entries when host.osName is undefined", () => {
			const script = makeScript({
				id: "a",
				os: { name: "Debian GNU/Linux", arch: "x64" },
			});
			const host: HostInfo = { arch: "x64" };
			const result = filterManifest({ scripts: [script] }, host);
			expect(result).toHaveLength(0);
		});
	});

	describe("os.version matching", () => {
		it("includes entry when os.version matches host.osVersion", () => {
			const script = makeScript({
				id: "a",
				os: { name: "Debian GNU/Linux", version: "12", arch: "x64" },
			});
			const result = filterManifest({ scripts: [script] }, DEBIAN_X64_HOST);
			expect(result).toHaveLength(1);
		});

		it("excludes entry when os.version is present but does not match host.osVersion", () => {
			const script = makeScript({
				id: "a",
				os: { name: "Debian GNU/Linux", version: "11", arch: "x64" },
			});
			const result = filterManifest({ scripts: [script] }, DEBIAN_X64_HOST);
			expect(result).toHaveLength(0);
		});

		it("includes entry when os.version is absent (matches any host version)", () => {
			const script = makeScript({
				id: "a",
				os: { name: "Debian GNU/Linux", arch: "x64" },
			});
			const result = filterManifest({ scripts: [script] }, DEBIAN_X64_HOST);
			expect(result).toHaveLength(1);
		});

		it("includes entry when host.osVersion is undefined and entry has no os.version", () => {
			const script = makeScript({
				id: "a",
				os: { name: "Debian GNU/Linux", arch: "x64" },
			});
			const host: HostInfo = { osName: "Debian GNU/Linux", arch: "x64" };
			const result = filterManifest({ scripts: [script] }, host);
			expect(result).toHaveLength(1);
		});
	});

	describe("os.arch matching", () => {
		it("includes entry when os.arch matches host.arch", () => {
			const script = makeScript({
				id: "a",
				os: { name: "Debian GNU/Linux", arch: "x64" },
			});
			const result = filterManifest({ scripts: [script] }, DEBIAN_X64_HOST);
			expect(result).toHaveLength(1);
		});

		it("excludes entry when os.arch does not match host.arch", () => {
			const script = makeScript({
				id: "a",
				os: { name: "Debian GNU/Linux", arch: "arm" },
			});
			const result = filterManifest({ scripts: [script] }, DEBIAN_X64_HOST);
			expect(result).toHaveLength(0);
		});
	});

	describe("mixed results", () => {
		it("returns only matching entries from a mixed set", () => {
			const match = makeScript({
				id: "match",
				os: { name: "Debian GNU/Linux", version: "12", arch: "x64" },
			});
			const wrongName = makeScript({
				id: "wrong-name",
				os: { name: "Ubuntu", arch: "x64" },
			});
			const wrongVersion = makeScript({
				id: "wrong-version",
				os: { name: "Debian GNU/Linux", version: "11", arch: "x64" },
			});
			const wrongArch = makeScript({
				id: "wrong-arch",
				os: { name: "Debian GNU/Linux", arch: "arm" },
			});
			const noVersion = makeScript({
				id: "no-version",
				os: { name: "Debian GNU/Linux", arch: "x64" },
			});

			const result = filterManifest(
				{ scripts: [match, wrongName, wrongVersion, wrongArch, noVersion] },
				DEBIAN_X64_HOST,
			);

			expect(result).toHaveLength(2);
			const ids = result.map((s) => s.id);
			expect(ids).toContain("match");
			expect(ids).toContain("no-version");
		});
	});

	describe("edge cases", () => {
		it("returns empty array for empty scripts array", () => {
			const result = filterManifest({ scripts: [] }, DEBIAN_X64_HOST);
			expect(result).toHaveLength(0);
		});

		it("does not throw when an entry is excluded — silently excludes", () => {
			const script = makeScript({
				id: "a",
				os: { name: "windows", arch: "x64" },
			});
			expect(() =>
				filterManifest({ scripts: [script] }, DEBIAN_X64_HOST),
			).not.toThrow();
		});
	});
});
