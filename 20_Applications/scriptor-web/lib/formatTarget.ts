/**
 * Converts a machine-readable combined target identifier to a human-readable
 * display label.
 *
 * Examples:
 *   "debian-13-x64"      → "Debian 13 X64"
 *   "macos-tahoe-arm64"  → "Macos Tahoe Arm64"
 *   "windows-11-x64"     → "Windows 11 X64"
 *   "linux"              → "Linux"
 */
export function formatTarget(target: string): string {
	return target
		.split("-")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}
