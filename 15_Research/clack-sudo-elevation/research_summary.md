# Research Summary: Sudo Elevation in a Clack Flow

**Date:** 2026-03-28
**Scope:** Can `@clack/prompts.password()` replace the hand-rolled raw-TTY sudo password loop?
**Outcome:** Yes — feasible, simpler, consistent. See `recommended.md`.

---

## Motivation

The existing `execution/sudoScreen.ts` implements a raw-mode password prompt manually:
byte-by-byte stdin listener, manual `*` echo, backspace handling, Esc-to-exit via byte `0x1b`.
This predates the adoption of `@clack/prompts` for all other screens. The question was whether
`@clack/prompts.password()` could own this interaction instead.

---

## Threads Investigated

### Thread 1: Current sudoScreen.ts implementation

**What we looked at:**
- `20_Applications/tui/src/execution/sudoScreen.ts` — full implementation
- `20_Applications/tui/src/execution/index.ts` — where sudo screen is called
- `20_Applications/tui/src/execution/keepalive.ts` — credential refresh timer
- `20_Applications/tui/src/execution/scriptRunner.ts` — script execution with keepalive

**What we found:**
- Sudo flow: `sudo -n -v` (check cache) → if cached skip → else raw-mode loop → `sudo -S -v`
- Raw mode: `process.stdin.setRawMode(true)`, byte listener, manual echo `*`, Esc exits app
- Unlimited retries: loop re-registers listener on failure, no cap
- Password submitted via `Bun.spawn(["sudo", "-S", "-v"], { stdin: "pipe" })` with `proc.stdin.write(${password}\n)`
- Scripts do NOT wrap in `sudo` — they run under `sh` with inherited TTY, credentials maintained by keepalive

**Why it was built this way:**
At the time of writing, `@clack/prompts` was not yet in the codebase. The raw-mode loop
is a direct port of what a traditional sudo prompt would do.

---

### Thread 2: @clack/prompts password() API

**What we looked at:**
- `node_modules/.bun/@clack+prompts@0.10.1/node_modules/@clack/prompts/dist/index.d.ts`
- `node_modules/.bun/@clack+core@0.4.2/node_modules/@clack/core/dist/index.d.ts`
- `20_Applications/tui/src/pre-execution/inputCollection.ts` — existing clack usage patterns

**What we found:**
- `password(opts: PasswordOptions): Promise<string | symbol>` — exactly what we need
- `mask?: string` option — supports `"*"` to match current behavior
- `validate?: (value: string) => string | Error | undefined` — optional inline validation
- `@clack/core`'s `Prompt` base class owns `setRawMode(true/false)`, stdin resume/pause
- Existing pattern in `inputCollection.ts`: `isCancel()` check after every prompt, `process.exit(0)` on cancel

**Key insight:**
`password()` takes over the terminal (raw mode) for its duration, then releases it. After
it returns, `process.stdin` is in its pre-prompt state. This makes it safe to call
`Bun.spawn` immediately after — the subprocess uses its own pipe stdin, not `process.stdin`.

---

### Thread 3: Retry loop feasibility

**What we looked at:**
- How `@clack/prompts.text()` handles validation vs how we'd need retries for sudo
- Whether clack has any global state that breaks on multiple `password()` calls

**What we found:**
- `password()` is stateless — each call is independent, creates a new `PasswordPrompt` instance
- No global stdin registration that persists between calls
- Safe to call `password()` in a `while (true)` loop, calling `break` on success
- The `validate` hook runs before submit (client-side), so it won't replace the server-side
  sudo validation — we still need the loop for incorrect passwords
- On attempt > 1, passing a different `message` string is the idiomatic way to signal retry

---

## Paths Rejected

### Keep the manual raw-mode loop

**Why rejected:**
- Significantly more code than the clack alternative (~100 lines vs ~20)
- Inconsistent with every other screen in the TUI (all use `@clack/prompts`)
- Manual raw-mode management is fragile — easy to leave stdin in wrong state on exception
- No benefit unique to the sudo case that clack cannot handle

### Use `validate` hook to avoid the retry loop

**Why rejected:**
- `validate` runs client-side before the subprocess — it can catch empty strings but not wrong passwords
- The subprocess result (`sudo -S -v` exit code) is async and comes after the prompt resolves
- Cannot feed subprocess result back into clack's validate hook
- Must keep the `while` loop

---

## Open Questions at Time of Writing

1. **`sudo -S` newline requirement across distros:** The test.ts uses `${passwd}\n`. This works on
   Ubuntu/Debian. macOS `sudo` behavior with `-S` should be verified by running `test.ts` on macOS.

2. **stderr suppression:** `sudo -S` writes its own "Password:" prompt to stderr. With `stderr: "ignore"`,
   this is suppressed. The clack prompt provides the visual cue instead. Confirm this looks correct
   visually when both `sudo`'s stderr prompt and our clack prompt would otherwise appear.

3. **sudo -S and sudoers `requiretty`:** Some hardened systems set `Defaults requiretty` in sudoers,
   which disallows `sudo -S` entirely. This is an environment constraint, not a clack constraint.
   The current raw-mode loop has the same limitation.

---

## Files Examined

| File | Purpose |
|------|---------|
| `20_Applications/tui/src/execution/sudoScreen.ts` | Current implementation |
| `20_Applications/tui/src/execution/index.ts` | Execution orchestrator |
| `20_Applications/tui/src/execution/keepalive.ts` | Credential keepalive |
| `20_Applications/tui/src/execution/scriptRunner.ts` | Script runner |
| `20_Applications/tui/src/pre-execution/inputCollection.ts` | Clack usage patterns |
| `20_Applications/tui/package.json` | Dependency versions |
| `node_modules/.bun/@clack+prompts@0.10.1/.../index.d.ts` | Password prompt API |
| `node_modules/.bun/@clack+core@0.4.2/.../index.d.ts` | Prompt base class |
| `15_Research/tui-library-selection/recommended.md` | Prior TUI decision |

---

## Proof of Concept

`test.ts` in this folder is the runnable proof. It is standalone and self-contained:

```
bun 15_Research/clack-sudo-elevation/test.ts
```

It exercises all branches: cached credentials (skip prompt), wrong password (retry), correct password
(success), Ctrl+C (clean cancel).
