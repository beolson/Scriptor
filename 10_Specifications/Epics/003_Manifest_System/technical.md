# Technical Standards — 003 Manifest System

## Runtime & Language

All standards from Epic 001 apply. Key constraints repeated for reference:

- **Runtime**: Bun only. Never use Node, npm, npx, or yarn.
- **Language**: TypeScript 5, strict mode.
- **Imports**: `.js` extensions on all relative imports (bundler-mode resolution).

## Key Libraries & Frameworks

No new dependencies are introduced in this epic. All required packages are already in `20_Applications/tui/package.json`:

- **`js-yaml` ^4.1.1** — parses the raw YAML string into a plain JS object
- **`@types/js-yaml` ^4.0.9** — type definitions for js-yaml
- **`zod` ^4.3.6** — schema validation and type inference for the parsed manifest
- **`semver` ^7.7.2** — already in deps; _not_ used in this epic (version matching is exact string equality — see Constraints)

### Web workspace (no new deps)

- **`next` 16.1.6** — build-time data loading runs inside Next.js server context
- **Node `fs/promises`** — used in `web/lib/loadScripts.ts`; Next.js build runs on Node, not Bun

## Module Locations

| Module | Path |
|--------|------|
| Shared TUI types | `20_Applications/tui/src/types.ts` |
| YAML parser + Zod validation | `20_Applications/tui/src/manifest/parseManifest.ts` |
| Host filter | `20_Applications/tui/src/manifest/filterManifest.ts` |
| Web types | `20_Applications/web/lib/types.ts` |
| Web build-time loader | `20_Applications/web/lib/loadScripts.ts` |

All shared TUI types (`ScriptEntry`, `GroupEntry`, `InputDef`, `HostInfo`, `Os`, `Repo`, `Config`, `CollectedInput`, `ScriptInputs`, `ManifestResult`, `ScriptSelectionResult`, `PreExecutionResult`, `ScriptRunResult`) are defined and exported from `src/types.ts`. This is the canonical source of truth; all downstream modules import types from here.

`web/lib/types.ts` defines `Script` and `Input` independently (separate workspace — no cross-workspace imports). The shapes mirror the TUI types conceptually but are not imported from TUI.

## YAML Schema (`scriptor.yaml`)

The existing `scriptor.yaml` uses incorrect flat fields and will be updated. The Zod schema in `parseManifest.ts` is the source of truth for valid YAML structure.

### Script entry shape (YAML)

```yaml
- id: install-system-basics
  name: Install System Basics
  description: Updates system packages
  os:
    name: Debian GNU/Linux   # required; exact string matched against HostInfo.osName
    arch: x86                # required; "x86" | "arm"
    version: "13"            # optional; exact string matched against HostInfo.osVersion
  script: scripts/Debian/13/install-system-basics.sh
  requires_elevation: true   # optional, default false
  dependencies: []           # optional, list of script ids
  run_after: []              # optional, list of script ids
  run_if: []                 # optional, list of script ids (cross-ref validated; filtering deferred to Epic 5)
  creates: []                # optional
  inputs: []                 # optional, list of InputDef
```

### Group entry shape (YAML)

```yaml
groups:
  - id: dev-tools
    name: Dev Tools
    description: Developer tooling scripts
    scripts:
      - install-system-basics   # must reference a valid script id
```

### InputDef shape (YAML)

```yaml
inputs:
  - id: instance-name
    type: string         # string | number | ssl-cert
    label: WSL instance name
    required: true       # optional, default false
    default: Debian13Dev # optional
    download_path: ...   # optional
    format: ...          # optional
    # passthrough fields permitted (not stripped by Zod)
```

## Architecture Patterns

### parseManifest — validation strategy

```ts
// 1. Parse YAML (js-yaml) — throws YAMLException on malformed input; catch and wrap
// 2. Run Zod safeParse with ManifestSchema
// 3. All cross-field rules expressed as .superRefine() on the root schema:
//    - Unique script id values
//    - Unique group id values
//    - Every id in a group's scripts array exists in the manifest's scripts array
//    - Input id values unique within each script entry
//    - Every id in a script's run_if array exists in the manifest's scripts array
// 4. On any failure: throw ManifestValidationError with collected error messages

const ManifestSchema = z.object({
  scripts: z.array(ScriptEntrySchema),
  groups: z.array(GroupEntrySchema).optional(),
}).superRefine((data, ctx) => {
  const ids = new Set<string>();
  for (const s of data.scripts) {
    if (ids.has(s.id)) {
      ctx.addIssue({ code: "custom", message: `Duplicate script id: ${s.id}` });
    }
    ids.add(s.id);
  }
  // ... additional cross-field checks
});
```

### ManifestValidationError

`parseManifest` throws `ManifestValidationError` (a typed error subclass) carrying an `errors: string[]` field with all collected messages. The caller (orchestrator / startup phase) catches it, logs each message via `log.error`, and calls `process.exit(1)`.

```ts
export class ManifestValidationError extends Error {
  constructor(public readonly errors: string[]) {
    super(`Manifest validation failed with ${errors.length} error(s)`);
  }
}
```

### filterManifest — matching rules

Pure function. Accepts `(manifest: Manifest, host: HostInfo): ScriptEntry[]`.

- `os.name`: exact string match against `host.osName`. If `host.osName` is absent, no entry with an `os.name` field matches.
- `os.version`: if present on the entry, exact string match against `host.osVersion`. If absent on the entry, any host version matches.
- `os.arch`: exact match against `host.arch`.
- Entries with unrecognized field values silently fail to match — no error.
- Group filtering is not performed here (deferred to Epic 6).

### Injectable deps pattern

Both `parseManifest` and `filterManifest` are pure functions — no I/O, no side effects. Tests pass in-memory inputs directly; no deps injection needed.

### Web build-time loader (`web/lib/loadScripts.ts`)

- Reads `scriptor.yaml` from the monorepo root using Node `fs/promises.readFile`.
- For each script entry: reads the script file with `fs/promises.readFile` → sets `scriptSource`. If missing: build fails with a clear error message.
- For each script entry: reads `{script-path}.spec.md` → sets `spec`. If missing: `spec = undefined` (not an error).
- Must never be imported from client components (Next.js RSC / server-only context).

## APIs & External Services

- **`js-yaml` `load()`** — parses YAML string; throws `YAMLException` on malformed input
- **`zod` `safeParse()`** — structural + cross-field validation in one pass via `.superRefine()`
- **`@clack/prompts` `log.error()`** — used by the _caller_ (not `parseManifest` itself) to surface errors
- **Node `fs/promises.readFile`** — used in `web/lib/loadScripts.ts` only

## Constraints & Non-Goals

- `parseManifest` performs no file I/O or network calls. It operates on an in-memory YAML string.
- `filterManifest` is a pure function with no side effects.
- `web/lib/loadScripts.ts` runs only at Next.js build time — never at request time or from client components.
- All validation errors are collected in a single `safeParse()` pass — no early exit on first error.
- `semver` is **not** used for version matching. `os.version` matching in `filterManifest` is exact string equality.
- `run_if` cross-references are validated (refs must exist) but `run_if` filtering logic is deferred to Epic 5.
- Group filtering (keeping only groups with ≥1 matching script) is deferred to Epic 6.

## Open Questions

_None remaining._
