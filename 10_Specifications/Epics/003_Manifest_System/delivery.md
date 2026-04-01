# 003 Manifest System — Delivery Tasks

_TDD methodology: write failing tests first (red), then implement to make them pass (green). Tests are part of each task, not separate._

---

## Task 1 — Shared TUI Types (`src/types.ts`)

**Status:** complete

**Description:**
Create `20_Applications/tui/src/types.ts` as the canonical source of truth for all shared TUI types. This is a leaf-node task with no intra-project dependencies; all downstream modules in this epic import from here.

Define and export:
- `HostInfo`: `{ osName?: string; osVersion?: string; arch: "x64" | "arm" }`
- `Os`: `{ name: string; version?: string; arch: "x64" | "arm" }`
- `InputDef`: `{ id: string; type: "string" | "number" | "ssl-cert"; label: string; required?: boolean; default?: string; download_path?: string; format?: string; [key: string]: unknown }` (passthrough fields)
- `ScriptEntry`: `{ id: string; name: string; description: string; os: Os; script: string; requires_elevation?: boolean; dependencies?: string[]; run_after?: string[]; run_if?: string[]; creates?: string[]; inputs?: InputDef[] }`
- `GroupEntry`: `{ id: string; name: string; description: string; scripts: string[] }`
- `Repo`: `{ owner: string; name: string }`
- `Config`: `{ repo?: string }`
- `CollectedInput`: `{ value: string; certCN?: string }`
- `ScriptInputs`: `Map<string, CollectedInput>`
- `ManifestResult`: `{ repo: Repo; manifest: string; host: HostInfo; localRoot?: string }`
- `ScriptSelectionResult`: `{ orderedScripts: ScriptEntry[]; inputs: ScriptInputs; installedIds: Set<string> }`
- `PreExecutionResult`: same shape as `ScriptSelectionResult`
- `ScriptRunResult`: `{ success: true } | { success: false; failedScript: ScriptEntry; exitCode: number }`
- `ManifestValidationError` class: `extends Error` with `readonly errors: string[]` field

Also update `src/host/detectHost.ts` to import `HostInfo` from `../types.js` rather than defining it locally. All existing `detectHost` tests must continue to pass.

**TDD Approach:**
- **RED:** Write a failing test in `20_Applications/tui/src/types.test.ts` that imports `ManifestValidationError` from `./types.js` — this will fail with "Cannot find module" until the file exists
- **GREEN:** Create `src/types.ts` with all type definitions and the `ManifestValidationError` class; update `detectHost.ts` import
- Cover: `ManifestValidationError` extends `Error`; `ManifestValidationError.errors` contains the messages passed to the constructor; `message` field summarises the error count; existing detectHost tests still pass after the import change

---

## Task 2 — Zod Manifest Schemas + Parser (`src/manifest/parseManifest.ts`)

**Status:** complete

**Description:**
Create `20_Applications/tui/src/manifest/parseManifest.ts`. This is the core of the Manifest System epic. The function accepts a raw YAML string, parses it with `js-yaml`, validates it with Zod, collects all errors in a single pass, and either returns a validated manifest object or throws `ManifestValidationError`.

- Define Zod schemas: `InputDefSchema`, `OsSchema`, `ScriptEntrySchema`, `GroupEntrySchema`, `ManifestSchema`
- `ManifestSchema` uses `.superRefine()` for all cross-field rules (FR-PARSE-VAL):
  - Unique script `id` values across `scripts`
  - Unique group `id` values across `groups`
  - Every `id` in a group's `scripts` array exists in the manifest's `scripts` array
  - Input `id` values unique within each script entry
  - Every `id` in a script's `run_if` array exists in the manifest's `scripts` array
- `InputDefSchema` uses `.passthrough()` so unknown fields are preserved (not stripped)
- If `js-yaml` throws a `YAMLException` (malformed YAML), wrap it in `ManifestValidationError` and throw
- If `safeParse()` fails, extract all `ZodError` issue messages, throw `ManifestValidationError(messages)`
- On success, return the validated manifest (typed as `{ scripts: ScriptEntry[]; groups?: GroupEntry[] }`)
- Export: `parseManifest(yamlString: string): { scripts: ScriptEntry[]; groups?: GroupEntry[] }`

**TDD Approach:**
- **RED:** Write failing tests in `20_Applications/tui/src/manifest/parseManifest.test.ts` that import `parseManifest` and `ManifestValidationError` before writing any implementation
- **GREEN:** Implement `parseManifest.ts` with Zod schemas and `js-yaml` parsing to make all tests pass
- Cover: valid minimal entry (all required fields, no optional) → succeeds and returns correct structure; valid entry with all optional fields → preserved in output; malformed YAML (not valid YAML syntax) → throws `ManifestValidationError`; missing required field (`id`, `name`, `description`, `os.name`, `os.arch`) → throws; duplicate script `id` values → throws with message naming the duplicate id; invalid group script ref (id not in scripts) → throws; invalid `run_if` ref → throws; duplicate input `id` within a script → throws; multiple cross-field errors → `ManifestValidationError.errors.length > 1`; `InputDef` passthrough fields present on the returned object; `groups` absent → succeeds with no `groups` key

---

## Task 3 — Host Filter (`src/manifest/filterManifest.ts`)

**Status:** complete

**Description:**
Create `20_Applications/tui/src/manifest/filterManifest.ts`. This is a pure function — no I/O, no side effects. It accepts a validated manifest and a `HostInfo` and returns the subset of script entries that match the host.

Matching rules (FR-FILTER):
- `os.name`: exact string match against `host.osName`. If `host.osName` is `undefined`, no entry with an `os.name` value can match.
- `os.version`: if present on the entry, exact string match against `host.osVersion`. If absent on the entry, the entry matches any host version for that `os.name`.
- `os.arch`: exact string match against `host.arch`.
- Entries that fail any rule are silently excluded (no error thrown).
- Groups are not filtered here — that is Epic 6.

Export: `filterManifest(manifest: { scripts: ScriptEntry[] }, host: HostInfo): ScriptEntry[]`

**TDD Approach:**
- **RED:** Write failing tests in `20_Applications/tui/src/manifest/filterManifest.test.ts` before writing any implementation
- **GREEN:** Implement `filterManifest.ts` as a pure filter function
- Cover: `os.name` matches `host.osName` → entry included; `os.name` does not match → excluded; `os.version` on entry matches `host.osVersion` → included; `os.version` on entry does not match → excluded; `os.version` absent on entry → included regardless of `host.osVersion`; `os.arch` matches `host.arch` → included; `os.arch` does not match → excluded; `host.osName` is `undefined` → all entries excluded; `host.osVersion` is `undefined` and entry has no `os.version` → included; multiple entries with mixed match results → only matching ones returned; empty `scripts` array → empty result

---

## Task 4 — Update `scriptor.yaml` to Nested `os:` Schema

**Status:** complete

**Description:**
The existing `scriptor.yaml` uses incorrect flat fields (`platform`, `distro`, `version`, `arch`) that do not match the Zod schema defined in Task 2. Update every entry in `scriptor.yaml` to use the nested `os:` structure.

Field mapping:
- `platform: windows` → `os: { name: "windows", arch: ... }`
- `platform: linux` + `distro: Debian GNU/Linux` + `version: "13"` → `os: { name: "Debian GNU/Linux", arch: ..., version: "13" }`
- `platform: mac` → `os: { name: "mac", arch: ... }`
- `arch: x86` → `arch: "x64"` (within the `os:` block)
- `requires_sudo` → `requires_elevation`
- `group: DevTools` (scalar on each entry) → top-level `groups:` array with member `scripts:` lists

Also remove the `# yaml-language-server` directive pointing at `scriptor.schema.json` if that schema file does not exist or does not match the new format.

**TDD Approach:**
- **RED:** Add an integration test in `20_Applications/tui/src/manifest/parseManifest.test.ts` that reads the actual `scriptor.yaml` from disk (relative path `../../../../scriptor.yaml`) via `Bun.file(...).text()` and calls `parseManifest()` — this test will fail because the current YAML uses the wrong format
- **GREEN:** Update `scriptor.yaml` so the integration test passes
- Cover: `parseManifest(actualYaml)` does not throw; returned `scripts` array has length matching the number of entries in `scriptor.yaml`; at least one entry has `os.name` set; at least one entry has `os.version` set; `inputs` are present on entries that declare them

---

## Task 5 — Web Types (`web/lib/types.ts`)

**Status:** complete

**Description:**
Create `20_Applications/web/lib/types.ts` with the `Script` and `Input` types used by Next.js page components and the build-time loader. These are independently defined (the web workspace does not import from TUI).

- `Input`: `{ id: string; type: string; label: string; required?: boolean; default?: string }`
- `Script`: `{ id: string; name: string; description: string; platform: string; arch: string; distro?: string; version?: string; script: string; requires_elevation?: boolean; dependencies?: string[]; inputs: Input[]; spec: string | undefined; scriptSource: string | undefined }`

Note: `platform` and `arch` here are the display-level values derived from `os.name` and `os.arch` in the YAML. The loader (Task 6) is responsible for the mapping.

**TDD Approach:**
- **RED:** Write a failing test in `20_Applications/web/lib/types.test.ts` that imports `Script` and `Input` as types and creates a conforming `Script` value — fails with "Cannot find module" until the file exists
- **GREEN:** Create `web/lib/types.ts` with both type definitions
- Cover: a `Script` value with all required fields and `spec: undefined` / `scriptSource: undefined` is accepted by TypeScript; `inputs` array with `Input` members is valid; `bun run typecheck` passes in the web workspace after the file is created

---

## Task 6 — Build-time Manifest Loader (`web/lib/loadScripts.ts`)

**Status:** complete

**Description:**
Create `20_Applications/web/lib/loadScripts.ts`, the Next.js build-time helper that reads `scriptor.yaml` and hydrates it into typed `Script` objects for use by page components. Runs on Node at build time only — never at request time or in client components.

- Reads `scriptor.yaml` at the monorepo root using Node `fs/promises.readFile`
- For each script entry, reads the script file from disk → `scriptSource`. If the script file is missing, throw with a clear message (build fails).
- For each script entry, reads `{script-path}.spec.md` → `spec`. If missing, `spec = undefined` (not an error).
- Maps YAML `os.name` → `distro`, `os.version` → `version`; derives `platform` from `os.name` (e.g. `"Debian GNU/Linux"` → `"linux"`, `"windows"` → `"windows"`, `"mac"` → `"mac"`)
- `invalid platform` values default to `"linux"`; invalid `arch` values default to `"x86"`
- Malformed input entries are silently skipped
- Exports:
  - `getScriptsByPlatform(platform: string): Promise<Script[]>`
  - `getScriptById(id: string): Promise<Script | undefined>`
- Accept optional deps for testability: `{ manifestPath?: string; repoRoot?: string }` — defaults to the monorepo root; tests override to point at fixture files

Test fixtures in `20_Applications/web/lib/__fixtures__/`:
- `scriptor.yaml` — a minimal valid manifest with 2–3 entries (linux, windows)
- `scripts/linux/test-script.sh` — a non-empty shell script
- `scripts/linux/test-script.sh.spec.md` — a non-empty spec file
- `scripts/windows/test-win.ps1` — a non-empty PowerShell script (no .spec.md for this one)

**TDD Approach:**
- **RED:** Write failing tests in `20_Applications/web/lib/loadScripts.test.ts` that import `getScriptsByPlatform` and `getScriptById` and call them with the fixture path before any implementation exists
- **GREEN:** Implement `loadScripts.ts` to make all tests pass
- Cover: `getScriptsByPlatform("linux")` returns only linux-platform scripts; `getScriptsByPlatform("windows")` returns only windows-platform scripts; `getScriptsByPlatform("invalid")` returns linux scripts (default); `getScriptById` returns the correct script for a known id; `getScriptById` returns `undefined` for an unknown id; `scriptSource` is populated with the file contents; `spec` is populated when `.spec.md` exists; `spec` is `undefined` when `.spec.md` is absent; `inputs` array is correctly mapped from InputDef entries; build throws when a script file is missing (not spec)
