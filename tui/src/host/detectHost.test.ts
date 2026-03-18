import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { detectHost, type HostDeps } from "./detectHost";

const fixturesDir = join(import.meta.dir, "fixtures");

function readFixture(name: string): string {
	return readFileSync(join(fixturesDir, name), "utf8");
}

// Helper: build HostDeps from explicit values
function makeDeps(
	platform: string,
	arch: string,
	osRelease?: string | null,
	isAdmin?: boolean,
): HostDeps {
	return {
		getPlatform: () => platform,
		getArch: () => arch,
		readOsRelease: () =>
			osRelease !== undefined
				? Promise.resolve(osRelease)
				: Promise.resolve(null),
		checkIsAdmin: () => Promise.resolve(isAdmin ?? false),
	};
}

describe("detectHost — platform normalization", () => {
	test("linux is returned as 'linux'", async () => {
		const info = await detectHost(
			makeDeps("linux", "x64", readFixture("ubuntu-24-04.os-release")),
		);
		expect(info.platform).toBe("linux");
	});

	test("darwin is returned as 'mac'", async () => {
		const info = await detectHost(makeDeps("darwin", "arm64"));
		expect(info.platform).toBe("mac");
	});

	test("win32 is returned as 'windows'", async () => {
		const info = await detectHost(makeDeps("win32", "x64"));
		expect(info.platform).toBe("windows");
	});

	test("unknown platform throws a descriptive error", async () => {
		expect(detectHost(makeDeps("freebsd", "x64"))).rejects.toThrow(
			/unsupported platform/i,
		);
	});
});

describe("detectHost — architecture normalization", () => {
	test("x64 is returned as 'x86'", async () => {
		const info = await detectHost(makeDeps("darwin", "x64"));
		expect(info.arch).toBe("x86");
	});

	test("ia32 is returned as 'x86'", async () => {
		const info = await detectHost(makeDeps("win32", "ia32"));
		expect(info.arch).toBe("x86");
	});

	test("arm64 is returned as 'arm'", async () => {
		const info = await detectHost(makeDeps("darwin", "arm64"));
		expect(info.arch).toBe("arm");
	});

	test("arm is returned as 'arm'", async () => {
		const info = await detectHost(
			makeDeps("linux", "arm", readFixture("ubuntu-24-04.os-release")),
		);
		expect(info.arch).toBe("arm");
	});

	test("unknown arch throws a descriptive error", async () => {
		expect(detectHost(makeDeps("linux", "mips", ""))).rejects.toThrow(
			/unsupported architecture/i,
		);
	});
});

describe("detectHost — Linux distro parsing", () => {
	test("Ubuntu 24.04 os-release is parsed correctly", async () => {
		const info = await detectHost(
			makeDeps("linux", "x64", readFixture("ubuntu-24-04.os-release")),
		);
		expect(info.distro).toBe("Ubuntu");
		expect(info.version).toBe("24.04");
	});

	test("Fedora 40 os-release is parsed correctly", async () => {
		const info = await detectHost(
			makeDeps("linux", "x64", readFixture("fedora-40.os-release")),
		);
		expect(info.distro).toBe("Fedora Linux");
		expect(info.version).toBe("40");
	});

	test("os-release with no NAME field omits distro", async () => {
		const info = await detectHost(
			makeDeps("linux", "x64", readFixture("no-name.os-release")),
		);
		expect(info.distro).toBeUndefined();
		expect(info.version).toBe("1.0");
	});

	test("missing /etc/os-release on Linux omits distro and version", async () => {
		const info = await detectHost(makeDeps("linux", "x64", null));
		expect(info.platform).toBe("linux");
		expect(info.distro).toBeUndefined();
		expect(info.version).toBeUndefined();
	});

	test("empty /etc/os-release on Linux omits distro and version", async () => {
		const info = await detectHost(makeDeps("linux", "x64", ""));
		expect(info.distro).toBeUndefined();
		expect(info.version).toBeUndefined();
	});
});

describe("detectHost — non-Linux platforms", () => {
	test("mac has no distro or version", async () => {
		const info = await detectHost(makeDeps("darwin", "arm64"));
		expect(info.distro).toBeUndefined();
		expect(info.version).toBeUndefined();
	});

	test("windows has no distro or version", async () => {
		const info = await detectHost(makeDeps("win32", "x64"));
		expect(info.distro).toBeUndefined();
		expect(info.version).toBeUndefined();
	});
});

describe("detectHost — isAdmin (Windows only)", () => {
	test("windows with admin returns isAdmin: true", async () => {
		const info = await detectHost(makeDeps("win32", "x64", undefined, true));
		expect(info.isAdmin).toBe(true);
	});

	test("windows without admin returns isAdmin: false", async () => {
		const info = await detectHost(makeDeps("win32", "x64", undefined, false));
		expect(info.isAdmin).toBe(false);
	});

	test("linux does not set isAdmin", async () => {
		const info = await detectHost(
			makeDeps("linux", "x64", readFixture("ubuntu-24-04.os-release")),
		);
		expect(info.isAdmin).toBeUndefined();
	});

	test("mac does not set isAdmin", async () => {
		const info = await detectHost(makeDeps("darwin", "arm64"));
		expect(info.isAdmin).toBeUndefined();
	});
});

describe("detectHost — full HostInfo shape", () => {
	test("Linux x64 Ubuntu returns complete HostInfo", async () => {
		const info = await detectHost(
			makeDeps("linux", "x64", readFixture("ubuntu-24-04.os-release")),
		);
		expect(info).toEqual({
			platform: "linux",
			arch: "x86",
			distro: "Ubuntu",
			version: "24.04",
		});
	});

	test("macOS arm64 returns HostInfo without distro/version", async () => {
		const info = await detectHost(makeDeps("darwin", "arm64"));
		expect(info).toEqual({ platform: "mac", arch: "arm" });
	});
});
