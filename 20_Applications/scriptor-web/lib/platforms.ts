import type { Platform } from "./types.js";

export const PLATFORMS: Record<
	Platform,
	{ label: string; osValues: string[] }
> = {
	linux: {
		label: "Linux",
		osValues: [
			"ubuntu-24.04",
			"ubuntu-22.04",
			"debian-12",
			"fedora-40",
			"arch",
		],
	},
	windows: {
		label: "Windows",
		osValues: ["windows-11", "windows-10"],
	},
	mac: {
		label: "macOS",
		osValues: ["macos-sequoia", "macos-sonoma", "macos-ventura"],
	},
};
