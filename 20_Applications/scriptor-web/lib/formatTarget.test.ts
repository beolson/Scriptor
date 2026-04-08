import { describe, expect, it } from "vitest";
import { formatTarget } from "./formatTarget.js";

describe("formatTarget()", () => {
	it('converts "debian-13-x64" to "Debian 13 X64"', () => {
		expect(formatTarget("debian-13-x64")).toBe("Debian 13 X64");
	});

	it('converts "macos-tahoe-arm64" to "Macos Tahoe Arm64"', () => {
		expect(formatTarget("macos-tahoe-arm64")).toBe("Macos Tahoe Arm64");
	});

	it('converts "windows-11-x64" to "Windows 11 X64"', () => {
		expect(formatTarget("windows-11-x64")).toBe("Windows 11 X64");
	});

	it('converts single-word "linux" to "Linux"', () => {
		expect(formatTarget("linux")).toBe("Linux");
	});

	it('converts "ubuntu-24.04-x64" to "Ubuntu 24.04 X64"', () => {
		expect(formatTarget("ubuntu-24.04-x64")).toBe("Ubuntu 24.04 X64");
	});

	it('converts "macos-sequoia-arm64" to "Macos Sequoia Arm64"', () => {
		expect(formatTarget("macos-sequoia-arm64")).toBe("Macos Sequoia Arm64");
	});
});
