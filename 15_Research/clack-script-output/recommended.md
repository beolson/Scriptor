# Recommended: Clack Script Output APIs

**Date:** 2026-03-28
**Decision:** Use `stream.*()` for formatted script output, with a raw-stdout fallback for `\r`-heavy scripts.

---

## Output API Selection Guide

| Scenario | Use | Why |
|---|---|---|
| Short labeled message (status, result) | `log.*()` | Sync, correct for fixed strings |
| Short-to-medium variable-length text | `stream.*()` | Chunk-level wrapping, ANSI-aware |
| Real subprocess stdout | `stream.*()` + `spawnOutput()` | Async-iterable bridge |
| Progress indicator during async work | `spinner()` | In-place updates, no new lines |
| Multiple scripts, each with status | `tasks()` | Per-task spinner + final message |
| Scripts using `\r` (apt-get, curl, wget) | raw `stdout: "inherit"` | `\r` not handled — must bypass |

---

## The Subprocess → AsyncIterable Bridge

Bun's `ReadableStream<Uint8Array>` (from `stdout: "pipe"`) is natively async-iterable.
This pattern feeds it directly into any `stream.*()` call:

```typescript
async function* spawnOutput(cmd: string[]): AsyncGenerator<string> {
    const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "inherit" });
    const decoder = new TextDecoder();
    for await (const chunk of proc.stdout) {
        yield decoder.decode(chunk);
    }
    await proc.exited;
}

// Usage:
await stream.step(spawnOutput(["bash", "-c", "ls -la /usr/bin | head -20"]));
```

Output is prefixed with `│  ` and ANSI color codes pass through intact. The prefix is maintained
as long as individual chunks fit within the terminal width — typical subprocess lines (ls, echo,
apt-get status lines) are fine. Very long single-line output will overflow without `│  ` on the
terminal-wrapped portion (see Key Limitations below).

---

## `tasks()` for Multi-Script Execution

The `tasks()` API (undocumented in the README but present in `@clack/prompts@0.10.1`) runs
each task with an individual spinner and status update:

```typescript
import { tasks } from "@clack/prompts";

await tasks([
    {
        title: "Installing base packages",
        task: async (message) => {
            message("Downloading...");   // updates the spinner text
            await doWork();
            return "installed";          // becomes the final stop message
        },
    },
    {
        title: "Configuring system",
        task: async () => {
            await doWork();
            return "configured";
        },
        enabled: condition,              // optional: skip this task
    },
]);
```

Renders as sequential spinners: each starts, can update mid-task, then stops with a
success message. This maps directly to Scriptor's multi-script execution flow.

---

## Key Limitations

### 1. `\r` causes display corruption

`stream.*()` replaces `\n` with `\n│  ` (indented continuation) but does NOT handle `\r`.
Scripts that use carriage-return for in-place progress bars (apt-get, curl, wget, pip
progress bars, etc.) will return the cursor to column 0, overwriting the `│  ` prefix.

**Mitigation**: Detect `\r` in output and switch to raw `stdout: "inherit"`.
Or: strip `\r` and only show final-line output (loses progress animation, gains stability).

### 2. `stdout.columns` is undefined in non-TTY contexts

Auto-wrapping only works when running in an actual terminal (TTY). When output is piped
(CI, log capture, test runners), `process.stdout.columns` is `undefined`. In this case,
`stream.*()` wraps every chunk — one per line — regardless of length. This is not
incorrect behavior, but it means the demo looks different when captured vs. run live.

### 3. `stream.*()` wraps at chunk boundaries, not character boundaries

Confirmed in a real terminal: when a chunk doesn't fit on the current line, `stream.*()` moves
it to a new line with `│  `. But if the chunk itself is wider than the terminal, the overflow
is hard-wrapped by the terminal **without** `│  `. Resizing the terminal changes where the
hard-wrap falls but doesn't fix the missing prefix.

`stream.*()` is designed for many small chunks (streaming tokens, progress words, short lines).
For subprocess output where single lines could be very long (compiler errors, stack traces, long
paths), the `│  ` prefix will be lost on overflow — same as `log.*()`.

### 4. `log.*()` does not auto-wrap

Long single-line strings will exceed terminal width regardless of chunk size.

### 5. Blank `│  ` lines between content lines

When each chunk ends with `\n`, `stream.*()` replaces it with `\n│  ` — leaving an empty
indented line before the next chunk. For clean line-by-line output, either:
- Yield without trailing `\n` and rely on `stream.*()` for line assembly, or
- Accept the visual spacing (it reads clearly in practice and separates log lines)

---

## `stream.*()` API Reference

```typescript
import { stream } from "@clack/prompts";

// All variants accept Iterable<string> | AsyncIterable<string>
await stream.info(iterable);       // ● blue
await stream.success(iterable);    // ◆ green
await stream.step(iterable);       // ◇ green
await stream.warn(iterable);       // ▲ yellow
await stream.error(iterable);      // ■ red
await stream.message(iterable, { symbol: customSymbol });
```

---

## References

- `@clack/prompts@0.10.1` source: `node_modules/@clack/prompts/dist/index.mjs`
- Demo app: `15_Research/clack-script-output/demo.ts` (run with `bun demo.ts`)
- Prior research: `15_Research/clack-sudo-elevation/recommended.md`
- Prior TUI decision: `15_Research/tui-library-selection/recommended.md`
