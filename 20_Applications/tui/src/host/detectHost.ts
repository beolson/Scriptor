import type { HostInfo } from "../types.js";

export type { HostInfo };

export interface DetectHostDeps {
	platform?: string;
	arch?: string;
	readFile?: (path: string) => Promise<string>;
}

function parseOsRelease(content: string): { name?: string; version?: string } {
	const result: { name?: string; version?: string } = {};
	for (const line of content.split("\n")) {
		const nameMatch = line.match(/^NAME=(.+)$/);
		if (nameMatch?.[1] !== undefined) {
			result.name = nameMatch[1].replace(/^["']|["']$/g, "");
		}
		const versionMatch = line.match(/^VERSION_ID=(.+)$/);
		if (versionMatch?.[1] !== undefined) {
			result.version = versionMatch[1].replace(/^["']|["']$/g, "");
		}
	}
	return result;
}

function resolveArch(rawArch: string): "x64" | "arm" {
	if (rawArch === "arm64" || rawArch === "arm") {
		return "arm";
	}
	return "x64";
}

export async function detectHost(deps?: DetectHostDeps): Promise<HostInfo> {
	const platform = deps?.platform ?? process.platform;
	const rawArch = deps?.arch ?? process.arch;
	const readFile = deps?.readFile ?? ((path: string) => Bun.file(path).text());

	const arch = resolveArch(rawArch);

	if (platform === "darwin") {
		return { osName: "mac", arch };
	}

	if (platform === "win32") {
		return { osName: "windows", arch };
	}

	if (platform === "linux") {
		try {
			const content = await readFile("/etc/os-release");
			const { name, version } = parseOsRelease(content);
			return { osName: name, osVersion: version, arch };
		} catch {
			return { arch };
		}
	}

	return { arch };
}
