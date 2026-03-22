import { describe, expect, it } from "bun:test";
import type { DetectHostDeps } from "./detectHost.js";
import { detectHost } from "./detectHost.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDeps(overrides: Partial<DetectHostDeps> = {}): DetectHostDeps {
	return {
		platform: "linux",
		arch: "x64",
		readOsRelease: async () => 'NAME="Debian GNU/Linux"\nVERSION_ID="13"\n',
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Platform mapping
// ---------------------------------------------------------------------------

describe("platform mapping", () => {
	it("maps linux → linux", async () => {
		const result = await detectHost(makeDeps({ platform: "linux" }));
		expect(result.platform).toBe("linux");
	});

	it("maps darwin → mac", async () => {
		const result = await detectHost(
			makeDeps({
				platform: "darwin",
				readOsRelease: async () => {
					throw new Error("no");
				},
			}),
		);
		expect(result.platform).toBe("mac");
	});

	it("maps win32 → windows", async () => {
		const result = await detectHost(
			makeDeps({
				platform: "win32",
				readOsRelease: async () => {
					throw new Error("no");
				},
			}),
		);
		expect(result.platform).toBe("windows");
	});

	it("maps unknown platform → linux (fallback)", async () => {
		const result = await detectHost(makeDeps({ platform: "freebsd" }));
		expect(result.platform).toBe("linux");
	});
});

// ---------------------------------------------------------------------------
// Arch mapping
// ---------------------------------------------------------------------------

describe("arch mapping", () => {
	it("maps x64 → x86", async () => {
		const result = await detectHost(makeDeps({ arch: "x64" }));
		expect(result.arch).toBe("x86");
	});

	it("maps ia32 → x86", async () => {
		const result = await detectHost(makeDeps({ arch: "ia32" }));
		expect(result.arch).toBe("x86");
	});

	it("maps arm64 → arm", async () => {
		const result = await detectHost(makeDeps({ arch: "arm64" }));
		expect(result.arch).toBe("arm");
	});

	it("maps arm → arm", async () => {
		const result = await detectHost(makeDeps({ arch: "arm" }));
		expect(result.arch).toBe("arm");
	});
});

// ---------------------------------------------------------------------------
// Linux distro detection
// ---------------------------------------------------------------------------

describe("linux distro detection — full /etc/os-release", () => {
	it("parses NAME and VERSION_ID from unquoted values", async () => {
		const result = await detectHost(
			makeDeps({ readOsRelease: async () => "NAME=Debian\nVERSION_ID=13\n" }),
		);
		expect(result.distro).toBe("Debian");
		expect(result.version).toBe("13");
	});

	it("parses NAME and VERSION_ID from double-quoted values", async () => {
		const result = await detectHost(
			makeDeps({
				readOsRelease: async () => 'NAME="Debian GNU/Linux"\nVERSION_ID="13"\n',
			}),
		);
		expect(result.distro).toBe("Debian GNU/Linux");
		expect(result.version).toBe("13");
	});

	it("parses NAME from single-quoted values", async () => {
		const result = await detectHost(
			makeDeps({
				readOsRelease: async () => "NAME='Ubuntu'\nVERSION_ID='22.04'\n",
			}),
		);
		expect(result.distro).toBe("Ubuntu");
		expect(result.version).toBe("22.04");
	});

	it("ignores unrelated keys", async () => {
		const result = await detectHost(
			makeDeps({
				readOsRelease: async () =>
					'ID=debian\nNAME="Debian GNU/Linux"\nVERSION_ID="13"\nPRETTY_NAME="Debian 13"\n',
			}),
		);
		expect(result.distro).toBe("Debian GNU/Linux");
		expect(result.version).toBe("13");
	});
});

describe("linux distro detection — missing /etc/os-release", () => {
	it("returns platform and arch without distro when readOsRelease throws", async () => {
		const result = await detectHost(
			makeDeps({
				readOsRelease: async () => {
					throw new Error("ENOENT: no such file or directory");
				},
			}),
		);
		expect(result.platform).toBe("linux");
		expect(result.arch).toBe("x86");
		expect(result.distro).toBeUndefined();
		expect(result.version).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Non-Linux: no distro fields
// ---------------------------------------------------------------------------

describe("non-linux platforms — no distro fields", () => {
	it("does not include distro on mac", async () => {
		const result = await detectHost(
			makeDeps({
				platform: "darwin",
				readOsRelease: async () => {
					throw new Error("should not be called");
				},
			}),
		);
		expect(result.distro).toBeUndefined();
		expect(result.version).toBeUndefined();
	});

	it("does not include distro on windows", async () => {
		const result = await detectHost(
			makeDeps({
				platform: "win32",
				readOsRelease: async () => {
					throw new Error("should not be called");
				},
			}),
		);
		expect(result.distro).toBeUndefined();
		expect(result.version).toBeUndefined();
	});
});
