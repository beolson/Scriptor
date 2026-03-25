# Technical Standards — 004 Script Execution Engine

## Runtime & Language

Unchanged from epics 001–003:

- Runtime: Bun (compiled binary via `bun build --compile`)
- Language: TypeScript (strict mode, ESNext target, Preserve module resolution)
- Version constraints: Bun latest stable; TypeScript ^5

## Key Libraries & Frameworks

Carries over from epics 001–003. New usage in this epic:

- Process spawning: `Bun.spawn` — used to invoke `sh -c`, `powershell.exe`, `sudo -n -v`, `sudo -S -v`, `sudo -v` (keepalive), and `sudo -k`
- Log file writing: `node:fs/promises` (or `Bun.write`) — concurrent write alongside stdout streaming
- Temp files (Windows only): `node:os` `tmpdir()` + `node:fs/promises` — write `.ps1` temp file, delete in `finally`
- No new package dependencies

## Tooling

Unchanged from epics 001–003:

- Build: `bun build` with `--compile`
- Test: `bun test` (co-located `.test.ts` files, injectable deps pattern)
- Lint/Format: Biome (tabs, double quotes)
- Package manager: Bun only

## Module Layout

New directory introduced by this epic:

```
src/execution/
  index.ts          # runScriptExecution(manifestResult, preExecResult, deps?): Promise<ScriptRunResult>
  index.test.ts
  scriptRunner.ts   # executes scripts sequentially, inherits stdout/stderr
  scriptRunner.test.ts
  sudoScreen.ts     # Unix-only sudo password prompt (shown before execution)
  sudoScreen.test.ts
  keepalive.ts      # sudo -v keepalive timer helpers
  keepalive.test.ts
```

TTY guard added to `src/index.ts` before any other logic.

## TypeScript Types

### PreExecutionResult (updated)

`PreExecutionResult` gains `installedIds` carried through from `ScriptSelectionResult`:

```typescript
interface PreExecutionResult {
  orderedScripts: ScriptEntry[];
  inputs: ScriptInputs;
  installedIds: Set<string>; // IDs whose creates path exists on disk
}
```

The pre-execution orchestrator (`runPreExecution`) receives `installedIds` via `ScriptSelectionResult` and includes it in the returned `PreExecutionResult`.

### ScriptRunResult

```typescript
type ScriptRunResult =
  | { success: true }
  | { success: false; failedScript: ScriptEntry; exitCode: number };
```

## Script Content Sourcing

The execution engine receives script content via an injectable `readScript` dep — consistent with the injectable deps pattern used throughout the codebase.

```typescript
export interface ExecutionDeps {
  readScript: (entry: ScriptEntry) => Promise<string>;
  // ... other deps
}
```

`program.ts` wires this based on `ManifestResult`:
- **Cached mode**: reads from `~/.scriptor/cache/<owner>/<repo>/scripts/<key>` (strip `scripts/` prefix from `entry.script`)
- **Local mode**: reads from `<localRoot>/<entry.script>` directly from disk

`program.ts` receives both `ManifestResult` (from `runStartup`) and `PreExecutionResult` (from `runPreExecution`), so both are in scope for wiring.

`ProgramDeps` gains:

```typescript
runScriptExecution: (
  manifestResult: ManifestResult,
  preExecResult: PreExecutionResult,
) => Promise<ScriptRunResult>;
```

## Wiring to program.ts

```typescript
const result = await deps.runStartup({ host, repo, localMode });
const selectionResult = await deps.runScriptSelection(result);
const preExecResult = await deps.runPreExecution(selectionResult);
const runResult = await deps.runScriptExecution(result, preExecResult);
// log result.logFile; exit with appropriate code
```

The `outro("Done")` call is removed — the execution engine writes its own final output directly to stdout.

## Unix Sudo Screen

The sudo screen runs **after** the `@clack/prompts` session ends and before script execution. It uses raw TTY input directly.

```typescript
// sudoScreen.ts — raw keypress loop
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.on("data", (chunk: Buffer) => {
  if (chunk[0] === 0x1b) process.exit(0);   // Esc → exit entirely
  if (chunk[0] === 0x0d) submit();           // Enter → validate
  if (chunk[0] === 0x7f) deleteLast();       // Backspace/Delete
  else appendChar(chunk.toString());         // printable char → echo '*'
});
```

- On mount: spawn `sudo -n -v` (non-interactive). Exit 0 → credentials cached → skip prompt entirely, proceed to execution.
- Password submission: spawn `sudo -S -v` with password on stdin.
  - Success → proceed to execution.
  - Failure → print red error, clear buffer, return to prompt. Unlimited retries.
- Output: print each typed character as `*` to stdout; Backspace erases last `*`.
- All `process.stdin.setRawMode` / `process.stdin.resume` / `process.stdin.pause` calls are injectable deps for testability.

## Process Spawn & Output Streaming

Scripts are spawned via `Bun.spawn` with `stdout: "inherit"`, `stderr: "inherit"`, and `stdin: "inherit"`. Output goes directly to the terminal — no buffering, no indentation, no log capture.

```typescript
const proc = Bun.spawn(["sh", "-c", content, "sh", ...args], {
  stdout: "inherit",
  stderr: "inherit",
  stdin: "inherit",
});
await proc.exited;
```

This ensures interactive tools (apt-get progress bars, curl, etc.) render correctly in the terminal.

## Sudo Keepalive

Per-elevation-script keepalive via `setInterval`:

```typescript
// Before spawning each requires_elevation script:
const timer = setInterval(() => {
  Bun.spawn(["sudo", "-v"], { stdout: "ignore", stderr: "ignore" });
}, 4 * 60 * 1000); // 4 minutes

try {
  await runScript(entry);
} finally {
  clearInterval(timer);
  Bun.spawn(["sudo", "-k"], { stdout: "ignore", stderr: "ignore" }); // invalidate
}
```

Non-elevation scripts run without any keepalive.

## TTY Guard

Added to `src/index.ts` **before** any other logic (before `buildProgram`, before `import` side effects that touch the terminal):

```typescript
if (!process.stdin.isTTY) {
  process.stderr.write(
    "[scriptor] ERROR: Scriptor requires an interactive terminal.\nstdin is not a TTY — run Scriptor directly in a terminal, not piped.\n"
  );
  process.exit(1);
}
```

## Exit Codes

`program.ts` (or `index.ts`) exits based on `ScriptRunResult.success`:
- `true` → `process.exit(0)`
- `false` → `process.exit(1)`

## Architecture Patterns

All carry over from epics 001–003:

- Injectable deps on all functions with side effects; real implementations wired via lazy dynamic import
- All `@clack/prompts` interaction is complete before execution begins — no clack calls inside `src/execution/`
- The `outro("Done")` call currently in `program.ts` is removed — the execution engine writes its own terminal output directly to `process.stdout`

## Constraints & Non-Goals

- All dependencies must be pure JS/TS — no native modules (Bun binary compilation constraint)
- Scripts run sequentially — no parallel execution
- Execution halts on the first failure — no continue-on-error
- No Ink/React — no `@clack/prompts` — execution output is plain stdout writes
- Scriptor never runs scripts under `sudo` — scripts handle their own privilege escalation
- `setRawMode`, `resume`, `pause` on `process.stdin` are injectable deps in `sudoScreen.ts` for testability

## Open Questions

- None.
- Process spawn approach: how to simultaneously stream script output to stdout and write to the log file?
