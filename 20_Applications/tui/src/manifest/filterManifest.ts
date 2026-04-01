import type { HostInfo, ScriptEntry } from "../types.js";

/**
 * Returns the subset of script entries whose `os` fields match the given host.
 *
 * Matching rules (FR-FILTER):
 * - `os.name` must exactly match `host.osName`. If `host.osName` is undefined,
 *   no entry with an `os.name` value can match.
 * - `os.version` on the entry must exactly match `host.osVersion` when present.
 *   If absent on the entry, the entry matches any host version for that os.name.
 * - `os.arch` must exactly match `host.arch`.
 *
 * Entries that fail any rule are silently excluded (no error thrown).
 * Groups are not filtered here.
 */
export function filterManifest(
	manifest: { scripts: ScriptEntry[] },
	host: HostInfo,
): ScriptEntry[] {
	return manifest.scripts.filter((entry) => {
		// os.name: must match host.osName (undefined host.osName → no match)
		if (entry.os.name !== host.osName) {
			return false;
		}

		// os.version: if present on entry, must match host.osVersion
		if (entry.os.version !== undefined && entry.os.version !== host.osVersion) {
			return false;
		}

		// os.arch: must match host.arch
		if (entry.os.arch !== host.arch) {
			return false;
		}

		return true;
	});
}
