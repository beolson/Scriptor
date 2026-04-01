import type { ScriptEntry } from "../types.js";
import { ResolutionError } from "../types.js";

/**
 * Resolves the ordered set of scripts that must run given a candidate
 * selection and the full filtered manifest.
 *
 * Phase 0 — run_if filtering (implemented here)
 * Phase 1 — transitive dependency expansion    (implemented here)
 * Phase 2 — topological sort with cycle check  (implemented here)
 *
 * @param candidateScripts  Scripts the user explicitly selected to run.
 * @param filteredScripts   All scripts that matched the current host
 *                          (superset of candidateScripts).
 */
export async function resolveDependencies(
	candidateScripts: ScriptEntry[],
	filteredScripts: ScriptEntry[],
): Promise<ScriptEntry[]> {
	// ------------------------------------------------------------------
	// Phase 0 — run_if filtering
	// ------------------------------------------------------------------

	// Build an ID set for fast O(1) lookups.
	const filteredIds = new Set(filteredScripts.map((s) => s.id));
	const candidateIds = new Set(candidateScripts.map((s) => s.id));

	// Step 0a: Validate all run_if references across ALL filteredScripts.
	// Throw immediately on the first invalid reference before any filtering.
	for (const entry of filteredScripts) {
		for (const ref of entry.run_if ?? []) {
			if (!filteredIds.has(ref)) {
				throw new ResolutionError(
					`Script "${entry.id}" run_if references unknown script id: "${ref}"`,
				);
			}
		}
	}

	// Step 0b: Compute the set of installed script IDs.
	// A script is installed only when it has a non-empty `creates` array and
	// ALL paths in that array exist on disk.
	const installedIds = new Set<string>();
	await Promise.all(
		filteredScripts.map(async (entry) => {
			const creates = entry.creates;
			if (!creates || creates.length === 0) return;

			const allExist = await Promise.all(
				creates.map((rawPath) => {
					const path = rawPath.startsWith("~")
						? (process.env.HOME ?? "") + rawPath.slice(1)
						: rawPath;
					return Bun.file(path).exists();
				}),
			);

			if (allExist.every(Boolean)) {
				installedIds.add(entry.id);
			}
		}),
	);

	// Step 0c: Filter candidates — keep if no run_if or every run_if ID is
	// either in candidateScripts or in the installed-IDs set.
	// This is a single pass; removals do not trigger re-evaluation.
	const phase0Result = candidateScripts.filter((entry) => {
		const runIf = entry.run_if;
		if (!runIf || runIf.length === 0) return true;
		return runIf.every((ref) => candidateIds.has(ref) || installedIds.has(ref));
	});

	// ------------------------------------------------------------------
	// Phase 1 — Transitive dependency expansion
	// ------------------------------------------------------------------

	// Build a map for O(1) lookup of any filteredScript by ID.
	const filteredMap = new Map<string, ScriptEntry>(
		filteredScripts.map((s) => [s.id, s]),
	);

	const runSet = new Map<string, ScriptEntry>();

	// Seed the run set from Phase 0 output.
	const worklist: ScriptEntry[] = [...phase0Result];
	while (worklist.length > 0) {
		const entry = worklist.pop();
		if (!entry) break;
		if (runSet.has(entry.id)) continue;
		runSet.set(entry.id, entry);

		// Follow hard dependencies.
		for (const depId of entry.dependencies ?? []) {
			if (runSet.has(depId)) continue;
			const dep = filteredMap.get(depId);
			if (!dep) {
				throw new ResolutionError(
					`Script "${entry.id}" dependency references unknown script id: "${depId}"`,
				);
			}
			worklist.push(dep);
		}
	}

	// ------------------------------------------------------------------
	// Phase 2 — Topological sort (post-order DFS with cycle detection)
	// ------------------------------------------------------------------

	const visiting = new Set<string>(); // grey — on current DFS stack
	const visited = new Set<string>(); // black — fully processed
	const result: ScriptEntry[] = [];

	function visit(id: string): void {
		if (visited.has(id)) return;
		if (visiting.has(id)) {
			throw new ResolutionError(
				`Circular dependency detected involving script: "${id}"`,
			);
		}

		visiting.add(id);

		const entry = runSet.get(id);
		if (!entry) return;

		// Hard edges: always follow.
		for (const depId of entry.dependencies ?? []) {
			visit(depId);
		}

		// Soft edges: follow only when the referenced ID is in the run set.
		for (const afterId of entry.run_after ?? []) {
			if (runSet.has(afterId)) {
				visit(afterId);
			}
		}

		visiting.delete(id);
		visited.add(id);
		result.push(entry);
	}

	for (const id of runSet.keys()) {
		visit(id);
	}

	return result;
}
