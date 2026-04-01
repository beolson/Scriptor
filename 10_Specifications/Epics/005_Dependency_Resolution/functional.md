# 005 Dependency Resolution

## Summary

Implements `src/manifest/resolveDependencies.ts` — the ordering logic that transforms a user-selected candidate set into a validated, topologically sorted `ScriptEntry[]` in the exact sequence scripts must execute. Three sequential phases handle conditional inclusion (`run_if`), transitive hard dependencies, and topological ordering with soft hints. Fatal graph errors (missing dependencies, cycles, invalid references) are detected and surfaced before any script runs.

## Business Value

Scripts frequently depend on each other (e.g., a config script requires a runtime to be installed first). Without automated dependency resolution, users would need to manually order their selections and know the full dependency graph — an error-prone process that breaks silently on ordering mistakes. This epic guarantees correctness: no script ever runs before its prerequisites, and the user is never left with a broken machine state from an out-of-order execution.

## User Stories

- **As a user** selecting a group of scripts, I want Scriptor to automatically include and sequence all required dependencies so I don't need to know or manually select prerequisite scripts.
- **As a user** who has already installed some scripts in a prior session, I want Scriptor to skip re-running them while still including them in dependency calculations, so conditional scripts that depend on their presence work correctly.
- **As a user** selecting scripts with `run_if` conditions, I want Scriptor to silently omit scripts whose conditions aren't met rather than failing, so I only see and run what's relevant to my current state.
- **As a developer** maintaining a script manifest, I want Scriptor to detect missing dependencies and circular references at selection time and report them clearly, so I can fix manifest errors before users are affected.

## Acceptance Criteria

### Phase 0 — `run_if` Filtering

- A script with `run_if: [A, B]` is kept if **all** listed IDs are "present" — defined as: the ID is in the current candidate set OR the ID's `creates` path exists on disk (already installed).
- A script's `creates` path is checked with `~` expanded to the home directory. A script without a `creates` field can only satisfy presence via candidate set membership.
- An already-installed script that the user did NOT select this session **does** count as satisfying a `run_if` reference.
- Phase 0 is a single pass. Removing a script due to failed `run_if` does not re-trigger evaluation of other scripts' `run_if` conditions.
- A `run_if` entry that references an ID not present in the **host-filtered** manifest (even if it exists in the full manifest) is a fatal error: log the offending ID and exit 1.
- Scripts removed in Phase 0 do not pull in their hard dependencies (their exclusion takes effect before Phase 1 starts).

### Phase 1 — Transitive Run Set

- Starting from the Phase 0 output, recursively follow all `dependencies` entries to produce the complete set of scripts that must run.
- A dependency ID that does not exist in the **host-filtered** manifest is a fatal error: log the missing ID and exit 1.

### Phase 2 — Topological Sort

- A post-order DFS over the Phase 1 run set produces the final execution order.
- Hard `dependencies` are always treated as ordering edges.
- `run_after` entries are treated as soft ordering edges **only** when the referenced script is already in the run set; `run_after` references to scripts outside the run set are silently ignored.
- Any cycle in the dependency graph — whether formed by hard edges, soft edges, or a combination of both — is a fatal error: log the cycle and exit 1.

### Return Value

- On success, `resolveDependencies` returns `ScriptEntry[]` — the ordered array of scripts to execute. The caller retains `inputs` and `installedIds` from earlier phases.
- On any fatal error, the function logs the error via `log.error()` and calls `process.exit(1)`.

### Error Conditions

| Error | Condition | Behavior |
|-------|-----------|----------|
| Invalid `run_if` reference | A `run_if` ID is not present in the host-filtered manifest | Fatal: log error, exit 1 |
| Missing dependency | A `dependencies` ID is not present in the host-filtered manifest | Fatal: log error, exit 1 |
| Circular dependency | Any cycle in the combined hard + soft edge graph | Fatal: log error, exit 1 |

## Constraints

- The function receives the host-filtered `ScriptEntry[]` (not the full manifest) as its working set. Validation of `run_if` and `dependencies` references is performed against this filtered list.
- `run_if` filtering (Phase 0) must complete and produce its output before Phase 1 begins; phases are strictly sequential.
- Installed-status checks (for `run_if` evaluation) read the filesystem synchronously or asynchronously — whichever fits the existing codebase pattern — but must complete before the phase 0 output is finalized.

## Out of Scope

- Input collection: `resolveDependencies` does not prompt the user or collect inputs.
- Sudo / elevation checks: handled in Epic 8.
- Script execution: handled in Epic 9.
- Manifest parsing and host filtering: handled in Epic 3.
- Group expansion (converting a group selection to a candidate set): handled in Epic 6.
- Deduplication of `run_if` or `run_after` IDs within a single entry.

## Open Questions

_None remaining._
