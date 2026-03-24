# Scriptor — Remaining Work

Gap analysis against `10_Specifications/10.20_Ideas/10.20.001_Tui/functional.md`.

---

## What is covered ✅

| Area | Epic |
|---|---|
| CLI `--repo` flag + config file | 001 |
| Host detection (platform / arch / distro) | 001 |
| Cache-first startup + "Check for updates?" prompt | 001 |
| OAuth device flow + OS keychain persistence | 001 |
| Local mode (`--repo=local`) | 001 |
| Manifest parsing + Zod validation | 002 |
| Host filtering (platform / arch / distro exact match) | 002 |
| Installed-status detection (`creates` field) | 002 |
| Main menu + group shortcut + individual multi-select | 002 |
| Dependency resolution (DFS collect + topological sort) | 002 |
| Input collection (string / number / ssl-cert) | 003 |
| Input deduplication across scripts by ID | 003 |
| Confirmation screen with execution plan | 003 |
| Windows admin pre-flight (`net session`) | 003 |

---

## What is still missing ❌

### 1. Script Execution Engine
> Spec: §9 (ScriptRunner), §11.4 (Installed-Items arg)

The biggest gap — nothing runs scripts after pre-execution completes.

- `ScriptRunner` module: execute scripts sequentially, halt on first failure
- `ProgressEvent` types: `pending | running | output | done | failed`
- **Unix invocation**: `sh -c {scriptContent} sh {arg1} … {installedArg}`
- **Windows invocation**: write temp `.ps1` with UTF-8 directives → `powershell.exe -NonInteractive -NoProfile -ExecutionPolicy Bypass -File {tmpfile} {args}` → delete in `finally`
- **Argument list**: inputs in declaration order + colon-separated installed IDs as final positional (`"id1:id2:id3"`)
- `ScriptRunResult: { success, logFile, failedScript?, exitCode? }`

### 2. Execution Output Display
> Spec: §5.7

After the TUI exits, render progress to stdout:

```
· Script Name          ← pending
› Script Name          ← running
  output line 1
  output line 2
✓ Script Name          ← done
✗ Failed Script        ← failed (exit code N)
  last output line

Log file: /home/user/.scriptor/logs/2026-03-24T12-00-00.log
```

- Process exits 0 (all success) or 1 (any failure)

### 3. Log Files
> Spec: §13.4

- Directory: `~/.scriptor/logs/`
- Filename: `YYYY-MM-DDTHH-MM-SS.log` (UTC); same-second collisions get `-1`, `-2` suffix
- Per-script format: separator → `Script / Started` → inputs section → raw output → `Ended / Exit code` → separator
- Execution engine writes to log AND streams to stdout simultaneously

### 4. Unix Sudo Elevation
> Spec: §5.5 (Elevation Screen), §12.2

Epic 003 ships Windows-only. Unix workflow needs a separate epic:

- `checkSudoCached()` → `sudo -n -v` (non-interactive)
- Password prompt screen with asterisk masking
- `validateSudoWithPassword(pw)` → `sudo -S -v`
- Retry on failure with red error message
- `startKeepalive()` → `sudo -v` every 4 min during execution
- `invalidateSudo()` → `sudo -k` in `finally` after execution
- `Esc` → back to Confirmation Screen

### 5. Binary Self-Update
> Spec: §15; Epic 001 acceptance criteria

Epic 001 specs it but the orchestrator doesn't implement it. Needed:

- Compare installed `VERSION` against latest GitHub release tag (semver)
- Update screen phases: `prompt` → `downloading` → `done` / `error`
- Unix/Mac: download to temp → atomic rename over current binary
- Windows: download as `scriptor-new.exe` → manual instructions (can't replace running exe)
- Shown **before** the startup fetch sequence

### 6. Wiring: Execution after Pre-Execution
> Spec: §6 App State Machine

`program.ts` currently wires: startup → script selection → pre-execution. The hand-off from `PreExecutionResult` into `ScriptRunner` needs to be built once the execution engine exists.

### 7. TTY Guard
> Spec: §2.3

Small — add before any TUI rendering in `index.ts`:

```
[scriptor] ERROR: Scriptor requires an interactive terminal.
stdin is not a TTY — run Scriptor directly in a terminal, not piped.
```

`process.stdin.isTTY` → if false: stderr + exit 1.

---

## Deliberate simplifications (not gaps)

These diverged from the original ideas intentionally when the epics were written:

| Original idea | What was built |
|---|---|
| Ink-based collapsible script list (`▶▼ [x][~][✓]`) | `@clack/prompts` `select()` + `multiselect()` — simpler, no React/Ink |
| Commit-hash cache freshness (auto) | "Check for updates?" prompt — user-driven |
| Q key to quit at every screen | Esc/Ctrl+C exits at every prompt |

---

## Suggested epic order

| # | Epic | Key deliverables |
|---|---|---|
| 004 | **Script Execution** | ScriptRunner, ProgressEvent, Unix + Windows invocation, installed-items arg, halt-on-fail, ScriptRunResult |
| 005 | **Execution Output + Log Files** | Stdout display (icons + indented output), log file writer, final exit code |
| 006 | **Unix Sudo Elevation** | Password screen, keepalive, invalidate, Esc→back |
| 007 | **Binary Self-Update** | Version compare, update screen, atomic binary replace |
| 008 | **TTY Guard** | Single check in `index.ts` |
