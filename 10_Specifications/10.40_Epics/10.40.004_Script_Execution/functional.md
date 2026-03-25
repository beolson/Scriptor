# 004 Script Execution Engine

## Summary

Complete the "run scripts" capability end-to-end in one combined epic: TTY guard, Unix sudo elevation screen, script execution engine, streaming output with minimal framing, and the wiring that connects the pre-execution flow result into the execution engine. This covers everything that happens after the user confirms the execution plan — from the sudo password screen through sequential script execution to the final exit code.

---

## Business Value

Users gain confidence through live script output and proper privilege handling — every run is directly visible in the terminal. This epic closes the last gap between selecting scripts and actually executing them, making Scriptor fully functional end-to-end.

---

## User Stories

1. **As a user running Scriptor in a non-TTY context** (e.g., piped or redirected), I want a clear error message immediately rather than a broken or confusing interactive session.

2. **As a user on Unix who selects scripts requiring `sudo`**, I want to enter my password once before execution begins and have Scriptor keep my credentials alive, so the scripts' own `sudo` calls succeed without interrupting me mid-execution.

3. **As a user executing a set of scripts**, I want to see each script's name as it starts running, followed by its live output, so I know exactly what is happening.

4. **As a user whose script run fails partway through**, I want execution to stop immediately with a clear failure message, so I know which script failed and can investigate before proceeding.

---

## Acceptance Criteria

### TTY Guard

- [ ] Before any TUI rendering in `index.ts`, check `process.stdin.isTTY`.
- [ ] If `false`: write the following to `stderr` and exit with code `1`:
  ```
  [scriptor] ERROR: Scriptor requires an interactive terminal.
  stdin is not a TTY — run Scriptor directly in a terminal, not piped.
  ```

### Unix Sudo Elevation Screen

- [ ] Shown after the Confirmation Screen when **any** selected script has `requires_elevation: true` on a Unix (Linux/Mac) host.
- [ ] On mount: runs `sudo -n -v` non-interactively.
  - Exit `0` → credentials already cached → skip prompt, proceed to execution.
  - Non-zero → show password prompt.
- [ ] Password prompt:
  - Displays "Sudo authentication required" header.
  - Accepts typed characters; each character is displayed as `*`.
  - `Backspace`/`Delete` removes the last character.
  - `Enter` submits the password.
  - `Esc` exits Scriptor entirely (TUI and process both exit cleanly).
- [ ] Validation: `sudo -S -v` with password on stdin.
  - Success → proceed to execution.
  - Failure → show "Sudo validation failed. Please try again." (red) and return to the password prompt. No retry limit — user may retry as many times as needed or press `Esc` to exit.
- [ ] **Esc exits Scriptor entirely** (diverges from original spec §5.5 which returned to Confirmation Screen).
- [ ] After successful validation, keepalive is **not** started globally — see execution section for per-script keepalive behavior.
- [ ] The purpose of pre-authentication is to cache credentials so that the scripts' own internal `sudo` calls succeed silently. Scriptor does **not** run scripts under `sudo` — scripts handle their own privilege escalation.

### Script Execution Engine

- [ ] After the TUI exits (Ink process unmounts), `ScriptRunner` executes scripts sequentially.
- [ ] Scripts run in topological order as resolved by the pre-execution flow.

#### Unix invocation
```
sh -c {scriptContent} sh {arg1} {arg2} … {installedArg}
```
All scripts are invoked the same way regardless of `requires_elevation`. Scripts that need elevated privileges call `sudo` themselves internally. Scriptor's role is only to pre-authenticate credentials (see Elevation Screen) and keep them alive via keepalive.

#### Windows invocation
1. Write script content to a temp `.ps1` file: `{tmpdir}/scriptor-{timestamp}-{random}.ps1`
2. Prepend UTF-8 encoding directives:
   ```powershell
   [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
   $OutputEncoding = [System.Text.Encoding]::UTF8
   ```
3. Spawn: `powershell.exe -NonInteractive -NoProfile -ExecutionPolicy Bypass -File {tmpfile} {arg1} {arg2} … {installedArg}`
4. Delete temp file in `finally` block (best-effort; errors ignored).

#### Argument list (both platforms)
- User inputs in declaration order (one arg per input).
- Installed-items string (colon-separated script IDs whose `creates` path exists) as the **final** positional argument.
- Empty installed-items = empty string `""`.

#### Sudo keepalive (Unix only)
- For each script that has `requires_elevation: true`:
  - Start keepalive (`sudo -v` every 4 minutes) immediately before spawning the script, so that the script's own internal `sudo` calls find cached credentials valid.
  - Stop keepalive and run `sudo -k` (invalidate) immediately after the script completes (in a `finally` block).
- Non-sudo scripts run without keepalive.

#### Halt on failure
- If a script exits with a non-zero exit code, execution stops immediately.
- Remaining scripts are **not** started.

#### Return value
```typescript
type ScriptRunResult =
  | { success: true }
  | { success: false; failedScript: ScriptEntry; exitCode: number };
```

### Execution Output (stdout)

After the TUI exits, all execution output goes directly to the terminal — stdout and stderr are inherited from the parent process. No Ink rendering occurs.

**Per script, while running**:
```
Running: Script Name
<script output goes directly to terminal>
```
- Print `Running: {name}` before spawning the script process.
- Script stdout and stderr are inherited; output appears in the terminal exactly as the script produces it.

**On failure** (non-zero exit):
```
✗ Script Name failed (exit code 1)
```
- Print this line to stdout after the script exits.
- Halt; do not run remaining scripts.

**Exit codes**:
- `0` — all scripts succeeded.
- `1` — at least one script failed.

### Wiring

- [ ] `index.ts` / `program.ts` wire the `PreExecutionResult` (confirmed scripts, collected inputs, installed IDs) into `ScriptRunner` after the TUI exits.
- [ ] The execution engine is the final step in the main program flow; there is no further TUI state after execution begins.

---

## Constraints

- Scripts run **sequentially** — no parallel execution.
- Execution **halts on the first failure** — no continue-on-error mode.
- Sudo keepalive is scoped **per requires-elevation script** — not global to the entire run.
- Scriptor **never runs scripts under `sudo`** — scripts manage their own privilege escalation internally.
- **Esc on the sudo screen exits Scriptor entirely** — there is no "back" navigation from this screen.
- The sudo password retry count matches system defaults (unlimited retries until user presses Esc).
- No Ink/React rendering occurs during script execution — all output is plain stdout.

---

## Out of Scope

- **Binary self-update** (separate future epic).
- **Parallel script execution**.
- **Script retry logic** on failure.
- **Windows sudo/admin screen** — already delivered in Epic 003 (`net session` pre-flight check). This epic adds Unix-only sudo elevation.
- **Execution output icons for pending state** — no `·` pending lines printed before execution.

---

## Open Questions

*(none)*
