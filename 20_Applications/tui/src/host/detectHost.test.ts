import { describe, expect, it } from "bun:test";
import { detectHost } from "./detectHost.js";

const FULL_OS_RELEASE = `
NAME="Ubuntu"
VERSION_ID="22.04"
ID=ubuntu
ID_LIKE=debian
`.trim();

const NO_VERSION_OS_RELEASE = `
NAME="Arch Linux"
ID=arch
`.trim();

const QUOTED_NAME_OS_RELEASE = `
NAME="Fedora Linux"
VERSION_ID="38"
`.trim();

describe("detectHost()", () => {
	it("linux with full os-release → correct osName and osVersion", async () => {
		const result = await detectHost({
			platform: "linux",
			arch: "x64",
			readFile: async () => FULL_OS_RELEASE,
		});
		expect(result.osName).toBe("Ubuntu");
		expect(result.osVersion).toBe("22.04");
		expect(result.arch).toBe("x64");
	});

	it("linux with no VERSION_ID → osVersion is undefined", async () => {
		const result = await detectHost({
			platform: "linux",
			arch: "x64",
			readFile: async () => NO_VERSION_OS_RELEASE,
		});
		expect(result.osName).toBe("Arch Linux");
		expect(result.osVersion).toBeUndefined();
	});

	it("linux with missing file (readFile throws) → both fields undefined, no throw", async () => {
		const result = await detectHost({
			platform: "linux",
			arch: "x64",
			readFile: async () => {
				throw new Error("ENOENT: no such file or directory");
			},
		});
		expect(result.osName).toBeUndefined();
		expect(result.osVersion).toBeUndefined();
		expect(result.arch).toBe("x64");
	});

	it("darwin → osName is 'mac', no osVersion", async () => {
		const result = await detectHost({
			platform: "darwin",
			arch: "x64",
			readFile: async () => {
				throw new Error("should not be called");
			},
		});
		expect(result.osName).toBe("mac");
		expect(result.osVersion).toBeUndefined();
	});

	it("win32 → osName is 'windows', no osVersion", async () => {
		const result = await detectHost({
			platform: "win32",
			arch: "x64",
			readFile: async () => {
				throw new Error("should not be called");
			},
		});
		expect(result.osName).toBe("windows");
		expect(result.osVersion).toBeUndefined();
	});

	it("arm64 arch → 'arm'", async () => {
		const result = await detectHost({
			platform: "darwin",
			arch: "arm64",
			readFile: async () => {
				throw new Error("should not be called");
			},
		});
		expect(result.arch).toBe("arm");
	});

	it("arm arch → 'arm'", async () => {
		const result = await detectHost({
			platform: "linux",
			arch: "arm",
			readFile: async () => FULL_OS_RELEASE,
		});
		expect(result.arch).toBe("arm");
	});

	it("x64 arch → 'x64'", async () => {
		const result = await detectHost({
			platform: "linux",
			arch: "x64",
			readFile: async () => FULL_OS_RELEASE,
		});
		expect(result.arch).toBe("x64");
	});

	it("unknown arch → 'x64'", async () => {
		const result = await detectHost({
			platform: "linux",
			arch: "mips",
			readFile: async () => FULL_OS_RELEASE,
		});
		expect(result.arch).toBe("x64");
	});

	it("quoted NAME value is stripped correctly", async () => {
		const result = await detectHost({
			platform: "linux",
			arch: "x64",
			readFile: async () => QUOTED_NAME_OS_RELEASE,
		});
		expect(result.osName).toBe("Fedora Linux");
		expect(result.osVersion).toBe("38");
	});
});
