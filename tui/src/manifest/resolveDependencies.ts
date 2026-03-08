import type { ScriptEntry } from "./parseManifest";

/**
 * Thrown when a script declares a dependency that is not present in the
 * host-filtered manifest (i.e. not available for the current platform).
 */
export class MissingDependencyError extends Error {
	readonly missingId: string;

	constructor(missingId: string, dependentId?: string) {
		const where = dependentId ? ` (required by "${dependentId}")` : "";
		super(`Dependency "${missingId}"${where} is not available for this host`);
		this.name = "MissingDependencyError";
		this.missingId = missingId;
	}
}

/**
 * Thrown when a circular dependency is detected among the selected scripts.
 */
export class CircularDependencyError extends Error {
	constructor(cycle: string[]) {
		super(`Circular dependency detected: ${cycle.join(" → ")}`);
		this.name = "CircularDependencyError";
	}
}

/**
 * Resolves the ordered execution list for a selection of scripts, respecting
 * declared dependencies via a depth-first topological sort.
 *
 * - Returns scripts in dependency-first order (leaves before roots).
 * - Deduplicates: each script appears at most once.
 * - Preserves the relative order of independently selected scripts.
 * - Throws `MissingDependencyError` if a declared dependency is absent from
 *   `available`.
 * - Throws `CircularDependencyError` if a dependency cycle is detected.
 *
 * @param selected  IDs of scripts the user explicitly chose to run.
 * @param available Scripts filtered to the current host (output of `filterManifest`).
 */
export function resolveDependencies(
	selected: string[],
	available: ScriptEntry[],
): ScriptEntry[] {
	// Build a quick id→entry lookup map.
	const byId = new Map<string, ScriptEntry>(available.map((e) => [e.id, e]));

	// Track which ids have already been added to the output list.
	const visited = new Set<string>();

	// The result list (dependency-first order).
	const result: ScriptEntry[] = [];

	// Depth-first post-order traversal with cycle detection.
	// `stack` tracks the ancestors in the current DFS path for cycle detection.
	function visit(id: string, stack: string[]): void {
		if (visited.has(id)) {
			// Already fully processed — nothing to do.
			return;
		}

		// Cycle check: if this id is already in the current DFS path, we have a cycle.
		const cycleIndex = stack.indexOf(id);
		if (cycleIndex !== -1) {
			throw new CircularDependencyError([...stack.slice(cycleIndex), id]);
		}

		const entry = byId.get(id);
		if (entry === undefined) {
			// Determine the direct dependent (last entry in the stack) for a better message.
			const dependentId = stack.at(-1);
			throw new MissingDependencyError(id, dependentId);
		}

		// Recurse into each dependency before adding this entry.
		const nextStack = [...stack, id];
		for (const depId of entry.dependencies) {
			visit(depId, nextStack);
		}

		// Post-order: add this entry after all its dependencies have been added.
		if (!visited.has(id)) {
			visited.add(id);
			result.push(entry);
		}
	}

	for (const id of selected) {
		visit(id, []);
	}

	return result;
}
