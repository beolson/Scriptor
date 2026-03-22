import { describe, expect, it } from "bun:test";
import type { ReleaseAsset } from "../github/githubClient.js";
import type { UpdateServiceDeps } from "./updateService.js";
import { checkForUpdate, downloadUpdate, UpdateInfo } from "./updateService.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CURRENT_VERSION = "1.2.3";
const OLDER_TAG = "v1.2.2";
const SAME_TAG = "v1.2.3";
const NEWER_TAG = "v1.3.0";

const ASSET_LINUX_X64: ReleaseAsset = {
	name: "scriptor-linux-x64",
	downloadUrl: "https://github.com/releases/download/v1.3.0/scriptor-linux-x64",
};

const ASSET_DARWIN_ARM64: ReleaseAsset = {
	name: "scriptor-darwin-arm64",
	downloadUrl:
		"https://github.com/releases/download/v1.3.0/scriptor-darwin-arm64",
};

function makeDeps(
	overrides: Partial<UpdateServiceDeps> = {},
): UpdateServiceDeps {
	return {
		fetchLatestRelease: async () => ({
			tag: NEWER_TAG,
			assets: [ASSET_LINUX_X64, ASSET_DARWIN_ARM64],
		}),
		downloadBinary: async (_url, destPath) => {
			return destPath;
		},
		chmod: async (_path) => {},
		spawn: (_cmd, _args) => ({ exited: Promise.resolve(0) }),
		currentVersion: CURRENT_VERSION,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// checkForUpdate
// ---------------------------------------------------------------------------

describe("checkForUpdate — up to date", () => {
	it("returns null when latest tag equals current VERSION", async () => {
		const deps = makeDeps({
			fetchLatestRelease: async () => ({
				tag: SAME_TAG,
				assets: [ASSET_LINUX_X64],
			}),
		});
		const result = await checkForUpdate(deps);
		expect(result).toBeNull();
	});

	it("returns null when latest tag is older than current VERSION", async () => {
		const deps = makeDeps({
			fetchLatestRelease: async () => ({
				tag: OLDER_TAG,
				assets: [ASSET_LINUX_X64],
			}),
		});
		const result = await checkForUpdate(deps);
		expect(result).toBeNull();
	});
});

describe("checkForUpdate — newer version available", () => {
	it("returns UpdateInfo when latest tag is newer", async () => {
		const deps = makeDeps({
			fetchLatestRelease: async () => ({
				tag: NEWER_TAG,
				assets: [ASSET_LINUX_X64, ASSET_DARWIN_ARM64],
			}),
		});
		const result = await checkForUpdate(deps);
		expect(result).not.toBeNull();
		expect(result).toBeInstanceOf(UpdateInfo);
	});

	it("UpdateInfo contains the latest tag", async () => {
		const deps = makeDeps({
			fetchLatestRelease: async () => ({
				tag: NEWER_TAG,
				assets: [ASSET_LINUX_X64],
			}),
		});
		const result = await checkForUpdate(deps);
		expect(result?.latestTag).toBe(NEWER_TAG);
	});

	it("UpdateInfo contains the release assets", async () => {
		const deps = makeDeps({
			fetchLatestRelease: async () => ({
				tag: NEWER_TAG,
				assets: [ASSET_LINUX_X64, ASSET_DARWIN_ARM64],
			}),
		});
		const result = await checkForUpdate(deps);
		expect(result?.assets).toHaveLength(2);
	});
});

describe("checkForUpdate — semver handles v prefix", () => {
	it("correctly compares tag 'v1.3.0' against current '1.2.3'", async () => {
		const deps = makeDeps({
			currentVersion: "1.2.3",
			fetchLatestRelease: async () => ({
				tag: "v1.3.0",
				assets: [ASSET_LINUX_X64],
			}),
		});
		const result = await checkForUpdate(deps);
		expect(result).not.toBeNull();
	});

	it("correctly handles tag without v prefix ('1.3.0')", async () => {
		const deps = makeDeps({
			currentVersion: "1.2.3",
			fetchLatestRelease: async () => ({
				tag: "1.3.0",
				assets: [ASSET_LINUX_X64],
			}),
		});
		const result = await checkForUpdate(deps);
		expect(result).not.toBeNull();
	});

	it("handles current version with v prefix in tag comparison", async () => {
		const deps = makeDeps({
			currentVersion: "1.3.0",
			fetchLatestRelease: async () => ({
				tag: "v1.2.9",
				assets: [ASSET_LINUX_X64],
			}),
		});
		const result = await checkForUpdate(deps);
		expect(result).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// downloadUpdate
// ---------------------------------------------------------------------------

describe("downloadUpdate — success", () => {
	it("downloads the asset and returns the destination path", async () => {
		const capturedDownloads: Array<{ url: string; dest: string }> = [];
		const deps = makeDeps({
			downloadBinary: async (url, destPath) => {
				capturedDownloads.push({ url, dest: destPath });
				return destPath;
			},
		});

		const result = await downloadUpdate(ASSET_LINUX_X64, deps);
		expect(result).toContain("scriptor.new");
		expect(capturedDownloads).toHaveLength(1);
		// biome-ignore lint/style/noNonNullAssertion: length asserted above
		expect(capturedDownloads[0]!.url).toBe(ASSET_LINUX_X64.downloadUrl);
	});

	it("writes to ~/.scriptor/scriptor.new", async () => {
		let capturedDest = "";
		const deps = makeDeps({
			downloadBinary: async (_url, destPath) => {
				capturedDest = destPath;
				return destPath;
			},
		});

		await downloadUpdate(ASSET_LINUX_X64, deps);
		expect(capturedDest).toContain(".scriptor");
		expect(capturedDest).toContain("scriptor.new");
	});

	it("returns the destination path", async () => {
		const deps = makeDeps({
			downloadBinary: async (_url, destPath) => {
				return destPath;
			},
		});

		const result = await downloadUpdate(ASSET_LINUX_X64, deps);
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// applyUpdate — tested via applyUpdateHandler
// ---------------------------------------------------------------------------
// applyUpdate calls Bun.spawn and process.exit — integration-level behaviour.
// We verify the handler separately in applyUpdateHandler.test.ts.
