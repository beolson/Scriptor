export interface HostInfo {
	platform: "windows" | "linux" | "mac";
	arch: "x86" | "arm";
	distro?: string;
	version?: string;
}

/** Injectable dependencies — override in tests to avoid real OS calls. */
export interface HostDeps {
	getPlatform(): string;
	getArch(): string;
	/** Returns the raw text content of /etc/os-release, or null if absent. */
	readOsRelease(): Promise<string | null>;
}

const defaultDeps: HostDeps = {
	getPlatform: () => process.platform,
	getArch: () => process.arch,
	readOsRelease: async () => {
		const file = Bun.file("/etc/os-release");
		if (!(await file.exists())) return null;
		return file.text();
	},
};

function normalizePlatform(raw: string): "windows" | "linux" | "mac" {
	switch (raw) {
		case "win32":
			return "windows";
		case "linux":
			return "linux";
		case "darwin":
			return "mac";
		default:
			throw new Error(`Unsupported platform: "${raw}"`);
	}
}

function normalizeArch(raw: string): "x86" | "arm" {
	switch (raw) {
		case "x64":
		case "ia32":
			return "x86";
		case "arm64":
		case "arm":
			return "arm";
		default:
			throw new Error(`Unsupported architecture: "${raw}"`);
	}
}

/**
 * Parses NAME and VERSION_ID from the text content of /etc/os-release.
 * Lines have the form KEY=value or KEY="value".
 */
function parseOsRelease(text: string): { name?: string; versionId?: string } {
	const result: { name?: string; versionId?: string } = {};
	for (const line of text.split("\n")) {
		const eq = line.indexOf("=");
		if (eq === -1) continue;
		const key = line.slice(0, eq).trim();
		const raw = line.slice(eq + 1).trim();
		// Strip surrounding quotes if present
		const value =
			raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;
		if (key === "NAME") result.name = value;
		if (key === "VERSION_ID") result.versionId = value;
	}
	return result;
}

/**
 * Detects the current host's platform, architecture, and (on Linux) distro/version.
 *
 * @param deps - Optional injectable dependencies for testing.
 */
export async function detectHost(
	deps: HostDeps = defaultDeps,
): Promise<HostInfo> {
	const platform = normalizePlatform(deps.getPlatform());
	const arch = normalizeArch(deps.getArch());

	const info: HostInfo = { platform, arch };

	if (platform === "linux") {
		const text = await deps.readOsRelease();
		if (text !== null && text.length > 0) {
			const { name, versionId } = parseOsRelease(text);
			if (name !== undefined) info.distro = name;
			if (versionId !== undefined) info.version = versionId;
		}
	}

	return info;
}
