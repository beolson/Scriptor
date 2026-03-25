# 004 Script Execution Engine — Delivery Tasks

_TDD methodology: write failing tests first (red), then implement to make them pass (green). Tests are part of each task, not separate._

---

## Task 1 — Types: PreExecutionResult gains installedIds

**Status:** complete

**Description:**
Update `PreExecutionResult` to carry `installedIds: Set<string>` forward from `ScriptSelectionResult`, and thread it through the pre-execution orchestrator. The execution engine needs `installedIds` to build the installed-items argument string passed to each script (Technical: TypeScript Types — PreExecutionResult updated).

- `src/manifest/types.ts` — add `installedIds: Set<string>` to `PreExecutionResult`
- `src/pre-execution/index.ts` — include `installedIds: selectionResult.installedIds` in the returned `PreExecutionResult`; update `PreExecutionDeps` and `makeDefaultDeps` if the type is referenced there
- `src/pre-execution/index.test.ts` — update `FakeDeps` and assertions to supply and assert `installedIds`
- No changes to any other file in this task

**TDD Approach:**
- **RED:** Update `src/pre-execution/index.test.ts` to assert that the returned `PreExecutionResult` includes an `installedIds` property matching the value from `selectionResult.installedIds`; run tests to confirm they fail
- **GREEN:** Add the field to the type, thread it through the orchestrator; all existing pre-execution tests still pass
- Cover: happy path — returned `installedIds` matches `selectionResult.installedIds`, back-loop then confirm — correct `installedIds` from the final `selectionResult` is returned, empty `installedIds` set propagated correctly

---

## Task 2 — TTY Guard

**Status:** complete

**Description:**
Add a TTY check to `src/index.ts` that fires before any other logic. If stdin is not a TTY, write the error to stderr and exit. Consistent with the injectable deps pattern, the check is extracted into a testable function (Functional: TTY Guard acceptance criteria; Technical: TTY Guard section).

- `src/index.ts` — extract `guardTTY(deps?: { isTTY: boolean; stderrWrite: (msg: string) => void; exit: (code: number) => never }): void`; call it as the very first statement before `buildProgram`; wire real deps: `isTTY: process.stdin.isTTY`, `stderrWrite: (m) => process.stderr.write(m)`, `exit: process.exit`
- Error output (exact text):
  ```
  [scriptor] ERROR: Scriptor requires an interactive terminal.\nstdin is not a TTY — run Scriptor directly in a terminal, not piped.\n
  ```
- `src/index.test.ts` — add tests using injectable `guardTTY` deps

**TDD Approach:**
- **RED:** Write tests in `src/index.test.ts` for `guardTTY` using fake deps before adding any implementation
- **GREEN:** Implement `guardTTY` and wire it; all existing `index.test.ts` tests still pass
- Cover: `isTTY: false` → `stderrWrite` called with exact message, `exit(1)` called; `isTTY: true` → neither `stderrWrite` nor `exit` called; error message contains `"[scriptor] ERROR"`; error message contains `"stdin is not a TTY"`

---

## Task 3 — Log Writer

**Status:** complete

**Description:**
Implement `src/execution/logWriter.ts` — the module responsible for creating the log file, resolving same-second filename collisions, and writing the structured per-script header and footer blocks. This is a leaf service with no dependencies on other execution modules (Functional: Log Files acceptance criteria; Technical: Log File section).

- `src/execution/logWriter.ts` — create file:
  - `interface LogWriterDeps { homedir: () => string; existsSync: (path: string) => boolean; mkdir: (path: string, opts: { recursive: boolean }) => Promise<void>; open: (path: string, flags: string) => Promise<FileHandle>; now: () => Date; }`
  - `resolveLogPath(logsDir: string, now: Date, deps: Pick<LogWriterDeps, "existsSync">): string` — pure (given `existsSync`); generates `YYYY-MM-DDTHH-MM-SS.log` (UTC); checks `existsSync(path)` and appends `-1`, `-2`, … suffix until the path is free
  - `createLogFile(deps?: LogWriterDeps): Promise<{ handle: FileHandle; logPath: string }>` — calls `deps.mkdir(logsDir, { recursive: true })`; calls `resolveLogPath`; opens handle via `deps.open(logPath, "a")`; returns both
  - `writeScriptHeader(handle: FileHandle, entry: ScriptEntry, inputs: ScriptInputs, startedAt: Date): Promise<void>` — writes the structured separator + `Script :`, `Started:`, optional `[input]` lines block
  - `writeScriptFooter(handle: FileHandle, endedAt: Date, exitCode: number): Promise<void>` — writes closing separator with `Ended    :` and `Exit code:` lines
  - Log format (exact from functional spec):
    ```
    ============================================================
    Script : {name}
    Started: {ISO timestamp}
    ============================================================
      [input] label={label} id={id} value={value}
    {stdout/stderr output lines — no indentation added in log}
    ============================================================
    Ended    : {ISO timestamp}
    Exit code: {code}
    ============================================================
    ```
  - The `[input]` section is only written if the script has collected inputs
- `src/execution/logWriter.test.ts` — create file

**TDD Approach:**
- **RED:** Write tests in `src/execution/logWriter.test.ts` with injectable deps faking `existsSync`, `mkdir`, `open`, `now` before any implementation
- **GREEN:** Implement each function; all tests pass
- Cover: `resolveLogPath` — no collision returns base name, first collision returns `-1` suffix, second collision returns `-2` suffix, timestamp formatted as `YYYY-MM-DDTHH-MM-SS` (UTC); `createLogFile` — calls `mkdir` with `recursive: true`, passes resolved path to `open`, returns handle and logPath; `writeScriptHeader` — contains `Script :` line, contains `Started:` ISO timestamp, inputs section omitted when script has no inputs, inputs section written when inputs present with correct format; `writeScriptFooter` — contains `Ended    :` line, contains `Exit code:` with correct value, separators are 60 `=` characters

---

## Task 4 — Keepalive

**Status:** complete

**Description:**
Implement `src/execution/keepalive.ts` — the per-elevation-script sudo credential refresh timer. Starts a `setInterval` that calls `sudo -v` every 4 minutes; stopped via `clearInterval` + `sudo -k` (invalidate) in the finally block after each elevation script completes (Functional: Sudo keepalive; Technical: Sudo Keepalive section).

- `src/execution/keepalive.ts` — create file:
  - `interface KeepaliveDeps { setInterval: (fn: () => void, ms: number) => NodeJS.Timeout; clearInterval: (timer: NodeJS.Timeout) => void; spawn: (cmd: string[], opts: object) => void; }`
  - `startKeepalive(deps?: KeepaliveDeps): NodeJS.Timeout` — calls `deps.setInterval(fn, 4 * 60 * 1000)` where `fn` spawns `["sudo", "-v"]` with stdout/stderr ignored
  - `stopKeepalive(timer: NodeJS.Timeout, deps?: KeepaliveDeps): void` — calls `deps.clearInterval(timer)`; then spawns `["sudo", "-k"]` with stdout/stderr ignored
- `src/execution/keepalive.test.ts` — create file

**TDD Approach:**
- **RED:** Write tests in `src/execution/keepalive.test.ts` with injectable `setInterval`, `clearInterval`, `spawn` fakes before any implementation
- **GREEN:** Implement; all tests pass
- Cover: `startKeepalive` — calls `setInterval` with 240000ms interval, interval callback spawns `["sudo", "-v"]`, returns the timer handle; `stopKeepalive` — calls `clearInterval` with the given timer, spawns `["sudo", "-k"]` after clearing, `["sudo", "-k"]` spawned even if timer was already elapsed

---

## Task 5 — Sudo Screen

**Status:** complete

**Description:**
Implement `src/execution/sudoScreen.ts` — the raw TTY password prompt shown on Unix when any selected script requires elevation. On mount it tries `sudo -n -v`; if credentials are already cached it skips the prompt entirely. Otherwise it presents a masked password input with unlimited retries; Esc exits Scriptor immediately (Functional: Unix Sudo Elevation Screen; Technical: Unix Sudo Screen section).

- `src/execution/sudoScreen.ts` — create file:
  - `interface SudoScreenDeps { setRawMode: (mode: boolean) => void; stdinResume: () => void; stdinPause: () => void; onStdinData: (handler: (chunk: Buffer) => void) => void; offStdinData: (handler: (chunk: Buffer) => void) => void; stdoutWrite: (msg: string) => void; spawn: (cmd: string[], opts: object) => { exited: Promise<number>; stdin?: { write: (data: string) => void; end: () => void } }; exit: (code: number) => never; }`
  - `showSudoScreen(deps?: SudoScreenDeps): Promise<void>`
    - First: spawn `["sudo", "-n", "-v"]` with no stdin; await `exited`; if exit code is 0 → return immediately (credentials cached, no prompt needed)
    - Otherwise:
      - Print `"Sudo authentication required\n"` to stdout
      - Call `deps.setRawMode(true)` and `deps.stdinResume()`
      - Enter keypress loop:
        - `0x1b` (Esc) → `deps.setRawMode(false)` + `deps.stdinPause()` + `deps.exit(0)`
        - `0x0d` (Enter) → submit: spawn `["sudo", "-S", "-v"]` with password on stdin; if exit 0 → `deps.setRawMode(false)` + `deps.stdinPause()` + return; if non-zero → print `"\nSudo validation failed. Please try again.\n"` (red via ANSI `\x1b[31m...\x1b[0m`), clear buffer, return to prompt (loop)
        - `0x7f` (Backspace/Delete) → remove last char from buffer; print `"\b \b"` to erase the `*` from stdout
        - Any other byte → append to buffer; print `"*"` to stdout
      - Print `"\n"` after prompt line ends
- `src/execution/sudoScreen.test.ts` — create file

**TDD Approach:**
- **RED:** Write tests in `src/execution/sudoScreen.test.ts` using all injectable deps as fakes; simulate keypress sequences as `Buffer` values before any implementation
- **GREEN:** Implement the keypress loop; each branch driven by a failing test first
- Cover: `sudo -n -v` exits 0 → returns immediately without showing prompt or calling `setRawMode`; `sudo -n -v` non-zero → `setRawMode(true)` called and prompt shown; valid password + `sudo -S -v` exits 0 → `setRawMode(false)` called and function resolves; `sudo -S -v` non-zero → error message printed (contains "Sudo validation failed"), prompt re-shown (loop); Esc byte → `exit(0)` called; each non-special byte echoed as `*` to stdout; Backspace erases last `*`; multiple failed attempts before success (unlimited retries); password string passed to `sudo -S -v` stdin

---

## Task 6 — Script Runner: Helpers

**Status:** complete

**Description:**
Implement the two helper functions inside `src/execution/scriptRunner.ts` that the execution loop depends on: `buildArgList` (pure argument array builder) and `drainStream` (concurrent line-by-line output streamer). These are tested independently before the full execution loop is built (Functional: Argument list; Execution Output streaming; Technical: Process Spawn & Output Streaming section).

- `src/execution/scriptRunner.ts` — create file:
  - `buildArgList(script: ScriptEntry, inputs: ScriptInputs, installedIds: Set<string>): string[]` — pure function:
    - For each `def` in `script.inputs` (declaration order): push `inputs.get(def.id)?.value ?? ""`
    - Append installed-items string: `[...installedIds].join(":")` or `""` if the set is empty
    - Returns the full positional args array
  - `interface DrainDeps { stdoutWrite: (data: string) => void; logWrite: (data: string) => Promise<void>; }`
  - `drainStream(stream: ReadableStream<Uint8Array>, deps: DrainDeps): Promise<void>` — reads stream chunk by chunk; maintains a partial-line buffer; on each `\n`, flushes the line:
    - Calls `deps.stdoutWrite("  " + line + "\n")` (two-space indent for console)
    - Calls `deps.logWrite(line + "\n")` (no indent for log file)
    - After stream ends, flushes any remaining partial line the same way
- `src/execution/scriptRunner.test.ts` — create file

**TDD Approach:**
- **RED:** Write tests for both helpers in `src/execution/scriptRunner.test.ts` before any implementation; `drainStream` tests use fake `ReadableStream` + injectable `DrainDeps`
- **GREEN:** Implement both functions; all tests pass
- Cover: `buildArgList` — single string input → `["value", ""]` (empty installed), two inputs in declaration order, installed-items joined with colon, empty installed set → trailing `""`, script with no inputs → just `[""]` (empty installed string), multiple installed IDs joined in Set iteration order; `drainStream` — single complete line written with indent to stdout and without indent to log, multiple lines each processed separately, partial chunk followed by rest of line flushes on second chunk, stream ending with no trailing newline flushes buffered partial line, empty stream (no output) completes without writing, mixed stdout content from multiple chunks

---

## Task 7 — Script Runner: Execution Loop

**Status:** complete

**Description:**
Implement `runScripts` in `src/execution/scriptRunner.ts` — the sequential execution loop that drives all scripts from start to finish, emitting console output, managing the log file lifecycle, wrapping elevation scripts in keepalive, and halting on the first failure (Functional: Script Execution Engine — Unix invocation, Windows invocation, Halt on failure, Execution Output; Technical: Process Spawn & Output Streaming).

- `src/execution/scriptRunner.ts` — extend with:
  - `interface ScriptRunnerDeps { platform: string; readScript: (entry: ScriptEntry) => Promise<string>; spawn: (cmd: string[], opts: SpawnOpts) => SpawnResult; stdoutWrite: (msg: string) => void; createLogFile: () => Promise<{ handle: FileHandle; logPath: string }>; writeScriptHeader: (handle: FileHandle, entry: ScriptEntry, inputs: ScriptInputs, startedAt: Date) => Promise<void>; writeScriptFooter: (handle: FileHandle, endedAt: Date, exitCode: number) => Promise<void>; startKeepalive: () => NodeJS.Timeout; stopKeepalive: (timer: NodeJS.Timeout) => void; now: () => Date; tmpdir: () => string; writeFile: (path: string, data: string) => Promise<void>; unlink: (path: string) => Promise<void>; }`
  - `runScripts(scripts: ScriptEntry[], inputs: ScriptInputs, installedIds: Set<string>, deps?: ScriptRunnerDeps): Promise<ScriptRunResult>`
    - Opens log file handle via `deps.createLogFile()`; wraps entire body in `try/finally` to close handle
    - For each script in order:
      - `deps.stdoutWrite("Running: " + entry.name + "\n")`
      - `await deps.writeScriptHeader(handle, entry, inputs, deps.now())`
      - Build args via `buildArgList(entry, inputs, installedIds)`
      - **Unix invocation** (`platform !== "win32"`): `spawn(["sh", "-c", content, "sh", ...args], { stdout: "pipe", stderr: "pipe", stdin: "inherit" })`
      - **Windows invocation** (`platform === "win32"`): write temp `.ps1` file to `{tmpdir}/scriptor-{timestamp}-{random}.ps1` (prepend UTF-8 directives); `spawn(["powershell.exe", "-NonInteractive", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", tmpfile, ...args])`; delete temp file in `finally`
      - If `entry.requires_elevation` and `platform !== "win32"`: wrap spawn in `startKeepalive` / `stopKeepalive` + `sudo -k`
      - `await Promise.all([drainStream(proc.stdout, drainDeps), drainStream(proc.stderr, drainDeps)])` then `await proc.exited`
      - `await deps.writeScriptFooter(handle, deps.now(), exitCode)`
      - If exit code non-zero: `deps.stdoutWrite("✗ " + entry.name + " failed (exit code " + exitCode + ")\n")`; print log path; return `{ success: false, logFile, failedScript: entry, exitCode }`
    - After all succeed: print `"Log file: " + logPath + "\n"`; return `{ success: true, logFile: logPath }`
    - Windows temp file always deleted in `finally` per-script

**TDD Approach:**
- **RED:** Write tests in `src/execution/scriptRunner.test.ts` with all deps injected as fakes; scripts represented as `ScriptEntry` stubs with content returned by `readScript` before any implementation
- **GREEN:** Implement `runScripts`; each branch (success, failure, elevation, Windows) driven by a failing test first
- Cover: single script success → returns `{ success: true, logFile }`; first script fails → returns `{ success: false, failedScript, exitCode }`; second script not started after first failure; `writeScriptHeader` called before spawn; `writeScriptFooter` called after exit; Unix invocation uses `sh -c` with content; Windows invocation writes temp `.ps1` and spawns `powershell.exe`; Windows temp file deleted in finally even on failure; `requires_elevation` script (Unix) calls `startKeepalive` before spawn and `stopKeepalive` after; non-elevation script does not call `startKeepalive`; stdout and stderr drained concurrently via `Promise.all`; `buildArgList` output passed as trailing args; "Running: {name}" printed before each script; "✗ {name} failed (exit code N)" printed on failure; log path printed after all scripts complete; log path printed after failure; log file handle closed in finally

---

## Task 8 — Execution Orchestrator

**Status:** complete

**Description:**
Implement `src/execution/index.ts` — the top-level coordinator that decides whether the sudo screen is needed, invokes it if so, then delegates to `runScripts`. Returns `ScriptRunResult` (Technical: Module Layout — `index.ts`; Functional: Wiring).

- `src/execution/index.ts` — create file:
  - `interface ExecutionDeps { platform: string; showSudoScreen: () => Promise<void>; runScripts: (scripts: ScriptEntry[], inputs: ScriptInputs, installedIds: Set<string>) => Promise<ScriptRunResult>; readScript: (entry: ScriptEntry) => Promise<string>; }`
  - `runScriptExecution(manifestResult: ManifestResult, preExecResult: PreExecutionResult, deps?: ExecutionDeps): Promise<ScriptRunResult>`
    - Determine if sudo screen needed: `deps.platform !== "win32"` AND any script in `preExecResult.orderedScripts` has `requires_elevation: true`
    - If needed: `await deps.showSudoScreen()`
    - Call `await deps.runScripts(preExecResult.orderedScripts, preExecResult.inputs, preExecResult.installedIds)` and return the result
  - `makeDefaultDeps(manifestResult: ManifestResult)`: wires real `showSudoScreen`, `runScripts`, and `readScript` (cached vs local mode based on `manifestResult.localMode`)
- `src/execution/index.test.ts` — create file

**TDD Approach:**
- **RED:** Write tests in `src/execution/index.test.ts` with all deps injected before any implementation
- **GREEN:** Implement orchestrator; each branch (sudo needed, sudo skipped, Windows) driven by failing test
- Cover: Unix + elevation script → `showSudoScreen` called before `runScripts`; Unix + no elevation scripts → `showSudoScreen` not called; Windows + elevation script → `showSudoScreen` not called (Windows skips sudo screen); `runScripts` called with `orderedScripts`, `inputs`, `installedIds`; `runScripts` result returned directly; `runScriptExecution` returns `{ success: true }` on all-scripts pass; `runScriptExecution` returns `{ success: false, failedScript, exitCode }` on script failure

---

## Task 9 — Wire runScriptExecution into program.ts

**Status:** complete

**Description:**
Replace the `deps.outro("Done")` stub in `program.ts` with a call to `runScriptExecution`, thread the new dep through `ProgramDeps`, and exit the process with the appropriate code based on `ScriptRunResult.success` (Technical: Wiring to `program.ts`; Exit Codes; Functional: Wiring acceptance criteria).

- `src/program.ts`:
  - Add `runScriptExecution: (manifestResult: ManifestResult, preExecResult: PreExecutionResult) => Promise<ScriptRunResult>` to `ProgramDeps`
  - Remove the `deps.outro("Done")` call
  - After `await deps.runPreExecution(selectionResult)`: call `await deps.runScriptExecution(result, preExecResult)` (store as `runResult`)
  - Exit: `process.exit(runResult.success ? 0 : 1)` — note: `process.exit` is not injected here; the exit happens at the top level of the action handler
- `src/index.ts`:
  - Add `runScriptExecution` to `makeDefaultDeps()` via lazy `await import()` from `src/execution/index.ts`
  - Wire `readScript` inside `makeDefaultDeps` based on `ManifestResult`: cached mode reads from `~/.scriptor/cache/<owner>/<repo>/scripts/<key>` (strip `scripts/` prefix from `entry.script`); local mode reads from `<localRoot>/<entry.script>`
- `src/index.test.ts`:
  - Add `runScriptExecution` to the fake `ProgramDeps`
  - Add tests asserting `runScriptExecution` is called with both `ManifestResult` and `PreExecutionResult`

**TDD Approach:**
- **RED:** Update `src/index.test.ts` — add `runScriptExecution` to `FakeProgramDeps`; add test asserting it is called with `ManifestResult` and `PreExecutionResult` returned by prior steps; run tests to confirm they fail before wiring
- **GREEN:** Update `ProgramDeps`, the action handler, and `index.ts` wiring; all existing tests still pass
- Cover: `runScriptExecution` called with `ManifestResult` from `runStartup` and `PreExecutionResult` from `runPreExecution`; `outro("Done")` no longer called; `runScriptExecution` not called when `--apply-update` flag is present; `ProgramDeps` type accepts a fake `runScriptExecution` returning `{ success: true, logFile: "" }`

---

## Change: Fix readScript not threaded into runScripts (2026-03-25)

**Summary:** `readScript` was defined in `ExecutionDeps` but never passed to `runScripts`, causing it to fall back to its unimplemented stub and throw at runtime.

**Files modified:**
- `src/execution/index.ts` — extracted `readScript` as a local const in `makeDefaultDeps`; passed `{ readScript }` as partial deps override when calling `runScripts`
- `src/execution/scriptRunner.ts` — changed `runScripts` deps param from `ScriptRunnerDeps` to `Partial<ScriptRunnerDeps>`; merged provided deps over defaults via `{ ...makeDefaultDeps(), ...deps }`

**Spec updates:**
- `functional.md` — none
- `technical.md` — none

**Tests added/modified:**
- none (bug was in real-dep wiring path; unit tests inject fakes and were unaffected)

---

## Change: Remove log file, switch to TTY-inherited output (2026-03-25)

**Summary:** Dropped log file capture entirely and switched script spawning to `stdout: "inherit"` / `stderr: "inherit"` so script output (including progress bars, `\r` updates, colors) renders correctly in the terminal.

**Files modified:**
- `src/manifest/types.ts` — removed `logFile` from both branches of `ScriptRunResult`
- `src/execution/scriptRunner.ts` — removed `DrainDeps`, `drainStream`, and all log file deps (`createLogFile`, `writeScriptHeader`, `writeScriptFooter`) from `ScriptRunnerDeps`; changed spawn opts to `inherit`; removed log path output messages
- `src/execution/scriptRunner.test.ts` — removed drainStream test block and all log-related test cases; simplified `makeSpawnResult` (no stdout/stderr streams); removed `makeFakeHandle` helper
- `src/execution/index.test.ts` — removed `logFile` from all fake `ScriptRunResult` literals
- `src/index.test.ts` — removed `logFile` from fake `runScriptExecution` return values
- `src/execution/logWriter.ts` — deleted
- `src/execution/logWriter.test.ts` — deleted

**Spec updates:**
- `functional.md` — removed user story 5 (log file auditing), removed Log Files acceptance criteria section, updated Return value type, updated Execution Output section (no more two-space indent or log path message), updated Business Value
- `technical.md` — removed Log File section, updated Process Spawn section (inherit mode), updated Module Layout (removed logWriter), updated `ScriptRunResult` type

**Tests added/modified:**
- `src/execution/scriptRunner.test.ts` — added "Unix invocation uses inherit for stdout/stderr/stdin" test; removed 7 log/drain-related tests; 517 total tests pass
