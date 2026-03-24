# 002 Script Selection

## Summary

Covers the phase from the Epic 001 handoff (`ManifestResult`) through the user confirming a set of scripts to run. Parses the raw `scriptor.yaml` into a typed `Manifest`, filters scripts to those matching the detected host, checks installed status for `creates` paths, presents a simplified @clack/prompts menu (group shortcuts, individual multi-select, settings placeholder), resolves transitive dependencies, and returns the ordered run set.

---

## Business Value

A user's setup machine may be Linux, Mac, or Windows, with different distros and architectures. Without filtering, users are shown scripts that cannot run on their system. Without dependency resolution, scripts can fail because a prerequisite was never run. This epic delivers the first interactive phase where users can meaningfully choose what to run — correctly and safely, without needing to understand script dependencies.

---

## User Stories

- **Group shortcut**: As a user, I can pick a named group from the menu and have Scriptor queue all non-installed scripts in that group for me, so I don't have to think about individual scripts.
- **Individual selection**: As a user, I can choose "Individual scripts" from the menu and multi-select exactly which scripts to run, so I have fine-grained control.
- **Installed badge**: As a user, I can see which scripts are already installed in the individual-select list, so I know what's new vs. what I have.
- **Settings placeholder**: As a user, I can choose "Settings" from the menu and see a placeholder message, so the menu feels complete even before settings are implemented.
- **Dependency transparency**: As a user, when I confirm my selection, any required dependencies are automatically added to the run set without me needing to know about them.

---

## Acceptance Criteria

### Manifest Parsing

- [ ] `parseManifest(rawYaml: string): Manifest` parses the raw YAML string using `js-yaml` and validates the result against a Zod schema.
- [ ] Invalid YAML (parse error) is a fatal error: log a clear message via `@clack/prompts` and exit with a non-zero code.
- [ ] Zod schema violations (e.g. missing required field, wrong type, duplicate input `id`, `distro`/`version` present on non-linux entry, `distro`/`version` absent on a linux entry) are a fatal error with the same exit behavior.
- [ ] The parsed `Manifest` contains a typed array of `ScriptEntry` objects with all fields from §7 of the TUI spec: `id`, `name`, `description`, `platform`, `arch`, `script`, `group?`, `requires?`, `after?`, `inputs?`, `requires_elevation?`, `creates?`, and Linux-only `distro`, `version`.

### Host Filtering

- [ ] `filterManifest(manifest: Manifest, host: HostInfo): ScriptEntry[]` returns only scripts where `platform` and `arch` match the host exactly (case-sensitive string equality).
- [ ] Linux scripts additionally require `distro` and `version` to match the host exactly.
- [ ] A script with `version: "13"` does **not** match a host reporting `version: "13.1"`.
- [ ] If the host is Linux but `HostInfo` has no `distro` or `version` (unreadable `/etc/os-release`), all Linux scripts are excluded.
- [ ] Non-Linux scripts (`windows`, `mac`) are never filtered on `distro`/`version`.

### Installed-Status Detection

- [ ] After filtering, for each `ScriptEntry` with a `creates` field, check whether the `~`-expanded path exists on disk at runtime.
- [ ] The `creates` field is a path declaration only; actual installed status is determined by a live filesystem existence check, not inferred from the manifest.
- [ ] Scripts whose `creates` path exists are marked `installed: true`; all others are `installed: false`.
- [ ] The check is injectable (the filesystem check is a swappable dep) to support unit testing.

### Script List Screen — Main Menu

- [ ] The main menu is presented via `@clack/prompts` `select()`.
- [ ] Menu options:
  1. One option per group present in the filtered script list (group name as label).
  2. "Individual scripts" — lets the user multi-select.
  3. "Settings" — shows a placeholder message ("Settings coming soon.") and returns to the main menu.
- [ ] If the filtered script list is empty (no scripts match this host), display "No scripts available for {hostLabel}" via `log.warn()` and exit cleanly with code 0.
- [ ] Groups whose every script was filtered out for the current host do not appear as menu options.
- [ ] Ungrouped scripts (no `group` field) are accessible only via "Individual scripts" — they do not generate a menu option.
- [ ] If the user presses Esc or Ctrl+C at the main menu, Scriptor prints "User canceled." and exits with code 0.

### Script List Screen — Group Selection

- [ ] When a group is selected, the run set is all non-installed scripts in that group.
- [ ] Already-installed scripts in the selected group (marked `installed: true`) are excluded from the run set automatically.
- [ ] `resolveDependencies` is called on the resulting set; transitive `requires` dependencies from outside the group are added to the run set.

### Script List Screen — Individual Selection

- [ ] "Individual scripts" presents all filtered scripts via `@clack/prompts` `multiselect()`.
- [ ] Each option label is the script `name`; hint text shows the `description`.
- [ ] Already-installed scripts are shown in the list with an `[installed]` suffix in the label but are not pre-checked.
- [ ] The user can explicitly check an installed script to force a re-run.
- [ ] If the user presses Esc or Ctrl+C at the individual-select list, Scriptor prints "User canceled." and exits with code 0.
- [ ] `resolveDependencies` is called on the user's selection before advancing.

### Dependency Resolution

- [ ] `resolveDependencies(selectedIds: string[], available: ScriptEntry[]): string[]` performs a two-phase DFS topological sort:
  - Phase 1: Collect run set — recursively include all `requires` entries (DFS), building the full transitive closure.
  - Phase 2: Topological sort (DFS post-order) using both `requires` (hard edges, always applied) and `after` entries that are **also in the run set** (soft edges, skipped otherwise).
- [ ] Returns an ordered array of script IDs where every script's predecessors appear before it.
- [ ] `after` entries not in the run set are silently ignored.
- [ ] If a `requires` entry references an ID not present in `available` (including IDs filtered out for this host), throws `MissingDependencyError` with message: `Cannot select "{name}": dependency "{depId}" is not available for this host`.
- [ ] If a cycle is detected in the `requires` graph, throws `CircularDependencyError` with message: `Circular dependency detected: A → B → A`.
- [ ] `MissingDependencyError` and `CircularDependencyError` are typed error classes exported from the manifest module.

### Error Handling — Dependency Errors

- [ ] If `resolveDependencies` throws `MissingDependencyError` or `CircularDependencyError`, the error is treated as fatal: log the error message via `@clack/prompts` `log.error()` and exit with a non-zero code.

### Wiring

- [ ] The `log.success()` stub in `program.ts` is replaced with a call to `runScriptSelection(manifestResult, deps)`.
- [ ] `runScriptSelection` sequences: parse → filter → installed-check → main menu → dependency resolution → return.
- [ ] Return type: `{ orderedScripts: ScriptEntry[]; inputs: ScriptInputs; installedIds: Set<string> }`.
  - `inputs` is an empty `Map` (placeholder for the future input-collection epic).
  - `installedIds` is the set of script IDs (from the filtered list) whose `creates` path exists on disk.
- [ ] All external side-effects (filesystem exists check, terminal I/O via @clack/prompts) are injectable via a `deps` argument.

---

## Constraints

- Uses `@clack/prompts` `select()` and `multiselect()` — no custom terminal renderer, no React, no Ink.
- TypeScript strict mode throughout.
- Injectable deps pattern on all functions with side-effects; co-located `.test.ts` files, `bun test`.
- Biome lint/format (tabs, double quotes).

---

## Out of Scope

- Input collection (prompt screens for `string`, `number`, `ssl-cert` input types)
- Confirmation screen
- Elevation / sudo validation
- Script execution
- Settings implementation (placeholder message only)

---

## Open Questions

- None.
