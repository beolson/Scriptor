// ---------------------------------------------------------------------------
// Manifest Filter
//
// Narrows the full manifest to only scripts compatible with the detected host.
// Pure function — no side effects, no injectable deps required.
// ---------------------------------------------------------------------------

import type { HostInfo } from "../host/types.js";
import type { Manifest, ScriptEntry } from "./types.js";

/**
 * Returns only the entries from `manifest` that are compatible with `host`.
 *
 * Matching rules:
 * - `platform` and `arch`: exact string equality (case-sensitive)
 * - Linux entries additionally require `distro` and `version` to match host
 *   exactly (exact equality — "13" does NOT match "13.1")
 * - If `host` is Linux but `host.distro` or `host.version` is absent
 *   (unreadable /etc/os-release), all linux entries are excluded
 * - Non-linux entries are never filtered on `distro`/`version`
 */
export function filterManifest(
	manifest: Manifest,
	host: HostInfo,
): ScriptEntry[] {
	return manifest.filter((entry) => {
		// Platform and arch must always match exactly.
		if (entry.platform !== host.platform) return false;
		if (entry.arch !== host.arch) return false;

		// Linux entries additionally require distro and version to match.
		if (entry.platform === "linux") {
			// If the host is missing distro or version, exclude all linux entries.
			if (!host.distro || !host.version) return false;
			// Exact equality on both fields.
			if (entry.distro !== host.distro) return false;
			if (entry.version !== host.version) return false;
		}

		return true;
	});
}
