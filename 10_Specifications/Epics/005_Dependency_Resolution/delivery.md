# 005 Dependency Resolution — Delivery Tasks

_TDD methodology: write failing tests first (red), then implement to make them pass (green). Tests are part of each task, not separate._

---

## Task 1 — `ResolutionError` Class (`src/types.ts`)

**Status:** complete

**Description:**
Add a `ResolutionError` typed error class to the existing `20_Applications/tui/src/types.ts`. This mirrors the `ManifestValidationError` pattern already in that file and is the error type thrown by `resolveDependencies` for all fatal conditions (missing deps, cycles, invalid `run_if` refs). All downstream tasks depend on this export.

- `ResolutionError extends Error` with a single `message: string` constructor argument
- `this.name = "ResolutionError"` and `Object.setPrototypeOf(this, new.target.prototype)` for correct `instanceof` behaviour in compiled Bun binaries
- Exported from `src/types.ts` alongside `ManifestValidationError`

**TDD Approach:**
- **RED:** Add a test in `20_Applications/tui/src/types.test.ts` that imports `ResolutionError` from `./types.js` and asserts it extends `Error` — fails immediately because `ResolutionError` is not yet exported
- **GREEN:** Add the `ResolutionError` class to `src/types.ts` to make the test pass
- Cover: `ResolutionError` is an instance of `Error`; `.name` equals `"ResolutionError"`; `.message` contains the string passed to the constructor; `instanceof ResolutionError` is `true` for a thrown and caught instance; existing `ManifestValidationError` tests still pass after the addition

---

## Task 2 — `resolveDependencies` Phase 0: `run_if` Filtering (`src/manifest/resolveDependencies.ts`)

**Status:** complete

**Description:**
Create `20_Applications/tui/src/manifest/resolveDependencies.ts` and implement the public function signature plus Phase 0 logic. After this task, `resolveDependencies` validates all `run_if` references, checks installed status via the filesystem, and filters the candidate set — returning an unordered `ScriptEntry[]` of scripts that should run. Phases 1 and 2 (dep expansion and sort) are added in Task 3.

Function signature:
```ts
export async function resolveDependencies(
  candidateScripts: ScriptEntry[],
  filteredScripts: ScriptEntry[],
): Promise<ScriptEntry[]>
```

Phase 0 implementation:

1. **Validate `run_if` references**: for every script in `filteredScripts`, check that every ID in its `run_if` array exists in `filteredScripts` (by ID). Throw `ResolutionError` immediately on the first invalid reference before any filtering occurs. Error message format: `Script "${entry.id}" run_if references unknown script id: "${ref}"`.

2. **Compute installed IDs**: for every script in `filteredScripts` that has a non-empty `creates` array, check whether **all** paths in that array exist on disk. Replace a leading `~` with `process.env.HOME ?? ""` before checking. Use `Bun.file(path).exists()` for each path; `Promise.all` the checks within each script. A script with `creates: []` (empty array) is **never** considered installed. Build a `Set<string>` of installed script IDs from this check.

3. **Filter candidates**: keep a candidate if it has no `run_if` field, or if every ID in its `run_if` is either (a) the ID of another script in `candidateScripts` or (b) in the installed-ID set. Scripts that fail are silently removed. This is a single pass — removals do not trigger re-evaluation.

After Phase 0, return the filtered candidates as an unordered array (Phases 1 & 2 in Task 3 will expand and sort).

**TDD Approach:**
- **RED:** Write failing tests in `20_Applications/tui/src/manifest/resolveDependencies.test.ts` that import `resolveDependencies` from `./resolveDependencies.js` — fails with "Cannot find module" until the file is created
- **GREEN:** Create `resolveDependencies.ts` with the function signature and Phase 0 implementation
- Cover: no `run_if` on any candidate → all candidates returned; `run_if: [A]` where `A` is in `candidateScripts` → script kept; `run_if: [A]` where `A` is not in `candidateScripts` and not installed → script removed; `run_if: [A]` where `A` is installed (`creates` all-paths-exist) → script kept even if `A` not in `candidateScripts`; `creates` with all paths existing → considered installed; `creates` with one path missing → not installed; `creates: []` → never installed; `~` in a `creates` path is expanded to `process.env.HOME`; `run_if` ID not in `filteredScripts` → throws `ResolutionError` with message naming the ID; invalid `run_if` ref throws before any candidate filtering occurs; removing a script does not cause re-evaluation of other scripts' `run_if`; `run_if: [A, B]` where both `A` and `B` are satisfied → script kept; `run_if: [A, B]` where `A` is satisfied but `B` is not → script removed

---

## Task 3 — `resolveDependencies` Phases 1 & 2: Transitive Set + Topological Sort (`src/manifest/resolveDependencies.ts`)

**Status:** complete

**Description:**
Extend `resolveDependencies.ts` with Phase 1 (transitive dependency expansion) and Phase 2 (topological sort with cycle detection), completing the function. After Task 2, the function returns an unordered filtered slice of `candidateScripts`. After this task, it returns every script that must run — including automatically-pulled dependencies — in topological execution order.

Phase 1 — Transitive Run Set:
- Build a `Map<string, ScriptEntry>` from `filteredScripts` for O(1) lookup by ID.
- Starting from the Phase 0 output, recursively follow each script's `dependencies` array to expand the run set. Use an iterative worklist or recursive approach.
- If a `dependencies` entry references an ID not present in the `filteredScripts` map, throw `ResolutionError`. Error format: `Script "${id}" dependency references unknown script id: "${ref}"`.
- Scripts removed in Phase 0 do not seed Phase 1 — their deps are not pulled in.

Phase 2 — Topological Sort:
- Perform a post-order DFS over the complete Phase 1 run set.
- Maintain three sets: `visiting` (grey — currently on the DFS stack), `visited` (black — fully processed), `result` (output accumulator).
- Hard edges (`dependencies`): always follow.
- Soft edges (`run_after`): follow **only** when the referenced ID is in the Phase 1 run set; silently skip otherwise.
- Cycle detection: if DFS encounters a node already in `visiting`, throw `ResolutionError`. This applies whether the cycle is formed by hard edges, soft edges, or a mix. Error format: `Circular dependency detected involving script: "${id}"`.
- Return `result` as the final `ScriptEntry[]`.

**TDD Approach:**
- **RED:** Add new failing tests to `20_Applications/tui/src/manifest/resolveDependencies.test.ts` for Phase 1 and Phase 2 behaviour — these tests will fail because the current (Task 2) implementation does not do dep expansion or ordering
- **GREEN:** Add Phase 1 and Phase 2 logic to `resolveDependencies.ts` to make all new tests pass while keeping all Task 2 tests passing
- Cover: script with a `dependencies` entry → dependency script appears before it in the result; dependency not explicitly in `candidateScripts` but in `filteredScripts` → pulled in automatically and appears first; `dependencies` ID absent from `filteredScripts` → throws `ResolutionError` naming the missing ID; transitive deps (A → B → C, only A selected) → all three appear in order C, B, A; `run_after: [X]` where `X` is in run set → `X` appears before the dependent script; `run_after: [X]` where `X` is not in run set → silently ignored, no error; hard-edge cycle (A depends on B, B depends on A) → throws `ResolutionError`; soft-edge cycle (A `run_after` B, B depends on A) → throws `ResolutionError`; scripts with no ordering constraints among themselves → all appear somewhere in result; Phase 0 removals are not candidates for Phase 1 dep expansion; installed-but-not-selected dep is pulled in only if a selected script's `dependencies` references it
