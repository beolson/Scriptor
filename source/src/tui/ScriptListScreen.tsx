import { Box, Text, useApp, useInput } from "ink";
import { useState } from "react";
import type { HostInfo } from "../host/detectHost.js";
import { filterManifest } from "../manifest/filterManifest.js";
import type { ScriptEntry } from "../manifest/parseManifest.js";
import { parseManifest } from "../manifest/parseManifest.js";
import {
	MissingDependencyError,
	resolveDependencies,
} from "../manifest/resolveDependencies.js";
import type { StartupResult } from "../startup/startup.js";

export interface ScriptListScreenProps {
	hostInfo: HostInfo;
	startupResult: StartupResult;
	/** Called when the user confirms their selection with Enter. */
	onConfirm: (resolvedScripts: ScriptEntry[]) => void;
}

/**
 * Builds a human-readable label for the host, used in the empty-state message.
 * e.g. "Ubuntu 24.04 x86" or "mac arm"
 */
function buildHostLabel(host: HostInfo): string {
	const parts: string[] = [];
	if (host.platform === "linux" && host.distro !== undefined) {
		parts.push(host.distro);
		if (host.version !== undefined) {
			parts.push(host.version);
		}
	} else {
		parts.push(host.platform);
	}
	parts.push(host.arch);
	return parts.join(" ");
}

/**
 * Scrollable multi-select script list filtered to the current host platform.
 *
 * - ↑/↓ navigate the list.
 * - Space toggles selection on the focused item.
 *   - When a script is selected, its dependencies are auto-selected.
 *   - When deselected, dependencies that are no longer needed are also
 *     deselected (unless they were explicitly selected by the user).
 * - Enter advances to the Confirmation screen (requires ≥1 explicit selection).
 * - Q / Ctrl+C quits the application.
 *
 * Inline errors are shown when a dependency is unavailable for the host.
 */
export function ScriptListScreen({
	hostInfo,
	startupResult,
	onConfirm,
}: ScriptListScreenProps) {
	const { exit } = useApp();

	// Parse + filter the manifest on first render.
	const [available] = useState<ScriptEntry[]>(() => {
		try {
			const all = parseManifest(startupResult.manifestYaml);
			return filterManifest(all, hostInfo);
		} catch {
			return [];
		}
	});

	// Cursor position in the list.
	const [cursor, setCursor] = useState(0);

	// Set of script IDs explicitly selected by the user (not auto-selected deps).
	const [userSelected, setUserSelected] = useState<Set<string>>(new Set());

	// Inline error message shown when a dependency is unavailable.
	const [inlineError, setInlineError] = useState<string | null>(null);

	// Derive the full resolved selection (explicit + auto-selected deps) and any
	// error that prevents the current toggle from completing.
	const resolvedIds = new Set<string>();
	let resolveError: string | null = null;

	if (userSelected.size > 0) {
		try {
			const resolved = resolveDependencies(Array.from(userSelected), available);
			for (const entry of resolved) {
				resolvedIds.add(entry.id);
			}
		} catch (err) {
			if (err instanceof MissingDependencyError) {
				resolveError = `Dependency "${err.missingId}" is not available for this host`;
			} else if (err instanceof Error) {
				resolveError = err.message;
			} else {
				resolveError = String(err);
			}
		}
	}

	useInput((input, key) => {
		// Global quit
		if (input === "q" || (key.ctrl && input === "c")) {
			exit();
			return;
		}

		if (available.length === 0) return;

		// Navigation
		if (key.upArrow) {
			setCursor((c) => Math.max(0, c - 1));
			setInlineError(null);
			return;
		}
		if (key.downArrow) {
			setCursor((c) => Math.min(available.length - 1, c + 1));
			setInlineError(null);
			return;
		}

		// Space: toggle selection
		if (input === " ") {
			const focused = available[cursor];
			if (focused === undefined) return;

			const next = new Set(userSelected);
			if (next.has(focused.id)) {
				// Deselect
				next.delete(focused.id);
			} else {
				// Select: validate that all dependencies are available first.
				const testSelection = new Set(next);
				testSelection.add(focused.id);
				try {
					resolveDependencies(Array.from(testSelection), available);
					next.add(focused.id);
					setInlineError(null);
				} catch (err) {
					if (err instanceof MissingDependencyError) {
						setInlineError(
							`Cannot select "${focused.name}": dependency "${err.missingId}" is not available for this host`,
						);
					} else if (err instanceof Error) {
						setInlineError(err.message);
					} else {
						setInlineError(String(err));
					}
					return;
				}
			}
			setUserSelected(next);
			return;
		}

		// Enter: confirm
		if (key.return) {
			if (userSelected.size === 0) return;
			if (resolveError !== null) {
				setInlineError(resolveError);
				return;
			}
			try {
				const resolved = resolveDependencies(
					Array.from(userSelected),
					available,
				);
				onConfirm(resolved);
			} catch (err) {
				if (err instanceof Error) {
					setInlineError(err.message);
				} else {
					setInlineError(String(err));
				}
			}
		}
	});

	if (available.length === 0) {
		const label = buildHostLabel(hostInfo);
		return (
			<Box flexDirection="column" gap={1}>
				<Text dimColor={true}>{`No scripts available for ${label}`}</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" gap={0}>
			{available.map((entry, index) => {
				const isFocused = index === cursor;
				const isUserSelected = userSelected.has(entry.id);
				const isAutoSelected = !isUserSelected && resolvedIds.has(entry.id);

				// Determine marker character.
				let marker: string;
				if (isUserSelected) {
					marker = "[x]";
				} else if (isAutoSelected) {
					marker = "[~]";
				} else {
					marker = "[ ]";
				}

				// Row colour:
				//   focused   → bold
				//   selected  → green
				//   auto-dep  → cyan (dim)
				//   otherwise → default
				const color = isUserSelected
					? "green"
					: isAutoSelected
						? "cyan"
						: undefined;

				return (
					<Box key={entry.id} flexDirection="row" gap={1}>
						<Text bold={isFocused} color={isFocused ? "blue" : undefined}>
							{isFocused ? ">" : " "}
						</Text>
						<Text bold={isFocused} color={color}>
							{`${marker} ${entry.name}`}
						</Text>
						{isAutoSelected && (
							<Text dimColor={true}>(auto-selected dependency)</Text>
						)}
					</Box>
				);
			})}

			{/* Focused item description */}
			{available[cursor] !== undefined && (
				<Box marginTop={1}>
					<Text dimColor={true}>{available[cursor]?.description}</Text>
				</Box>
			)}

			{/* Inline error */}
			{(inlineError ?? resolveError) !== null && (
				<Box marginTop={1}>
					<Text color="red">{inlineError ?? resolveError}</Text>
				</Box>
			)}

			{/* Hint */}
			{userSelected.size === 0 && inlineError === null && (
				<Box marginTop={1}>
					<Text dimColor={true}>
						Select scripts with Space, then press Enter.
					</Text>
				</Box>
			)}
		</Box>
	);
}
