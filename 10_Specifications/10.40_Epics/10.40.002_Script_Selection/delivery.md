# 002 Script Selection — Delivery Tasks

_TDD methodology: write failing tests first (red), then implement to make them pass (green). Tests are part of each task, not separate._

---

## Task 1 — Manifest Types & Error Classes

**Status:** complete

**Description:**
Define all shared TypeScript types and error classes for this epic. These pure types are the foundation every other module builds on — no side effects, no external dependencies (FR: Manifest Parsing, Dependency Resolution).

- `src/manifest/types.ts` — `ScriptEntry`, `InputDef`, `Manifest` (array of `ScriptEntry`), `ScriptInputs` (Map placeholder), `ScriptSelectionResult`
- Error classes exported from `types.ts`: `MissingDependencyError` and `CircularDependencyError`, both extending `Error` with a typed `name` property for `instanceof` checks

**TDD Approach:**
- **RED:** Write tests in `src/manifest/types.test.ts` that construct both error classes and assert: `error instanceof MissingDependencyError`, `error.name === "MissingDependencyError"`, message preserved; same for `CircularDependencyError`
- **GREEN:** Implement both classes with the `name` property set in the constructor
- Cover: MissingDependencyError instanceof check, MissingDependencyError.name, CircularDependencyError instanceof check, CircularDependencyError.name, messages preserved

---

## Task 2 — Manifest Parser & scriptor.yaml Migration

**Status:** complete

**Description:**
Implement `parseManifest` with Zod validation and migrate `scriptor.yaml` to the canonical schema (FR: Manifest Parsing; Technical: scriptor.yaml Schema Migration).

- Migrate `scriptor.yaml` at the repo root: replace `requires_sudo: true` → `requires_elevation: true` and `requires_admin: true` → `requires_elevation: true` on all entries
- `src/manifest/parseManifest.ts` — `parseManifest(rawYaml: string, deps?): Manifest`
  - Parses raw YAML string using `js-yaml`; validates result against a Zod schema
  - Invalid YAML (parse error): call `deps.log.error(message)` then `deps.exit(1)`
  - Zod schema violations: same fatal exit — missing required field, wrong type, duplicate input `id`, `distro`/`version` present on non-linux entry, `distro`/`version` absent on linux entry
  - `InputDef` schema uses `.passthrough()` to preserve unknown fields (e.g. ssl-cert `download_path`, `format`)
  - Applies defaults: `dependencies: []`, `optional_dependencies: []`, `inputs: []`, `requires_elevation: false`

**TDD Approach:**
- **RED:** Write tests in `src/manifest/parseManifest.test.ts` with injectable `deps` capturing `log.error` calls and `exit` calls before any implementation
- **GREEN:** Implement Zod schema and parser; all fatal paths call `deps.log.error` then `deps.exit(1)`
- Cover: valid minimal entry parsed correctly, valid linux entry with distro+version, entry with all optional fields, invalid YAML calls log.error+exit, missing required field calls log.error+exit, wrong type on a field calls log.error+exit, duplicate input id calls log.error+exit, distro present on windows entry calls log.error+exit, linux entry without distro calls log.error+exit, linux entry without version calls log.error+exit, InputDef passthrough preserves unknown fields, defaults applied for missing optional arrays

---

## Task 3 — Host Filtering

**Status:** complete

**Description:**
Implement `filterManifest` to narrow the full manifest to only scripts compatible with the detected host (FR: Host Filtering). Pure function — no side effects, no injectable deps required.

- `src/manifest/filterManifest.ts` — `filterManifest(manifest: Manifest, host: HostInfo): ScriptEntry[]`
- Platform and arch matching: case-sensitive string equality
- Linux entries additionally require `distro` and `version` to match host exactly
- `version: "13"` does **not** match `host.version: "13.1"` — exact equality only
- If host is Linux but `host.distro` or `host.version` is absent (unreadable `/etc/os-release`), all linux entries are excluded
- Non-linux entries are never filtered on `distro`/`version`

**TDD Approach:**
- **RED:** Write tests in `src/manifest/filterManifest.test.ts` before any implementation
- **GREEN:** Implement with a simple predicate; no side effects
- Cover: matching linux entry included, mismatched platform excluded, mismatched arch excluded, `version: "13"` does not match host `"13.1"`, host linux with missing `distro` excludes all linux entries, host linux with missing `version` excludes all linux entries, non-linux entries never checked for distro/version, multiple entries returns all matching, empty manifest returns empty array

---

## Task 4 — Dependency Resolution

**Status:** complete

**Description:**
Implement `resolveDependencies` with two-phase DFS topological sort: collect the full transitive run set via `dependencies`, then order it using both `dependencies` (hard edges) and `optional_dependencies` entries that are in the run set (soft edges) (FR: Dependency Resolution).

- `src/manifest/resolveDependencies.ts` — `resolveDependencies(selectedIds: string[], available: ScriptEntry[]): string[]`
- Phase 1: DFS from each selected ID; recursively follow `dependencies` to build the full transitive run set
- Phase 2: DFS post-order topological sort; hard edges = `dependencies`; soft edges = `optional_dependencies` entries **also in the run set** (silently ignored otherwise)
- Returns ordered array of IDs where every script's predecessors appear before it
- Throws `MissingDependencyError` if a `dependencies` entry references an ID not present in `available`
- Throws `CircularDependencyError` if a cycle is detected in the `dependencies` graph; message format: `Circular dependency detected: A → B → A`

**TDD Approach:**
- **RED:** Write tests in `src/manifest/resolveDependencies.test.ts` before any implementation
- **GREEN:** Implement two-phase DFS; track visited/in-progress sets for cycle detection
- Cover: single script with no deps, A depends on B → B before A, transitive dep pulled in that was not in selection, soft edge applied when dep in run set, soft edge ignored when dep not in run set, `MissingDependencyError` when dependency id not in available, `CircularDependencyError` on A→B→A cycle, no duplicate IDs in output, all selected IDs present in output

---

## Task 5 — Script Selection Screens

**Status:** complete

**Description:**
Implement all `@clack/prompts` UI wrappers for the script selection phase. These are thin, testable wrappers with no business logic — the orchestrator drives all decisions (FR: Script List Screen — Main Menu, Individual Selection).

- `src/script-selection/screens.ts`:
  - `showNoScripts(hostLabel: string, deps?): void` — `log.warn("No scripts available for {hostLabel}")` then `deps.exit(0)`
  - `showMainMenu(groups: string[], deps?): Promise<"individual" | string>` — `select()` with one option per group name, plus "Individual scripts" and "Settings"; on Settings selection: show placeholder via `log.info("Settings coming soon.")` and call `select()` again (loop internally until non-Settings chosen); returns group name or `"individual"`
  - `showIndividualSelect(scripts: ScriptEntry[], deps?): Promise<string[]>` — `multiselect()` where installed scripts have label `"{name} [installed]"`, uninstalled have `"{name}"`; hint = description; not pre-checked regardless of installed status; returns array of selected IDs

**TDD Approach:**
- **RED:** Write tests in `src/script-selection/screens.test.ts` with injectable `ClackDeps` before any implementation
- **GREEN:** Implement as thin wrappers; all clack calls go through deps
- Cover: showNoScripts calls log.warn with hostLabel and then exit(0), showMainMenu builds correct option list from group names, showMainMenu returns "individual" for individual-scripts option, showMainMenu shows settings info message and loops when settings is selected, showIndividualSelect labels installed scripts with `[installed]` suffix, showIndividualSelect does not pre-check installed scripts, showIndividualSelect returns IDs of selected entries

---

## Task 6 — Script Selection Orchestrator

**Status:** complete

**Description:**
Implement `runScriptSelection` — the coordinator that sequences parse → filter → installed-check → main menu → dependency resolution → result (FR: all Script List Screen AC; Installed-Status Detection; Error Handling; Wiring).

- `src/script-selection/index.ts` — `runScriptSelection(manifestResult: ManifestResult, deps?): Promise<ScriptSelectionResult>`
- Sequence:
  1. `parseManifest(manifestResult.manifest)` → `Manifest`
  2. `filterManifest(manifest, manifestResult.host)` → filtered `ScriptEntry[]`
  3. If filtered list is empty → `showNoScripts(hostLabel)` (exits inside)
  4. For each entry with a `creates` field: expand `~` using `deps.homedir()`, check `deps.existsSync(path)` → mark `installed: true/false`
  5. Build group list from filtered entries (only groups with at least one entry)
  6. Call `showMainMenu(groups)` → get selection
  7. If group name returned: run set = non-installed entries in that group
  8. If `"individual"` returned: call `showIndividualSelect(filtered)` → run set = selected entries
  9. Call `resolveDependencies(runSetIds, filtered)` → ordered IDs
  10. On `MissingDependencyError` or `CircularDependencyError`: `deps.log.error(message)` then `deps.exit(1)`
  11. Return `{ orderedScripts: ScriptEntry[], inputs: new Map(), installedIds: Set<string> }`
- `installedIds` contains IDs of all filtered entries whose `creates` path exists on disk (not just the run set)
- `ScriptSelectionDeps` interface covers all injectable seams: `parseManifest`, `filterManifest`, `resolveDependencies`, `showNoScripts`, `showMainMenu`, `showIndividualSelect`, `existsSync`, `homedir`, `log`, `exit`

**TDD Approach:**
- **RED:** Write tests in `src/script-selection/index.test.ts` with all deps injected as fakes before any implementation
- **GREEN:** Implement the sequence; each branch driven by a failing test first
- Cover: group selection returns only non-installed scripts in that group, group selection adds transitive deps via resolveDependencies, individual selection returns user-picked scripts, individual selection allows re-selecting installed scripts, empty filtered list calls showNoScripts, creates path correctly expanded and existence-checked, installedIds set contains IDs of all entries with existing creates path, MissingDependencyError calls log.error+exit(1), CircularDependencyError calls log.error+exit(1), inputs always returned as empty Map

---

## Task 7 — Wire runScriptSelection into program.ts

**Status:** complete

**Description:**
Replace the `log.success()` stub in `program.ts` with a call to `runScriptSelection`, threading the new dep through `ProgramDeps` (FR: Wiring).

- Add `runScriptSelection: (result: ManifestResult) => Promise<ScriptSelectionResult>` to `ProgramDeps` in `src/program.ts`
- Replace the `deps.log.success("…")` stub in the action handler with `await deps.runScriptSelection(result)`
- Wire real `runScriptSelection` from `src/script-selection/index.ts` as default dep via lazy `await import()` in `makeDefaultDeps()`

**TDD Approach:**
- **RED:** Update `src/index.test.ts` — add `runScriptSelection` to the fake `ProgramDeps`; add a test asserting `runScriptSelection` is called with the `ManifestResult` returned by `runStartup`; run tests to confirm they fail before wiring
- **GREEN:** Update `ProgramDeps` and the action handler in `program.ts`; all existing tests still pass
- Cover: runScriptSelection called with ManifestResult returned by runStartup, runScriptSelection not called when --apply-update flag is present

---

## Change: Esc/Ctrl+C exits at all prompts (2026-03-24)

**Summary:** Cancel at the main menu and individual-select list now prints "User canceled." and exits immediately instead of being silently treated as a valid selection.

**Files modified:**
- `20_Applications/tui/src/script-selection/screens.ts` — `ClackDeps` gained `isCancel`/`cancel`; `showMainMenu` and `showIndividualSelect` call `clack.cancel("User canceled.")` then `exit(0)` on symbol; `defaultClack` wired with `clackPrompts.isCancel` and `clackPrompts.cancel`
- `20_Applications/tui/src/script-selection/screens.test.ts` — `makeClack` gains `isCancel`/`cancel`; `_CANCEL` renamed to `CANCEL`; cancel-exit tests added for both `showMainMenu` and `showIndividualSelect`

**Spec updates:**
- `functional.md` — added Esc-exits criteria for main menu and individual-select list

**Tests added/modified:**
- `20_Applications/tui/src/script-selection/screens.test.ts` — cancel-exit tests added for `showMainMenu` and `showIndividualSelect`
