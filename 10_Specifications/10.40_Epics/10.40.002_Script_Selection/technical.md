# Technical Standards — 002 Script Selection

## Runtime & Language

Unchanged from epic 001:

- Runtime: Bun (compiled binary via `bun build --compile`)
- Language: TypeScript (strict mode, ESNext target, Preserve module resolution)
- Version constraints: Bun latest stable; TypeScript ^5

## Key Libraries & Frameworks

All carry over from epic 001. No new dependencies for this epic:

- YAML parsing: `js-yaml` — used in `parseManifest` to parse the raw manifest string
- Input validation: `zod` — Zod schema for `ScriptEntry` and `InputDef`
- TUI: `@clack/prompts` — `select()` for main menu, `multiselect()` for individual selection, `log.*` for errors/warnings

## Tooling

Unchanged from epic 001:

- Build: `bun build` with `--compile`
- Test: `bun test` (co-located `.test.ts` files, injectable deps pattern)
- Lint/Format: Biome (tabs, double quotes)
- Package manager: Bun only

## scriptor.yaml Schema Migration

This epic defines the canonical field names and the existing `scriptor.yaml` entries must be updated to match before implementation begins.

### Field Renames

| Old field | New field | Notes |
|---|---|---|
| `dependencies` | `dependencies` | No change — keeps its name |
| `requires_sudo: true` | `requires_elevation: true` | Linux/Mac elevation |
| `requires_admin: true` | `requires_elevation: true` | Windows elevation |
| _(absent)_ | `optional_dependencies` | New optional field |
| _(absent)_ | `creates` | New optional field |
| _(absent)_ | `group` | New optional field |

### Canonical ScriptEntry Schema (YAML)

```yaml
- id: string                        # required; unique
  name: string                      # required
  description: string               # required
  platform: windows | linux | mac   # required
  arch: x86 | arm                   # required
  script: string                    # required; repo-relative path
  distro: string                    # required on linux; forbidden on windows/mac
  version: string                   # required on linux; forbidden on windows/mac
  group: string                     # optional; TUI group label
  dependencies:                     # optional; hard-ordered prerequisites
    - script-id
  optional_dependencies:            # optional; soft ordering — only applied if dependency is also in the run set
    - script-id
  requires_elevation: boolean       # optional; default false; sudo (Unix) or Administrator (Windows)
  creates: string                   # optional; filesystem path created by this script (~-expanded for installed detection)
  inputs:                           # optional
    - id: string
      type: string | number | ssl-cert
      label: string
      required: boolean             # optional; default false
      default: string               # optional
```

### scriptor.yaml Migration Checklist

As part of this epic:

- [ ] Replace `requires_sudo: true` → `requires_elevation: true` on all entries
- [ ] Replace `requires_admin: true` → `requires_elevation: true` on all entries
- [ ] `dependencies` field stays as-is
- [ ] Add `group`, `optional_dependencies`, and `creates` fields to entries where appropriate (optional; can be added incrementally)

## Module Layout

New directories introduced by this epic:

```
src/manifest/
  parseManifest.ts          # parse raw YAML string → Manifest; Zod validation
  parseManifest.test.ts
  filterManifest.ts         # filter Manifest → ScriptEntry[] by HostInfo
  filterManifest.test.ts
  resolveDependencies.ts    # DFS topological sort; MissingDependencyError, CircularDependencyError
  resolveDependencies.test.ts
  types.ts                  # Manifest, ScriptEntry, InputDef, ScriptInputs, error classes

src/script-selection/
  index.ts                  # runScriptSelection(manifestResult, deps): Promise<ScriptSelectionResult>
  index.test.ts
  screens.ts                # @clack/prompts wrappers: showMainMenu, showIndividualSelect, showNoScripts
  screens.test.ts
```

## TypeScript Types

### ScriptEntry

```typescript
interface ScriptEntry {
  id: string;
  name: string;
  description: string;
  platform: "linux" | "mac" | "windows";
  arch: "x86" | "arm";
  script: string;
  distro?: string;               // Linux only
  version?: string;              // Linux only
  group?: string;
  dependencies: string[];        // hard-ordered prerequisites; default []
  optional_dependencies: string[]; // soft ordering; default []
  requires_elevation: boolean;   // default false
  creates?: string;              // ~-expanded path for installed-status detection
  inputs: InputDef[];
}
```

### InputDef

```typescript
interface InputDef {
  id: string;
  type: "string" | "number" | "ssl-cert";
  label: string;
  required?: boolean;
  default?: string;
  // Additional fields (e.g. download_path, format on ssl-cert) are preserved
  // via Zod .passthrough() — not validated, not typed here
}
```

### ScriptInputs (placeholder)

```typescript
// Placeholder for the future input-collection epic.
// runScriptSelection returns an empty Map; type will be refined when inputs are implemented.
type ScriptInputs = Map<string, string>;
```

### ScriptSelectionResult

```typescript
interface ScriptSelectionResult {
  orderedScripts: ScriptEntry[];
  inputs: ScriptInputs;          // always empty Map in this epic
  installedIds: Set<string>;     // IDs whose creates path exists on disk
}
```

## Zod Schema Design

- `ScriptEntry` schema is strict on required fields; unknown top-level fields are rejected.
- `InputDef` schema uses `.passthrough()` — `ssl-cert` entries carry extra fields (`download_path`, `format`) that are not validated here and must not be stripped.
- Validation errors (missing required field, wrong type, duplicate input `id`, `distro`/`version` present on non-linux, absent on linux) are fatal: log via `@clack/prompts` `log.error()` and exit with non-zero code.
- Invalid YAML (js-yaml parse error) is fatal with the same exit behavior.

## Installed-Status Detection

- `creates` paths containing `~` are expanded using `homedir()` from `node:os`.
- The filesystem existence check is injectable: `existsSync: (path: string) => boolean`.
- Default implementation: `import { existsSync } from "node:fs"`.

## Architecture Patterns

All carry over from epic 001:

- Injectable deps on all functions with side effects; real implementations wired in `makeDefaultDeps()` via lazy dynamic import.
- `runScriptSelection(manifestResult: ManifestResult, deps?: ScriptSelectionDeps)` follows the same signature pattern as `runStartup`.
- All `@clack/prompts` calls are wrapped in `screens.ts` functions with injectable `ClackDeps`.

## Wiring to program.ts

The `log.success()` stub in `program.ts` is replaced with:

```typescript
const selectionResult = await deps.runScriptSelection(result);
```

`ProgramDeps` gains a `runScriptSelection` field. The injectable default calls the real `runScriptSelection` from `src/script-selection/index.ts`.

## Error Classes

Exported from `src/manifest/types.ts`:

- `MissingDependencyError` — thrown when a `dependencies` entry references an ID not in `available`
- `CircularDependencyError` — thrown when a cycle is detected in the `dependencies` graph

Both extend `Error` with a typed `name` property for `instanceof` checks.

## Constraints & Non-Goals

- No new runtime dependencies — all libraries already present from epic 001.
- No React, no Ink — `@clack/prompts` only.
- TypeScript strict mode throughout.
- Biome lint/format (tabs, double quotes).
- Input collection, confirmation screen, elevation, and script execution are out of scope.

## Open Questions

- None.
