// ---------------------------------------------------------------------------
// Dependency Resolution
//
// Two-phase DFS topological sort:
//   Phase 1 — collect the full transitive run set via `dependencies` (hard edges)
//   Phase 2 — DFS post-order topological sort using both `dependencies` (hard)
//             and `optional_dependencies` entries that are in the run set (soft)
//
// Throws MissingDependencyError for unknown hard dependency IDs.
// Throws CircularDependencyError when a cycle is detected.
// ---------------------------------------------------------------------------

import type { Manifest, ScriptEntry } from "./types.js";
import { CircularDependencyError, MissingDependencyError } from "./types.js";

// ---------------------------------------------------------------------------
// resolveDependencies
// ---------------------------------------------------------------------------

/**
 * Given a set of selected script IDs and the full list of available scripts,
 * returns an ordered array of IDs where every script's predecessors appear
 * before it.
 *
 * - Phase 1: DFS from each selected ID following `dependencies` to build the
 *   full transitive run set.
 * - Phase 2: DFS post-order topological sort; hard edges = `dependencies`;
 *   soft edges = `optional_dependencies` entries **also in the run set**
 *   (silently ignored otherwise).
 *
 * @throws {MissingDependencyError} if a `dependencies` entry is not in `available`
 * @throws {CircularDependencyError} if a cycle is detected in the `dependencies` graph
 */
export function resolveDependencies(
	selectedIds: string[],
	available: Manifest,
): string[] {
	// Build a fast ID → entry lookup map.
	const availableMap = new Map<string, ScriptEntry>(
		available.map((e) => [e.id, e]),
	);

	// -------------------------------------------------------------------------
	// Phase 1: collect full transitive run set via hard dependencies (DFS)
	// -------------------------------------------------------------------------

	const runSet = new Set<string>();

	function collectRunSet(id: string, stack: string[]): void {
		if (runSet.has(id)) return;

		const script = availableMap.get(id);
		if (!script) {
			throw new MissingDependencyError(
				`Dependency "${id}" is not available for this host`,
			);
		}

		runSet.add(id);

		for (const depId of script.dependencies) {
			collectRunSet(depId, stack);
		}
	}

	for (const id of selectedIds) {
		collectRunSet(id, []);
	}

	// -------------------------------------------------------------------------
	// Phase 2: topological sort using post-order DFS
	// -------------------------------------------------------------------------

	const visited = new Set<string>();
	const inProgress = new Set<string>();
	const ordered: string[] = [];

	function visit(id: string, path: string[]): void {
		if (visited.has(id)) return;

		if (inProgress.has(id)) {
			// Reconstruct cycle path for the error message.
			const cycleStart = path.indexOf(id);
			const cyclePath = [...path.slice(cycleStart), id];
			throw new CircularDependencyError(
				`Circular dependency detected: ${cyclePath.join(" → ")}`,
			);
		}

		// Phase 1 guarantees id is in availableMap; the get is always defined here.
		const script = availableMap.get(id);
		if (!script) return;

		inProgress.add(id);
		const currentPath = [...path, id];

		// Hard edges first.
		for (const depId of script.dependencies) {
			visit(depId, currentPath);
		}

		// Soft edges — only when the dep is also in the run set.
		for (const depId of script.optional_dependencies) {
			if (runSet.has(depId)) {
				visit(depId, currentPath);
			}
		}

		inProgress.delete(id);
		visited.add(id);
		ordered.push(id);
	}

	for (const id of runSet) {
		visit(id, []);
	}

	return ordered;
}
