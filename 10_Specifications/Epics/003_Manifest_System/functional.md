# 003 Manifest System

## Summary

The Manifest System is the shared data spine for both the TUI and the Web workspaces. It covers parsing and validating `scriptor.yaml`, filtering the parsed manifest to the current host, and providing the TypeScript data model used throughout the application.

On the TUI side this means a Zod-validated YAML parser and a host-filter module. On the Web side it means build-time helpers that load script metadata (including raw script source and spec markdown) from disk.

## Business Value

The primary beneficiary is the end user (developer setting up a new machine). The manifest system ensures only scripts compatible with the user's machine are surfaced — preventing failed runs caused by running scripts meant for a different OS, version, or architecture.

Script repo maintainers also benefit: validation reports all errors at once so authoring mistakes in `scriptor.yaml` can be corrected in a single fix cycle rather than discovered one at a time.

## User Stories

- As a developer running Scriptor, I want to see only scripts that are compatible with my OS, version, and architecture so I don't accidentally run scripts that will fail on my machine.
- As a script repo maintainer, I want validation to report all errors in one pass so I can fix my `scriptor.yaml` without repeated run-fix-run cycles.
- As a developer browsing the Scriptor website, I want to see script metadata rendered from the same source of truth as the CLI so the web catalog stays in sync automatically.

## Acceptance Criteria

### TUI — Parsing & Validation (`parseManifest.ts`)

- Accepts a raw YAML string; parses it with js-yaml and validates with Zod schemas.
- **Script entry fields** validated: `id`, `name`, `description`, `os.name`, `os.arch` (required); `os.version`, `dependencies`, `run_after`, `run_if`, `requires_elevation`, `creates`, `inputs` (optional with documented defaults).
- **Group entry fields** validated: `id`, `name`, `description`, `scripts` (all required); every `scripts` array member must reference a valid script `id`.
- **Input definition fields** validated: `id`, `type`, `label` (required); `required`, `default`, `download_path`, `format` (optional); passthrough fields permitted.
- **Validation rules** (all checked in one pass; all errors collected before exiting):
  - Unique script `id` values across the `scripts` array.
  - Unique group `id` values across the `groups` array.
  - Every `id` in a group's `scripts` array exists in the manifest's `scripts` array.
  - Input `id` values are unique within a single script entry.
  - Every `id` in a script's `run_if` array exists in the manifest's `scripts` array.
  - Duplicate script IDs, invalid group refs, and invalid `run_if` refs are all collected and reported together.
- On any validation failure: log all errors (via `log.error`) and exit with code 1. No partial results returned.

### TUI — Filtering (`filterManifest.ts`)

- Accepts a parsed manifest and a `HostInfo` object; returns the subset of scripts that match the host.
- **Match rules**:
  - `os.name`: exact string match against `hostInfo.osName`. Absent `osName` → no Linux entries match.
  - `os.version`: if present on the entry, exact string match against `hostInfo.osVersion`. If absent on the entry, any host version for that OS name matches.
  - `os.arch`: exact match against `hostInfo.arch`.
- Entries with unrecognized `os.name` or `os.arch` values silently fail to match — they are excluded without error.
- Groups are not filtered at this stage; group filtering (keeping only groups with at least one matching script) is handled in the TUI selection screen (Epic 6).

### TUI — TypeScript Data Model

The following types are defined and exported from the TUI workspace (canonical source of truth for all downstream modules):

| Type | Description |
|------|-------------|
| `HostInfo` | `{ osName?: string; osVersion?: string; arch: "x64" \| "arm" }` |
| `Os` | `{ name: string; version?: string; arch: "x64" \| "arm" }` |
| `InputDef` | Input declaration on a script (see PRD §4 for full field list) |
| `ScriptEntry` | A single script in the manifest (see PRD §4 for full field list) |
| `GroupEntry` | A logical group of scripts (see PRD §4 for full field list) |
| `Repo` | `{ owner: string; name: string }` |
| `Config` | `{ repo?: string }` |
| `CollectedInput` | `{ value: string; certCN?: string }` |
| `ScriptInputs` | `Map<string, CollectedInput>` |
| `ManifestResult` | `{ repo: Repo; manifest: string; host: HostInfo; localRoot?: string }` |
| `ScriptSelectionResult` | `{ orderedScripts: ScriptEntry[]; inputs: ScriptInputs; installedIds: Set<string> }` |
| `PreExecutionResult` | Same shape as `ScriptSelectionResult` |
| `ScriptRunResult` | `{ success: true } \| { success: false; failedScript: ScriptEntry; exitCode: number }` |

### Web — Types (`web/lib/types.ts`)

- Exports `Script` and `Input` TypeScript types for use by page components.
- `Script` includes: `platform`, `arch`, `distro` (OS name), `version` (OS version), `inputs: Input[]`, `spec: string | undefined`, `scriptSource: string | undefined`, plus all display fields (`id`, `name`, `description`, `script` path, etc.).
- `Input` mirrors the `InputDef` shape from the TUI data model.

### Web — Build-time Loader (`web/lib/loadScripts.ts`)

- Reads `scriptor.yaml` at the monorepo root at Next.js build time (no network calls).
- For each script entry, reads the script file from disk and sets `scriptSource`. If the script file is missing, the build fails with a clear error.
- For each script entry, reads `{script-path}.spec.md` from disk and sets `spec`. If the `.spec.md` file does not exist, `spec` is `undefined` — not an error.
- Exports `getScriptsByPlatform(platform: string): Script[]` and `getScriptById(id: string): Script | undefined`.
- Invalid `platform` values default to `"linux"`; invalid `arch` values default to `"x86"`.
- Malformed input entries are silently skipped.

## Constraints

- The manifest parser operates on an in-memory YAML string — it does not perform any file I/O or network calls itself.
- The filter module is a pure function with no side-effects.
- The Web loader runs only at build time; it must not be called at request time or from client components.
- All validation errors must be collected and reported in a single pass — no early exit on first error.

## Out of Scope

The following items are explicitly deferred to later epics:

| Item | Epic |
|------|------|
| Dependency resolution (`run_if` filtering, topological sort, transitive deps) | Epic 5 |
| GitHub manifest fetching and network calls | Epic 4 |
| Cache read/write (`~/.scriptor/cache/`) | Epic 4 |
| Input collection UI (interactive prompts for `string`, `number`, `ssl-cert` inputs) | Epic 7 |

## Open Questions

_None remaining._
