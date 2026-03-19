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
 * Resolves the ordered execution list for a selection of scripts, using a
 * two-phase algorithm to support both hard `dependencies` and soft `run_after`
 * ordering constraints.
 *
 * **Phase 1 — Collect the run set:**
 * DFS over `selected`, recursing into `dependencies` only. Builds the complete
 * set of scripts that must run (selected + transitive dependencies).
 * Throws `MissingDependencyError` / `CircularDependencyError` for dependency
 * issues.
 *
 * **Phase 2 — Topological sort:**
 * DFS post-order over the run set. Predecessors for each entry are:
 * - `dependencies` — always enforced
 * - `run_after` IDs that are present in the run set — soft ordering, only
 *   applied when both scripts were already going to run
 * Circular detection covers both `dependencies` and `run_after` edges.
 *
 * Key semantics:
 * - Returns scripts in dependency-first order (leaves before roots).
 * - Deduplicates: each script appears at most once.
 * - Preserves the relative order of independently selected scripts.
 * - `run_after` IDs not in the run set are silently ignored (they may be
 *   legitimately absent on the current platform).
 * - Throws `MissingDependencyError` if a declared `dependencies` entry is
 *   absent from `available`.
 * - Throws `CircularDependencyError` if a cycle is detected (via `dependencies`
 *   or `run_after`).
 *
 * @param selected  IDs of scripts the user explicitly chose to run.
 * @param available Scripts filtered to the current host (output of `filterManifest`).
 */
export function resolveDependencies(
	selected: string[],
	available: ScriptEntry[],
): ScriptEntry[] {
	const byId = new Map<string, ScriptEntry>(available.map((e) => [e.id, e]));

	// -------------------------------------------------------------------------
	// Phase 1 — Collect the run set via DFS over dependencies only.
	// -------------------------------------------------------------------------
	const runSet = new Set<string>();

	function collectDeps(id: string, stack: string[]): void {
		if (runSet.has(id)) return;

		const cycleIndex = stack.indexOf(id);
		if (cycleIndex !== -1) {
			throw new CircularDependencyError([...stack.slice(cycleIndex), id]);
		}

		const entry = byId.get(id);
		if (entry === undefined) {
			const dependentId = stack.at(-1);
			throw new MissingDependencyError(id, dependentId);
		}

		const nextStack = [...stack, id];
		for (const depId of entry.dependencies) {
			collectDeps(depId, nextStack);
		}

		runSet.add(id);
	}

	for (const id of selected) {
		collectDeps(id, []);
	}

	// -------------------------------------------------------------------------
	// Phase 2 — Topological sort over the run set.
	// Predecessors = dependencies ∪ (run_after ∩ runSet).
	// -------------------------------------------------------------------------
	const visited = new Set<string>();
	const result: ScriptEntry[] = [];

	function visit(id: string, stack: string[]): void {
		if (visited.has(id)) return;

		const cycleIndex = stack.indexOf(id);
		if (cycleIndex !== -1) {
			throw new CircularDependencyError([...stack.slice(cycleIndex), id]);
		}

		const entry = byId.get(id);
		// id is always in byId here: Phase 1 verified all runSet members exist.
		if (entry === undefined) return;

		const predecessors = [
			...entry.dependencies,
			...entry.run_after.filter((rid) => runSet.has(rid)),
		];

		const nextStack = [...stack, id];
		for (const predId of predecessors) {
			visit(predId, nextStack);
		}

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
