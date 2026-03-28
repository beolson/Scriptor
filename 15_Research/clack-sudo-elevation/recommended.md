# Recommended: Sudo Elevation via @clack/prompts.password()

**Date:** 2026-03-28
**Decision:** Replace the hand-rolled raw-TTY loop in `execution/sudoScreen.ts` with `@clack/prompts.password()`.

---

## Recommendation

Use `@clack/prompts.password()` + a `while` loop for sudo elevation. The pattern is:

1. `spinner()` → `sudo -n -v` to check for cached credentials (non-interactive, fast)
2. If cached: skip password prompt entirely
3. If not cached: call `password()` in a retry loop, submit each attempt to `sudo -S -v` via a Bun pipe stdin

```typescript
import { cancel, intro, isCancel, log, outro, password, spinner } from "@clack/prompts";

// 1. Check cache
const s = spinner();
s.start("Checking for cached sudo credentials…");
const cached = (await Bun.spawn(["sudo", "-n", "-v"], { stdout: "ignore", stderr: "ignore" }).exited) === 0;

if (cached) {
  s.stop("Already cached.");
  return;
}
s.stop("Password required.");

// 2. Retry loop
let attempts = 0;
while (true) {
  attempts++;

  const passwd = await password({
    message: attempts === 1 ? "Enter your sudo password:" : "Incorrect password. Try again:",
    mask: "*",
  });

  if (isCancel(passwd)) {
    cancel("Cancelled.");
    process.exit(0);
  }

  // 3. Validate via sudo -S -v
  const proc = Bun.spawn(["sudo", "-S", "-v"], { stdin: "pipe", stdout: "ignore", stderr: "ignore" });
  proc.stdin.write(`${passwd}\n`);
  proc.stdin.end();

  if ((await proc.exited) === 0) {
    log.success("Sudo credentials validated.");
    break;
  }

  log.error("Incorrect password.");
}
```

---

## Why This Replaces the Current Implementation

The current `execution/sudoScreen.ts` manually manages raw mode:
- `process.stdin.setRawMode(true)` / `false`
- Byte-by-byte stdin listener (`process.stdin.on("data", handler)`)
- Manual `*` echo, backspace handling, Esc-to-exit

`@clack/core`'s `Prompt` base class handles all of this internally. Using `password()` means:
- No raw mode management in application code
- Consistent styling with every other screen (text, confirm, select)
- `validate()` hook available (if needed, e.g. "password cannot be empty")
- `isCancel()` replaces the Esc byte check — cleaner cancel semantics

The only adaptation needed is the retry loop: `password()` does not loop internally, so wrap it in a `while (true)` and call it again on failure.

---

## Key API Details

**Package:** `@clack/prompts@0.10.1` (already installed in `tui/package.json`)

```typescript
interface PasswordOptions {
  message: string;
  mask?: string;                                         // default: bullet point •
  validate?: (value: string) => string | Error | undefined;
}

declare const password: (opts: PasswordOptions) => Promise<string | symbol>;
```

- Returns `string` on submit, `symbol` (the cancel symbol) on Ctrl+C
- Use `isCancel(result)` to distinguish
- `mask` can be any single character — `"*"` matches the current implementation's echo behavior
- `validate` runs before submit, shows inline error if it returns a string — useful for "must not be empty" guard

---

## sudo -S Notes

`sudo -S` reads the password from stdin. Key behavior:
- Expects `password\n` (newline-terminated)
- Writes prompt to stderr, not stdout — safe to pipe stdout/stderr to `"ignore"`
- Exit 0 = valid credentials, exit 1 = bad password or policy rejection
- After a failed `-S -v`, the timestamp is not updated — safe to retry

---

## References

- [@clack/prompts source](https://github.com/bombshell-dev/clack/tree/main/packages/prompts)
- [@clack/core Prompt base class](https://github.com/bombshell-dev/clack/tree/main/packages/core)
- [sudo -S man page](https://www.sudo.ws/docs/man/sudo.man/)
- Current implementation: `20_Applications/tui/src/execution/sudoScreen.ts`
- Prior TUI library research: `15_Research/tui-library-selection/recommended.md`
