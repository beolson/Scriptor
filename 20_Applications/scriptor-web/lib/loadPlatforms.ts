import { readFile as fsReadFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Maps platform target values (e.g. "ubuntu-24.04-x64") to display names. */
export type PlatformMap = Record<string, string>;

function platformsPath(): string {
	return resolve(
		dirname(fileURLToPath(import.meta.url)),
		"../../..",
		"scripts",
		"platforms.json",
	);
}

function readJson(path: string): Promise<string> {
	if (typeof Bun !== "undefined") {
		return Bun.file(path).text();
	}
	return fsReadFile(path, "utf8");
}

/**
 * Reads scripts/platforms.json and returns the platform → display name map.
 * Returns an empty object if the file cannot be read.
 */
export async function loadPlatforms(): Promise<PlatformMap> {
	try {
		const text = await readJson(platformsPath());
		return JSON.parse(text) as PlatformMap;
	} catch (err) {
		console.warn(
			`[loadPlatforms] Could not read platforms.json: ${(err as Error).message}`,
		);
		return {};
	}
}
