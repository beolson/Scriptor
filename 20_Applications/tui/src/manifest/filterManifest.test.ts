// ---------------------------------------------------------------------------
// filterManifest Tests
//
// TDD: tests written before implementation (RED phase).
// Pure function — no side effects, no injectable deps.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "bun:test";
import type { HostInfo } from "../host/types.js";
import type { Manifest, ScriptEntry } from "./types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal ScriptEntry for a linux host. */
function linuxEntry(
	overrides: Partial<ScriptEntry> & Pick<ScriptEntry, "id">,
): ScriptEntry {
	const { id } = overrides;
	return {
		name: id,
		description: "A linux script",
		platform: "linux",
		arch: "x86",
		script: `scripts/Debian/13/${id}.sh`,
		distro: "Debian GNU/Linux",
		version: "13",
		dependencies: [],
		optional_dependencies: [],
		requires_elevation: false,
		inputs: [],
		...overrides,
	};
}

/** Build a minimal ScriptEntry for a non-linux host. */
function nonLinuxEntry(
	overrides: Partial<ScriptEntry> & Pick<ScriptEntry, "id">,
): ScriptEntry {
	const { id } = overrides;
	return {
		name: id,
		description: "A non-linux script",
		platform: "windows",
		arch: "x86",
		script: `scripts/Windows/${id}.ps1`,
		dependencies: [],
		optional_dependencies: [],
		requires_elevation: false,
		inputs: [],
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Lazy import helper — only imported after RED phase confirms tests fail
// ---------------------------------------------------------------------------

async function getFilterManifest() {
	const { filterManifest } = await import("./filterManifest.js");
	return filterManifest;
}

// ---------------------------------------------------------------------------
// Linux host matching
// ---------------------------------------------------------------------------

describe("filterManifest — linux host", () => {
	it("includes a linux entry that exactly matches platform, arch, distro, and version", async () => {
		const filterManifest = await getFilterManifest();
		const host: HostInfo = {
			platform: "linux",
			arch: "x86",
			distro: "Debian GNU/Linux",
			version: "13",
		};
		const manifest: Manifest = [linuxEntry({ id: "install-basics" })];

		const result = filterManifest(manifest, host);

		expect(result).toHaveLength(1);
		expect(result[0]?.id).toBe("install-basics");
	});

	it("excludes a linux entry with mismatched platform", async () => {
		const filterManifest = await getFilterManifest();
		const host: HostInfo = {
			platform: "windows",
			arch: "x86",
		};
		const manifest: Manifest = [linuxEntry({ id: "install-basics" })];

		const result = filterManifest(manifest, host);

		expect(result).toHaveLength(0);
	});

	it("excludes a linux entry with mismatched arch", async () => {
		const filterManifest = await getFilterManifest();
		const host: HostInfo = {
			platform: "linux",
			arch: "arm",
			distro: "Debian GNU/Linux",
			version: "13",
		};
		const manifest: Manifest = [
			linuxEntry({ id: "install-basics", arch: "x86" }),
		];

		const result = filterManifest(manifest, host);

		expect(result).toHaveLength(0);
	});

	it("excludes a linux entry where version '13' does not match host version '13.1' (exact match only)", async () => {
		const filterManifest = await getFilterManifest();
		const host: HostInfo = {
			platform: "linux",
			arch: "x86",
			distro: "Debian GNU/Linux",
			version: "13.1",
		};
		const manifest: Manifest = [
			linuxEntry({ id: "install-basics", version: "13" }),
		];

		const result = filterManifest(manifest, host);

		expect(result).toHaveLength(0);
	});

	it("excludes all linux entries when host.distro is absent", async () => {
		const filterManifest = await getFilterManifest();
		const host: HostInfo = {
			platform: "linux",
			arch: "x86",
			// distro intentionally absent
			version: "13",
		};
		const manifest: Manifest = [
			linuxEntry({ id: "install-a" }),
			linuxEntry({ id: "install-b" }),
		];

		const result = filterManifest(manifest, host);

		expect(result).toHaveLength(0);
	});

	it("excludes all linux entries when host.version is absent", async () => {
		const filterManifest = await getFilterManifest();
		const host: HostInfo = {
			platform: "linux",
			arch: "x86",
			distro: "Debian GNU/Linux",
			// version intentionally absent
		};
		const manifest: Manifest = [
			linuxEntry({ id: "install-a" }),
			linuxEntry({ id: "install-b" }),
		];

		const result = filterManifest(manifest, host);

		expect(result).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// Non-linux host matching
// ---------------------------------------------------------------------------

describe("filterManifest — non-linux host", () => {
	it("includes a windows entry matching platform and arch", async () => {
		const filterManifest = await getFilterManifest();
		const host: HostInfo = { platform: "windows", arch: "x86" };
		const manifest: Manifest = [
			nonLinuxEntry({ id: "setup-foo", platform: "windows", arch: "x86" }),
		];

		const result = filterManifest(manifest, host);

		expect(result).toHaveLength(1);
		expect(result[0]?.id).toBe("setup-foo");
	});

	it("non-linux entries are never filtered on distro or version", async () => {
		const filterManifest = await getFilterManifest();
		const host: HostInfo = { platform: "mac", arch: "arm" };
		const manifest: Manifest = [
			nonLinuxEntry({ id: "mac-setup", platform: "mac", arch: "arm" }),
		];

		const result = filterManifest(manifest, host);

		expect(result).toHaveLength(1);
		expect(result[0]?.id).toBe("mac-setup");
	});

	it("excludes a non-linux entry with mismatched platform", async () => {
		const filterManifest = await getFilterManifest();
		const host: HostInfo = { platform: "mac", arch: "arm" };
		const manifest: Manifest = [
			nonLinuxEntry({ id: "setup-foo", platform: "windows", arch: "arm" }),
		];

		const result = filterManifest(manifest, host);

		expect(result).toHaveLength(0);
	});

	it("excludes a non-linux entry with mismatched arch", async () => {
		const filterManifest = await getFilterManifest();
		const host: HostInfo = { platform: "windows", arch: "arm" };
		const manifest: Manifest = [
			nonLinuxEntry({ id: "setup-foo", platform: "windows", arch: "x86" }),
		];

		const result = filterManifest(manifest, host);

		expect(result).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// Multiple entries / empty manifest
// ---------------------------------------------------------------------------

describe("filterManifest — multiple entries and edge cases", () => {
	it("returns all matching entries from a mixed manifest", async () => {
		const filterManifest = await getFilterManifest();
		const host: HostInfo = {
			platform: "linux",
			arch: "x86",
			distro: "Debian GNU/Linux",
			version: "13",
		};
		const manifest: Manifest = [
			linuxEntry({ id: "install-a" }),
			linuxEntry({ id: "install-b" }),
			nonLinuxEntry({ id: "windows-entry", platform: "windows", arch: "x86" }),
		];

		const result = filterManifest(manifest, host);

		expect(result).toHaveLength(2);
		expect(result.map((e) => e.id)).toEqual(["install-a", "install-b"]);
	});

	it("returns an empty array for an empty manifest", async () => {
		const filterManifest = await getFilterManifest();
		const host: HostInfo = {
			platform: "linux",
			arch: "x86",
			distro: "Debian GNU/Linux",
			version: "13",
		};

		const result = filterManifest([], host);

		expect(result).toHaveLength(0);
	});

	it("returns entries for multiple matching linux distro+version combinations", async () => {
		const filterManifest = await getFilterManifest();
		const host: HostInfo = {
			platform: "linux",
			arch: "x86",
			distro: "Ubuntu",
			version: "22.04",
		};
		const manifest: Manifest = [
			linuxEntry({ id: "install-a", distro: "Ubuntu", version: "22.04" }),
			linuxEntry({
				id: "install-b",
				distro: "Debian GNU/Linux",
				version: "13",
			}),
			linuxEntry({ id: "install-c", distro: "Ubuntu", version: "22.04" }),
		];

		const result = filterManifest(manifest, host);

		expect(result).toHaveLength(2);
		expect(result.map((e) => e.id)).toEqual(["install-a", "install-c"]);
	});
});
