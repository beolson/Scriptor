// ---------------------------------------------------------------------------
// Host Detection
//
// Detects platform, architecture, and (on Linux) distro/version.
// All I/O is injectable so this module can be unit-tested without
// touching real filesystem or process globals.
// ---------------------------------------------------------------------------

import type { HostInfo } from "./types.js";

// ---------------------------------------------------------------------------
// Injectable deps
// ---------------------------------------------------------------------------

export interface DetectHostDeps {
	/** Value of process.platform at call time. */
	platform: string;
	/** Value of process.arch at call time. */
	arch: string;
	/** Reads the raw contents of /etc/os-release. Throws on missing/unreadable. */
	readOsRelease: () => Promise<string>;
}

const defaultDeps: DetectHostDeps = {
	platform: process.platform,
	arch: process.arch,
	readOsRelease: () => Bun.file("/etc/os-release").text(),
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function mapPlatform(p: string): "linux" | "mac" | "windows" {
	if (p === "darwin") return "mac";
	if (p === "win32") return "windows";
	return "linux";
}

function mapArch(a: string): "x86" | "arm" {
	if (a === "arm64" || a === "arm") return "arm";
	return "x86";
}

/**
 * Parses the KEY=value lines in /etc/os-release.
 * Strips surrounding single or double quotes from values.
 */
function parseOsRelease(content: string): {
	distro?: string;
	version?: string;
} {
	let distro: string | undefined;
	let version: string | undefined;

	for (const line of content.split("\n")) {
		const m = line.match(/^(\w+)=(.*)$/);
		if (!m) continue;
		const [, key, rawVal] = m;
		if (!key || rawVal === undefined) continue;
		const val = rawVal.replace(/^["']|["']$/g, "");
		if (key === "NAME") distro = val;
		if (key === "VERSION_ID") version = val;
	}

	return { distro, version };
}

// ---------------------------------------------------------------------------
// detectHost
// ---------------------------------------------------------------------------

/**
 * Returns the normalized HostInfo for the current machine.
 *
 * On Linux, attempts to read /etc/os-release for distro and version.
 * If the file is missing or unreadable, distro and version are omitted
 * but the function still succeeds.
 */
export async function detectHost(
	deps: DetectHostDeps = defaultDeps,
): Promise<HostInfo> {
	const platform = mapPlatform(deps.platform);
	const arch = mapArch(deps.arch);

	if (platform !== "linux") {
		return { platform, arch };
	}

	try {
		const content = await deps.readOsRelease();
		const { distro, version } = parseOsRelease(content);
		return { platform, arch, distro, version };
	} catch {
		// File missing or unreadable — return without distro/version.
		return { platform, arch };
	}
}
