import { chmod, rename } from "node:fs/promises";
import path from "node:path";

/**
 * Downloads the binary at `downloadUrl` and atomically replaces the running
 * binary at `currentBinaryPath`.
 *
 * On Windows, an in-process replacement is not possible; a message with
 * manual instructions is thrown instead.
 */
export async function applyUpdate(
	downloadUrl: string,
	currentBinaryPath: string,
	platform: "linux" | "mac" | "windows",
): Promise<void> {
	const dir = path.dirname(currentBinaryPath);

	if (platform === "windows") {
		const newPath = path.join(dir, "scriptor-new.exe");
		const response = await fetch(downloadUrl);
		if (!response.ok) {
			throw new Error(`Failed to download update: HTTP ${response.status}`);
		}
		const buffer = await response.arrayBuffer();
		await Bun.write(newPath, buffer);
		throw new Error(
			`Update downloaded to ${newPath}. To complete the update, close Scriptor and replace the current executable with the new one manually.`,
		);
	}

	// Linux / Mac: download to a temp file then atomically rename
	const tmpPath = path.join(dir, "scriptor-update-tmp");

	const response = await fetch(downloadUrl);
	if (!response.ok) {
		throw new Error(`Failed to download update: HTTP ${response.status}`);
	}
	const buffer = await response.arrayBuffer();
	await Bun.write(tmpPath, buffer);
	await chmod(tmpPath, 0o755);
	await rename(tmpPath, currentBinaryPath);
}
