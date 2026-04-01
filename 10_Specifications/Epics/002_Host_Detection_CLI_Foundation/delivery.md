# 002 Host Detection & CLI Foundation — Delivery Tasks

_TDD methodology: write failing tests first (red), then implement to make them pass (green). Tests are part of each task, not separate._

---

## Task 1 — HostInfo Type and detectHost()

**Status:** complete

**Description:**
Create `src/host/detectHost.ts`, the canonical injectable-deps module that detects the host OS name, version, and CPU architecture (AC-1 through AC-7). This is a pure async function with no side-effects when called with injected deps, making it fully unit-testable without a real filesystem or process environment.

- Define and export `HostInfo`: `{ osName?: string; osVersion?: string; arch: "x64" | "arm" }`
- Export `detectHost(deps?: DetectHostDeps): Promise<HostInfo>` with `deps: { platform?: string; arch?: string; readFile?: (path: string) => Promise<string> }`
- Platform resolution: `"darwin"` → `osName: "mac"`; `"win32"` → `osName: "windows"`; `"linux"` → parse `/etc/os-release` via `readFile`
- `/etc/os-release` parsing: extract `NAME=` and `VERSION_ID=` lines; strip surrounding quotes; missing `VERSION_ID` → `osVersion` is `undefined`
- Missing or unreadable `/etc/os-release` (file read throws) → `osName` and `osVersion` are both `undefined`; function does not throw
- Arch mapping: `"arm64"` and `"arm"` → `"arm"`; all others → `"x64"`
- WSL: no special handling — reads `/etc/os-release` identically to native Linux
- Production default: `Bun.file(path).text()` for `readFile`; `process.platform` and `process.arch` for platform and arch

**TDD Approach:**
- **RED:** Write failing tests in `20_Applications/tui/src/host/detectHost.test.ts` that import `detectHost` and inject mock deps before writing any implementation
- **GREEN:** Write `detectHost.ts` to make all assertions pass
- Cover: `"linux"` platform with full os-release → correct `osName` and `osVersion`; `"linux"` with `VERSION_ID` absent → `osVersion` undefined; `"linux"` with missing file (readFile throws) → both fields undefined, no throw; `"darwin"` → `osName: "mac"`, no `osVersion`; `"win32"` → `osName: "windows"`, no `osVersion`; `"arm64"` arch → `"arm"`; `"arm"` arch → `"arm"`; `"x64"` arch → `"x64"`; unknown arch → `"x64"`; quoted `NAME` value in os-release stripped correctly

---

## Task 2 — CLI Entrypoint (src/index.ts)

**Status:** complete

**Description:**
Replace the `console.log("running")` placeholder in `src/index.ts` with the full Commander-based CLI entrypoint (AC-8 through AC-14). All logic that is testable should be extracted into an exported `run()` function that accepts injectable deps, keeping the module-level execution thin.

- **TTY guard** (runs first): if `deps.isTTY` is falsy → `log.error("Scriptor requires an interactive terminal.")` and call `deps.exit(1)`. Production default: `process.stdin.isTTY`.
- **`--repo <owner/repo|local>`**: optional Commander option; raw value passed through. Default when absent: `"beolson/Scriptor"`.
- **`--repo=local` guard**: when repo value is `"local"`, call `Bun.spawnSync(["git", "rev-parse", "--show-toplevel"])`; if exit code is non-zero → `log.error(...)` and `deps.exit(1)`. On success, the git root path is captured and passed to the startup stub.
- **`--apply-update <old-path>`**: registered with Commander, hidden from help (`option.hideHelp()`). Handler throws `new Error("not implemented")`.
- **Orchestrator stubs**: `runStartup`, `runScriptSelection`, `runInputCollection`, `runConfirmation`, `runSudo`, `runExecution` — each is an async function that throws `new Error("not implemented")`. Called sequentially inside the async IIFE.
- **Top-level error boundary**: the async IIFE is wrapped in `.catch(err => { log.error(String(err)); deps.exit(1); })`. Stub errors propagate here during development.
- **CLI structure**: `program.parse(process.argv)` synchronously, followed by `(async () => { ... })().catch(...)`.
- Injectable deps for `run()`: `{ isTTY?: boolean; exit?: (code: number) => never; spawnSync?: typeof Bun.spawnSync }`

**TDD Approach:**
- **RED:** Write failing tests in `20_Applications/tui/src/index.test.ts` that import `run()` from `./index.js` and inject mock deps before writing any implementation
- **GREEN:** Implement `src/index.ts` to satisfy all assertions
- Cover: TTY guard exits with code 1 when `isTTY` is falsy; TTY guard does not exit when `isTTY` is true; `--repo` absent → resolved repo is `"beolson/Scriptor"`; `--repo=local` with successful git spawn (exit 0) → does not call `deps.exit`; `--repo=local` with failed git spawn (non-zero) → calls `deps.exit(1)`; `--apply-update` is registered and hidden from help; orchestrator stubs are called in order before hitting the "not implemented" error
