import type { HostInfo } from "../host/detectHost";
import type { ScriptEntry } from "./parseManifest";

/**
 * Filters a parsed manifest down to entries that match the current host.
 *
 * Matching rules:
 * - `platform` must match exactly.
 * - `arch` must match exactly.
 * - For Linux entries: `distro` and `version` must also match (case-insensitive
 *   for distro). If the host is Linux but has no distro/version info, all Linux
 *   entries are excluded.
 * - For non-Linux entries: `distro`/`version` are not considered.
 *
 * Returns an empty array (never throws) when nothing matches.
 */
export function filterManifest(
	entries: ScriptEntry[],
	host: HostInfo,
): ScriptEntry[] {
	return entries.filter((entry) => {
		if (entry.platform !== host.platform) return false;
		if (entry.arch !== host.arch) return false;

		if (entry.platform === "linux") {
			// Both host and entry must have distro and version for a match.
			if (host.distro === undefined || host.version === undefined) return false;
			if (
				entry.distro === undefined ||
				entry.distro.toLowerCase() !== host.distro.toLowerCase()
			) {
				return false;
			}
			if (entry.version !== host.version) return false;
		}

		return true;
	});
}
