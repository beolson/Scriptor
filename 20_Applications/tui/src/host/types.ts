// ---------------------------------------------------------------------------
// Host Detection Types
// ---------------------------------------------------------------------------

export interface HostInfo {
	/** Normalized platform identifier. */
	platform: "linux" | "mac" | "windows";
	/** Normalized architecture identifier. */
	arch: "x86" | "arm";
	/** Linux only: NAME field from /etc/os-release. Absent on non-Linux or if file is unreadable. */
	distro?: string;
	/** Linux only: VERSION_ID field from /etc/os-release. Absent on non-Linux or if file is unreadable. */
	version?: string;
}
