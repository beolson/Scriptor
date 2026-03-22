// ---------------------------------------------------------------------------
// Binary Self-Update Service
//
// Checks for a newer Scriptor binary release, downloads it, and applies it
// via the download → exec → relaunch pattern.
//
// applyUpdate itself is integration-level (spawns processes / calls exit),
// so it is implemented here but not unit-tested via injectable deps.
// ---------------------------------------------------------------------------

import * as nodePath from "node:path";
import * as semver from "semver";
import type { LatestRelease, ReleaseAsset } from "../github/githubClient.js";
import { downloadBinary, fetchLatestRelease } from "../github/githubClient.js";

declare const VERSION: string;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Holds information about an available update.
 */
export class UpdateInfo {
	readonly latestTag: string;
	readonly assets: ReleaseAsset[];

	constructor(latestTag: string, assets: ReleaseAsset[]) {
		this.latestTag = latestTag;
		this.assets = assets;
	}
}

// ---------------------------------------------------------------------------
// Injectable deps
// ---------------------------------------------------------------------------

export interface UpdateServiceDeps {
	fetchLatestRelease: () => Promise<LatestRelease>;
	downloadBinary: (url: string, destPath: string) => Promise<string>;
	chmod: (path: string) => Promise<void>;
	spawn: (cmd: string, args: string[]) => { exited: Promise<number> };
	currentVersion: string;
}

const defaultDeps: UpdateServiceDeps = {
	fetchLatestRelease: () => fetchLatestRelease(),
	downloadBinary: async (url: string, destPath: string) => {
		await downloadBinary(url, destPath);
		return destPath;
	},
	chmod: async (path: string) => {
		const fs = await import("node:fs/promises");
		await fs.chmod(path, 0o755);
	},
	spawn: (cmd: string, args: string[]) => {
		return Bun.spawn([cmd, ...args], {
			stdio: ["inherit", "inherit", "inherit"],
		});
	},
	currentVersion: VERSION,
};

// ---------------------------------------------------------------------------
// Download path
// ---------------------------------------------------------------------------

function newBinaryPath(): string {
	const home = process.env.HOME ?? process.env.USERPROFILE ?? "~";
	return nodePath.join(home, ".scriptor", "scriptor.new");
}

// ---------------------------------------------------------------------------
// checkForUpdate
// ---------------------------------------------------------------------------

/**
 * Compares the installed binary version against the latest GitHub release tag.
 * Returns `UpdateInfo` if a newer version is available, or `null` if up to date.
 *
 * Uses `semver.gt()` — handles `v` prefix on tags automatically via semver.coerce.
 */
export async function checkForUpdate(
	deps?: Partial<UpdateServiceDeps>,
): Promise<UpdateInfo | null> {
	const resolved = { ...defaultDeps, ...deps };

	const release = await resolved.fetchLatestRelease();

	// semver.coerce handles tags like "v1.2.3" → "1.2.3"
	const latestVersion = semver.coerce(release.tag);
	if (!latestVersion) {
		return null;
	}

	const isNewer = semver.gt(latestVersion.version, resolved.currentVersion);
	if (!isNewer) {
		return null;
	}

	return new UpdateInfo(release.tag, release.assets);
}

// ---------------------------------------------------------------------------
// downloadUpdate
// ---------------------------------------------------------------------------

/**
 * Downloads the given release asset to `~/.scriptor/scriptor.new`.
 * Returns the destination path.
 */
export async function downloadUpdate(
	asset: ReleaseAsset,
	deps?: Partial<UpdateServiceDeps>,
): Promise<string> {
	const resolved = { ...defaultDeps, ...deps };
	const destPath = newBinaryPath();
	await resolved.downloadBinary(asset.downloadUrl, destPath);
	return destPath;
}

// ---------------------------------------------------------------------------
// applyUpdate
// ---------------------------------------------------------------------------

/**
 * Applies the downloaded binary by:
 *   1. chmod +x the new binary (Unix)
 *   2. Spawning the new binary with `--apply-update <currentBinaryPath>`
 *   3. Exiting the current process immediately
 *
 * This function never returns (`never`).
 */
export async function applyUpdate(
	newBinaryPath: string,
	currentBinaryPath: string,
	deps?: Partial<UpdateServiceDeps>,
): Promise<never> {
	const resolved = { ...defaultDeps, ...deps };

	await resolved.chmod(newBinaryPath);
	resolved.spawn(newBinaryPath, ["--apply-update", currentBinaryPath]);
	process.exit(0);
}
