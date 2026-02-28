import { describe, expect, test } from "bun:test";
import type { HostInfo } from "../host/detectHost";
import { filterManifest } from "./filterManifest";
import type { ScriptEntry } from "./parseManifest";

// ---------------------------------------------------------------------------
// Helpers — build ScriptEntry fixtures without typing the full shape each time
// ---------------------------------------------------------------------------

function windowsEntry(overrides: Partial<ScriptEntry> = {}): ScriptEntry {
	return {
		id: "install-git",
		name: "Install Git",
		description: "Installs Git",
		platform: "windows",
		arch: "x86",
		script: "scripts/windows/git.ps1",
		dependencies: [],
		...overrides,
	};
}

function macEntry(overrides: Partial<ScriptEntry> = {}): ScriptEntry {
	return {
		id: "install-bun",
		name: "Install Bun",
		description: "Installs Bun",
		platform: "mac",
		arch: "arm",
		script: "scripts/mac/bun.sh",
		dependencies: [],
		...overrides,
	};
}

function linuxEntry(overrides: Partial<ScriptEntry> = {}): ScriptEntry {
	return {
		id: "install-docker",
		name: "Install Docker",
		description: "Installs Docker",
		platform: "linux",
		arch: "x86",
		script: "scripts/linux/docker.sh",
		distro: "Ubuntu",
		version: "24.04",
		dependencies: [],
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Happy path — platform + arch matching
// ---------------------------------------------------------------------------

describe("filterManifest — platform matching", () => {
	test("windows entry is returned for windows host", () => {
		const host: HostInfo = { platform: "windows", arch: "x86" };
		const entries = [windowsEntry()];
		expect(filterManifest(entries, host)).toEqual(entries);
	});

	test("mac entry is returned for mac host", () => {
		const host: HostInfo = { platform: "mac", arch: "arm" };
		const entries = [macEntry()];
		expect(filterManifest(entries, host)).toEqual(entries);
	});

	test("linux entry is returned for matching linux host", () => {
		const host: HostInfo = {
			platform: "linux",
			arch: "x86",
			distro: "Ubuntu",
			version: "24.04",
		};
		const entries = [linuxEntry()];
		expect(filterManifest(entries, host)).toEqual(entries);
	});

	test("windows entry is excluded for mac host", () => {
		const host: HostInfo = { platform: "mac", arch: "arm" };
		const entries = [windowsEntry()];
		expect(filterManifest(entries, host)).toEqual([]);
	});

	test("mac entry is excluded for windows host", () => {
		const host: HostInfo = { platform: "windows", arch: "x86" };
		const entries = [macEntry()];
		expect(filterManifest(entries, host)).toEqual([]);
	});
});

describe("filterManifest — arch matching", () => {
	test("x86 entry is excluded for arm host", () => {
		const host: HostInfo = { platform: "windows", arch: "arm" };
		const entries = [windowsEntry({ arch: "x86" })];
		expect(filterManifest(entries, host)).toEqual([]);
	});

	test("arm entry is excluded for x86 host", () => {
		const host: HostInfo = { platform: "mac", arch: "x86" };
		const entries = [macEntry({ arch: "arm" })];
		expect(filterManifest(entries, host)).toEqual([]);
	});

	test("arm entry is returned for arm host", () => {
		const host: HostInfo = { platform: "mac", arch: "arm" };
		const entries = [macEntry({ arch: "arm" })];
		expect(filterManifest(entries, host)).toEqual(entries);
	});
});

// ---------------------------------------------------------------------------
// Linux distro + version matching
// ---------------------------------------------------------------------------

describe("filterManifest — Linux distro and version matching", () => {
	test("linux entry matches host with same distro and version", () => {
		const host: HostInfo = {
			platform: "linux",
			arch: "x86",
			distro: "Ubuntu",
			version: "24.04",
		};
		const entries = [linuxEntry({ distro: "Ubuntu", version: "24.04" })];
		expect(filterManifest(entries, host)).toEqual(entries);
	});

	test("linux entry is excluded when distro does not match", () => {
		const host: HostInfo = {
			platform: "linux",
			arch: "x86",
			distro: "Fedora Linux",
			version: "40",
		};
		const entries = [linuxEntry({ distro: "Ubuntu", version: "24.04" })];
		expect(filterManifest(entries, host)).toEqual([]);
	});

	test("linux entry is excluded when version does not match", () => {
		const host: HostInfo = {
			platform: "linux",
			arch: "x86",
			distro: "Ubuntu",
			version: "22.04",
		};
		const entries = [linuxEntry({ distro: "Ubuntu", version: "24.04" })];
		expect(filterManifest(entries, host)).toEqual([]);
	});

	test("linux host without distro info excludes all linux entries", () => {
		// Host detected linux but /etc/os-release was absent
		const host: HostInfo = { platform: "linux", arch: "x86" };
		const entries = [linuxEntry()];
		expect(filterManifest(entries, host)).toEqual([]);
	});

	test("linux host without version info excludes linux entry", () => {
		const host: HostInfo = {
			platform: "linux",
			arch: "x86",
			distro: "Ubuntu",
		};
		const entries = [linuxEntry({ distro: "Ubuntu", version: "24.04" })];
		expect(filterManifest(entries, host)).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// Case-insensitive matching for platform/distro strings
// ---------------------------------------------------------------------------

describe("filterManifest — case-insensitive matching", () => {
	test("distro comparison is case-insensitive (host lower, entry mixed)", () => {
		const host: HostInfo = {
			platform: "linux",
			arch: "x86",
			distro: "ubuntu",
			version: "24.04",
		};
		const entries = [linuxEntry({ distro: "Ubuntu", version: "24.04" })];
		expect(filterManifest(entries, host)).toEqual(entries);
	});

	test("distro comparison is case-insensitive (host mixed, entry lower)", () => {
		const host: HostInfo = {
			platform: "linux",
			arch: "x86",
			distro: "Ubuntu",
			version: "24.04",
		};
		const entries = [linuxEntry({ distro: "ubuntu", version: "24.04" })];
		expect(filterManifest(entries, host)).toEqual(entries);
	});

	test("distro comparison is case-insensitive (both uppercase)", () => {
		const host: HostInfo = {
			platform: "linux",
			arch: "x86",
			distro: "FEDORA LINUX",
			version: "40",
		};
		const entries = [linuxEntry({ distro: "Fedora Linux", version: "40" })];
		expect(filterManifest(entries, host)).toEqual(entries);
	});
});

// ---------------------------------------------------------------------------
// Non-Linux entries are not filtered by distro/version
// ---------------------------------------------------------------------------

describe("filterManifest — non-Linux entries ignore distro/version", () => {
	test("windows entry is matched by platform+arch only, not distro/version", () => {
		// Even if the host has distro/version info somehow, windows entries ignore it
		const host: HostInfo = {
			platform: "windows",
			arch: "x86",
			// These fields would never be present on a real windows host but
			// the filter should not care either way for non-linux entries.
		};
		const entries = [windowsEntry()];
		expect(filterManifest(entries, host)).toEqual(entries);
	});

	test("mac entry is matched by platform+arch only", () => {
		const host: HostInfo = { platform: "mac", arch: "arm" };
		const entries = [macEntry()];
		expect(filterManifest(entries, host)).toEqual(entries);
	});
});

// ---------------------------------------------------------------------------
// No entries match
// ---------------------------------------------------------------------------

describe("filterManifest — empty results", () => {
	test("empty manifest returns empty array", () => {
		const host: HostInfo = { platform: "windows", arch: "x86" };
		expect(filterManifest([], host)).toEqual([]);
	});

	test("no matching entries returns empty array (not an error)", () => {
		const host: HostInfo = { platform: "mac", arch: "arm" };
		const entries = [
			windowsEntry({ id: "a" }),
			windowsEntry({ id: "b", arch: "arm" }),
			linuxEntry(),
		];
		expect(filterManifest(entries, host)).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// Mixed manifests — only matching entries are returned
// ---------------------------------------------------------------------------

describe("filterManifest — mixed manifests", () => {
	test("only matching platform entries are returned from a mixed manifest", () => {
		const host: HostInfo = { platform: "mac", arch: "arm" };
		const mac1 = macEntry({ id: "bun" });
		const mac2 = macEntry({ id: "git", arch: "arm" });
		const win = windowsEntry();
		const lnx = linuxEntry();
		const result = filterManifest([mac1, win, mac2, lnx], host);
		expect(result).toHaveLength(2);
		expect(result).toContainEqual(mac1);
		expect(result).toContainEqual(mac2);
	});

	test("only matching linux entries are returned when multiple distros present", () => {
		const host: HostInfo = {
			platform: "linux",
			arch: "x86",
			distro: "Ubuntu",
			version: "24.04",
		};
		const ubuntu2404 = linuxEntry({
			id: "a",
			distro: "Ubuntu",
			version: "24.04",
		});
		const ubuntu2204 = linuxEntry({
			id: "b",
			distro: "Ubuntu",
			version: "22.04",
		});
		const fedora = linuxEntry({
			id: "c",
			distro: "Fedora Linux",
			version: "40",
		});
		const result = filterManifest([ubuntu2404, ubuntu2204, fedora], host);
		expect(result).toHaveLength(1);
		expect(result[0]?.id).toBe("a");
	});

	test("preserves original entry order", () => {
		const host: HostInfo = { platform: "windows", arch: "x86" };
		const e1 = windowsEntry({ id: "first" });
		const e2 = windowsEntry({ id: "second" });
		const e3 = windowsEntry({ id: "third" });
		const result = filterManifest([e1, e2, e3], host);
		expect(result.map((e) => e.id)).toEqual(["first", "second", "third"]);
	});
});
