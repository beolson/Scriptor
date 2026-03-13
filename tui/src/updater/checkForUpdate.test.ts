import { describe, expect, test } from "bun:test";
import {
	assetNameForHost,
	type CheckForUpdateDeps,
	checkForUpdate,
	isNewerVersion,
} from "./checkForUpdate.js";

// ─── isNewerVersion ───────────────────────────────────────────────────────────

describe("isNewerVersion", () => {
	test("returns true when latest has higher patch", () => {
		expect(isNewerVersion("1.0.0", "1.0.1")).toBe(true);
	});

	test("returns true when latest has higher minor", () => {
		expect(isNewerVersion("1.0.0", "1.1.0")).toBe(true);
	});

	test("returns true when latest has higher major", () => {
		expect(isNewerVersion("1.0.0", "2.0.0")).toBe(true);
	});

	test("returns false when versions are equal", () => {
		expect(isNewerVersion("1.2.3", "1.2.3")).toBe(false);
	});

	test("returns false when current is newer", () => {
		expect(isNewerVersion("2.0.0", "1.9.9")).toBe(false);
	});

	test("strips leading v from latest", () => {
		expect(isNewerVersion("1.0.0", "v1.0.1")).toBe(true);
	});

	test("strips leading v from current", () => {
		expect(isNewerVersion("v1.0.0", "1.0.1")).toBe(true);
	});

	test("handles different segment counts", () => {
		expect(isNewerVersion("1.0", "1.0.1")).toBe(true);
		expect(isNewerVersion("1.0.1", "1.0")).toBe(false);
	});
});

// ─── assetNameForHost ─────────────────────────────────────────────────────────

describe("assetNameForHost", () => {
	test("linux x86 → scriptor-linux-x64", () => {
		expect(assetNameForHost("linux", "x86")).toBe("scriptor-linux-x64");
	});

	test("linux arm → scriptor-linux-arm64", () => {
		expect(assetNameForHost("linux", "arm")).toBe("scriptor-linux-arm64");
	});

	test("mac x86 → scriptor-darwin-x64", () => {
		expect(assetNameForHost("mac", "x86")).toBe("scriptor-darwin-x64");
	});

	test("mac arm → scriptor-darwin-arm64", () => {
		expect(assetNameForHost("mac", "arm")).toBe("scriptor-darwin-arm64");
	});

	test("windows x86 → scriptor-windows-x64.exe", () => {
		expect(assetNameForHost("windows", "x86")).toBe("scriptor-windows-x64.exe");
	});

	test("windows arm → scriptor-windows-arm64.exe", () => {
		expect(assetNameForHost("windows", "arm")).toBe(
			"scriptor-windows-arm64.exe",
		);
	});
});

// ─── checkForUpdate ───────────────────────────────────────────────────────────

describe("checkForUpdate", () => {
	const hostInfo = { platform: "linux" as const, arch: "x86" as const };

	const makeRelease = (tagName: string) => ({
		tagName,
		assets: [
			{
				name: "scriptor-linux-x64",
				browserDownloadUrl:
					"https://github.com/beolson/Scriptor/releases/download/v1.1.0/scriptor-linux-x64",
			},
		],
	});

	test("returns UpdateInfo when a newer version is available", async () => {
		const deps: CheckForUpdateDeps = {
			getLatestRelease: async () => makeRelease("v1.1.0"),
		};

		const result = await checkForUpdate("1.0.0", hostInfo, deps);

		expect(result).not.toBeNull();
		expect(result?.currentVersion).toBe("1.0.0");
		expect(result?.latestVersion).toBe("1.1.0");
		expect(result?.assetName).toBe("scriptor-linux-x64");
		expect(result?.downloadUrl).toContain("scriptor-linux-x64");
	});

	test("returns null when already up-to-date", async () => {
		const deps: CheckForUpdateDeps = {
			getLatestRelease: async () => makeRelease("v1.0.0"),
		};

		const result = await checkForUpdate("1.0.0", hostInfo, deps);
		expect(result).toBeNull();
	});

	test("returns null when no releases exist (getLatestRelease returns null)", async () => {
		const deps: CheckForUpdateDeps = {
			getLatestRelease: async () => null,
		};

		const result = await checkForUpdate("1.0.0", hostInfo, deps);
		expect(result).toBeNull();
	});

	test("returns null when no matching asset for platform/arch", async () => {
		const deps: CheckForUpdateDeps = {
			getLatestRelease: async () => ({
				tagName: "v2.0.0",
				assets: [
					{
						name: "scriptor-darwin-x64",
						browserDownloadUrl: "https://example.com/scriptor-darwin-x64",
					},
				],
			}),
		};

		const result = await checkForUpdate("1.0.0", hostInfo, deps);
		expect(result).toBeNull();
	});

	test("propagates errors from getLatestRelease", async () => {
		const deps: CheckForUpdateDeps = {
			getLatestRelease: async () => {
				throw new Error("network error");
			},
		};

		await expect(checkForUpdate("1.0.0", hostInfo, deps)).rejects.toThrow(
			"network error",
		);
	});
});
