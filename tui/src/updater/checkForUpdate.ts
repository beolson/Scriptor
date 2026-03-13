import type { HostInfo } from "../host/detectHost.js";

export const SCRIPTOR_REPO = "beolson/Scriptor";

export interface UpdateInfo {
	currentVersion: string;
	latestVersion: string;
	downloadUrl: string;
	assetName: string;
}

export interface CheckForUpdateDeps {
	getLatestRelease(repo: string): Promise<{
		tagName: string;
		assets: Array<{ name: string; browserDownloadUrl: string }>;
	} | null>;
}

/**
 * Compares two semver-like version strings numerically, segment by segment.
 * Strips a leading "v" if present. Returns true if `latest` is newer than `current`.
 */
export function isNewerVersion(current: string, latest: string): boolean {
	const parse = (v: string) =>
		v
			.replace(/^v/, "")
			.split(".")
			.map((n) => Number.parseInt(n, 10) || 0);

	const c = parse(current);
	const l = parse(latest);
	const len = Math.max(c.length, l.length);

	for (let i = 0; i < len; i++) {
		const cv = c[i] ?? 0;
		const lv = l[i] ?? 0;
		if (lv > cv) return true;
		if (lv < cv) return false;
	}
	return false;
}

/**
 * Returns the release asset filename for the given platform/arch combination.
 */
export function assetNameForHost(
	platform: HostInfo["platform"],
	arch: HostInfo["arch"],
): string {
	if (platform === "linux") {
		return arch === "arm" ? "scriptor-linux-arm64" : "scriptor-linux-x64";
	}
	if (platform === "mac") {
		return arch === "arm" ? "scriptor-darwin-arm64" : "scriptor-darwin-x64";
	}
	// windows
	return arch === "arm"
		? "scriptor-windows-arm64.exe"
		: "scriptor-windows-x64.exe";
}

/**
 * Checks GitHub releases for a version newer than `currentVersion`.
 * Returns `null` if already up-to-date, no releases exist, or no matching asset is found.
 */
export async function checkForUpdate(
	currentVersion: string,
	hostInfo: HostInfo,
	deps: CheckForUpdateDeps,
): Promise<UpdateInfo | null> {
	const release = await deps.getLatestRelease(SCRIPTOR_REPO);
	if (release === null) return null;

	const latestVersion = release.tagName.replace(/^v/, "");
	if (!isNewerVersion(currentVersion, release.tagName)) return null;

	const assetName = assetNameForHost(hostInfo.platform, hostInfo.arch);
	const asset = release.assets.find((a) => a.name === assetName);
	if (!asset) return null;

	return {
		currentVersion,
		latestVersion,
		downloadUrl: asset.browserDownloadUrl,
		assetName,
	};
}
