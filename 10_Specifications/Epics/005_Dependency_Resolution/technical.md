# Technical Standards — 005 Dependency Resolution

## Runtime & Language

All standards from Epic 001 apply. Key constraints repeated for reference:

- **Runtime**: Bun only. Never use Node, npm, npx, or yarn.
- **Language**: TypeScript 5, strict mode.
- **Imports**: `.js` extensions on all relative imports (bundler-mode resolution).

## Key Libraries & Frameworks

No new runtime dependencies are introduced in this epic. All required packages are already in `20_Applications/tui/package.json`:

- **`zod` ^4.3.6** — already used in `parseManifest.ts`; not needed in this module (inputs are already validated typed structs)
- **`@clack/prompts` ^0.10.0** — `log.error()` used by the **caller** (orchestrator) when it catches `ResolutionError`; not called from within `resolveDependencies` itself

No new packages required.

## Module Location

| Module | Path |
|--------|------|
| Dependency resolver | `20_Applications/tui/src/manifest/resolveDependencies.ts` |
| Unit tests | `20_Applications/tui/src/manifest/resolveDependencies.test.ts` |
| Shared types | `20_Applications/tui/src/types.ts` (no changes needed) |

## Function Signature

```ts
export async function resolveDependencies(
  candidateScripts: ScriptEntry[],
  filteredScripts: ScriptEntry[],
): Promise<ScriptEntry[]>
```

- **`candidateScripts`**: the user-selected scripts (a subset of `filteredScripts`), after group expansion but before any `run_if` evaluation. Provided by Epic 6.
- **`filteredScripts`**: all host-matching scripts from the parsed manifest (output of `filterManifest`). Used for dependency lookups and reference validation.
- **Returns**: `ScriptEntry[]` in topological execution order.
- **Throws**: `ResolutionError` on any fatal condition (see Error Signaling below).

The function is `async` because the `run_if` installed-status check uses `Bun.file(path).exists()`.

## Error Signaling

`resolveDependencies` throws a typed `ResolutionError` on all fatal conditions. The **caller** (the startup orchestrator, Epic 6) catches it, logs each message via `log.error()`, and calls `process.exit(1)`.

```ts
export class ResolutionError extends Error {
  constructor(public readonly message: string) {
    super(message);
    this.name = "ResolutionError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
```

This mirrors the `ManifestValidationError` pattern from Epic 3. Fatal conditions and their messages:

| Condition | Message format |
|-----------|---------------|
| `run_if` ID not in filtered manifest | `Script "${id}" run_if references unknown script id: "${ref}"` |
| Hard dependency ID not in filtered manifest | `Script "${id}" dependency references unknown script id: "${ref}"` |
| Circular dependency detected | `Circular dependency detected involving script: "${id}"` |

## Architecture Patterns

### Phase 0 — `run_if` Filtering

1. Validate all `run_if` references first: for every script in `filteredScripts`, check that every `run_if` ID exists in `filteredScripts`. Throw `ResolutionError` immediately on any invalid reference — before any filtering occurs.
2. Build the initial installed-ID set: for every script in `filteredScripts` that has a `creates` field, check all paths. A script is considered installed only when **every** path in its `creates` array exists on disk. Use `Bun.file(expandHome(path)).exists()` for each path, called in parallel per script via `Promise.all`.
3. Filter the `candidateScripts`: a candidate is kept if it has no `run_if`, or if every ID in its `run_if` is either (a) in the current `candidateScripts` set (by ID) or (b) in the installed-ID set.
4. Single-pass only — removals do not trigger re-evaluation.

### Home Directory Expansion

`~` at the start of a `creates` path is replaced with `process.env.HOME ?? ""` before any filesystem check. This is consistent with the rest of the codebase.

### Phase 1 — Transitive Run Set

Starting from the Phase 0 output, build a `Set<string>` of all script IDs that must run by recursively following `dependencies`. Use a lookup map (`Map<string, ScriptEntry>`) built from `filteredScripts` for O(1) ID resolution.

Throw `ResolutionError` if a `dependencies` entry references an ID not found in the lookup map.

### Phase 2 — Topological Sort

Post-order DFS over the Phase 1 run set. Maintains three sets: `visiting` (in-progress), `visited` (complete), `result` (output order).

- **Hard edges**: `dependencies` — always followed.
- **Soft edges**: `run_after` — followed **only** when the referenced script ID is in the run set; silently ignored otherwise.
- **Cycle detection**: if DFS encounters a node in `visiting`, throw `ResolutionError`. This applies to both hard and soft edges — any cycle is fatal.

```ts
// Pseudocode
function visit(id: string): void {
  if (visited.has(id)) return;
  if (visiting.has(id)) throw new ResolutionError(`Circular dependency...`);
  visiting.add(id);
  const script = runSetMap.get(id)!;
  for (const dep of script.dependencies ?? []) visit(dep);
  for (const after of script.run_after ?? []) {
    if (runSet.has(after)) visit(after);
  }
  visiting.delete(id);
  visited.add(id);
  result.push(script);
}
```

### No Injectable Deps

`resolveDependencies` calls `Bun.file(path).exists()` directly — no injectable deps argument. Tests that need to verify installed-status behaviour must either use real temporary directories or test the logic at the unit level by controlling `candidateScripts` and `filteredScripts` inputs (which avoids filesystem access for most test cases).

## APIs & External Services

- **`Bun.file(path).exists()`** — async filesystem existence check for `creates` path evaluation
- **`process.env.HOME`** — home directory expansion for `~` prefix in `creates` paths

## Tooling

No new tooling. Same as Epic 001: `bun test`, Biome, TypeScript strict.

Unit tests co-located at `resolveDependencies.test.ts`. Tests exercise all three phases and all error conditions using in-memory `ScriptEntry` arrays.

## Constraints & Non-Goals

- `resolveDependencies` does **not** call `log.error()` or `process.exit(1)` — it only throws `ResolutionError`. Error display and exit are the caller's responsibility.
- `creates` installed-status check requires **all** paths in the array to exist. A script with an empty `creates: []` is never considered installed (vacuous "all" is false — no paths to check).
- No injectable deps — `Bun.file().exists()` is called directly.
- Group expansion (converting group selection to candidate scripts) is performed by the caller (Epic 6) before calling this function.
- Input collection and sudo checks are out of scope.
- `run_if` re-evaluation after removals is out of scope (single-pass only).

## Open Questions

_None remaining._
