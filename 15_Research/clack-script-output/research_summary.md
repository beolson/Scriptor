# Research Summary: Clack Script Output Capabilities

**Date:** 2026-03-28
**Scope:** Can `@clack/prompts` display script execution output cleanly, addressing the display issues encountered with other TUI approaches (variable-length output, long lines, log volume)?
**Outcome:** Partially — `stream.*()` works well for short-to-medium chunks but does NOT wrap long lines within a single chunk. The `│  ` prefix is only guaranteed when chunks are smaller than the terminal width.

---

## Motivation

Scriptor's current two-phase design exits the TUI completely before running scripts, then scripts
output raw stdout to the terminal. The question was whether Clack could format that output — adding
the `│  ` prefix, handling wrapping, and giving visual structure — without reintroducing the
display corruption issues that plagued Ink (cursor tracking conflicts, subprocess stdout clobbering).

---

## Threads Investigated

### Thread 1: @clack/prompts output API surface

**What we looked at:**
- `@clack/prompts@0.10.1/dist/index.d.ts` — type definitions
- `@clack/prompts@0.10.1/dist/index.mjs` — minified implementation

**What we found:**

Six `log.*()` functions (sync, no auto-wrap, split on `\n` only):
```typescript
log.info(message: string): void
log.success(message: string): void
log.step(message: string): void
log.warn(message: string): void
log.error(message: string): void     // alias: log.warning
log.message(message: string, { symbol?: string }): void
```

Six `stream.*()` functions (async, auto-wrap, accepts `AsyncIterable<string>`):
```typescript
stream.info(iterable): Promise<void>
stream.success(iterable): Promise<void>
stream.step(iterable): Promise<void>
stream.warn(iterable): Promise<void>
stream.error(iterable): Promise<void>
stream.message(iterable, { symbol? }): Promise<void>
```

`note(message, title)` — Unicode box, no max-width, no wrapping.

`spinner({ indicator? })` — `'dots'` (default) or `'timer'` (elapsed).
`stop(msg, code)`: code 0 → ✔, code 1 → ✖.

`tasks(Task[])` — undocumented but confirmed present. Runs each task with its own spinner.
`Task.task(message)` receives a status update callback; return value is the final stop message.

---

### Thread 2: stream.*() implementation — wrapping, ANSI, `\r`

**What we looked at:**
- The `stream.message` function in minified index.mjs (lines 75-81)

**What we found (verbatim logic):**
```js
stream.message = async (iterable, {symbol}={}) => {
    process.stdout.write(`${gray(│)}\n${symbol}  `);
    let columnPos = 3;
    for await (let chunk of iterable) {
        chunk = chunk.replace(/\n/g, `\n${J}`);   // J = "│  "
        chunk.includes('\n') && (columnPos = 3 + stripVTControlCharacters(chunk.slice(chunk.lastIndexOf('\n'))).length);
        const len = stripVTControlCharacters(chunk).length;
        if (columnPos + len < process.stdout.columns) {
            columnPos += len;
            process.stdout.write(chunk);
        } else {
            process.stdout.write(`\n${J}${chunk.trimStart()}`);
            columnPos = 3 + stripVTControlCharacters(chunk.trimStart()).length;
        }
    }
    process.stdout.write('\n');
}
```

Key observations:
- **ANSI passthrough**: `stripVTControlCharacters` is used ONLY for width measurement. ANSI codes in the stream are written verbatim — colored subprocess output stays colored.
- **`\r` is NOT handled**: Only `\n` is replaced. `\r` causes the cursor to return to column 0, overwriting the `│  ` prefix — confirmed via demo.
- **`stdout.columns` undefined in non-TTY**: In piped/CI contexts, `columnPos + len < undefined` is always false, causing every chunk to wrap individually (one chunk per line). In a real TTY this works correctly.
- **Wrapping is chunk-level, NOT character-level** (confirmed in terminal): When a chunk doesn't fit on the current line, `stream.*()` writes `\n│  ` + the entire chunk. If the chunk itself is wider than the terminal, the terminal hard-wraps the overflow **without** the `│  ` prefix. The `│  ` is only preserved if the chunk is small enough to fit on one terminal line after being moved. This means `stream.*()` is designed for many small chunks (streaming tokens, progress words), not for formatting arbitrary-length lines from a subprocess. Short output lines (e.g. `ls`, `echo`) work correctly because each line typically fits in one chunk. Long single-line output (compiler errors, long paths, stack traces) will overflow without `│  ` on the wrapped portion.

---

### Thread 3: Bun subprocess → AsyncIterable bridge

**What we looked at:**
- Bun's `ReadableStream<Uint8Array>` returned by `Bun.spawn({ stdout: "pipe" })`
- Whether it satisfies `AsyncIterable<string>`

**What we found:**
- Bun's `ReadableStream` is natively async-iterable — `for await (const chunk of proc.stdout)` works directly.
- Chunks are `Uint8Array`, need `TextDecoder` to get strings.
- This pattern works with zero additional dependencies:

```typescript
async function* spawnOutput(cmd: string[]): AsyncGenerator<string> {
    const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "inherit" });
    const decoder = new TextDecoder();
    for await (const chunk of proc.stdout) {
        yield decoder.decode(chunk);
    }
    await proc.exited;
}

await stream.step(spawnOutput(["bash", "-c", "ls -la /usr/bin | head -20"]));
```

Confirmed working via demo: real `ls -la` output displays with `│  ` prefix on each line.

---

### Thread 4: Chunk granularity and blank line behavior

**What we found (from running demo):**
When chunks end with `\n` (the natural pattern for line-by-line output), `stream.*()` replaces
the `\n` with `\n│  `, leaving an empty `│  ` line before each new chunk. The visual result is
extra spacing between output lines.

This is not a bug — it's consistent behavior — but it means line-by-line script output gets
visual separation between lines, which may or may not be desirable.

From subprocess output, chunk boundaries depend on OS pipe buffering: multiple lines often
arrive in a single chunk (seen in demo: echo loop lines 1–3 in one chunk), which renders without
the extra spacing.

---

### Thread 5: tasks() API for multi-script execution

**What we found:**
`tasks()` is not in the README but is exported from `@clack/prompts@0.10.1`. Implementation:
```js
Te=async t=>{
    for(const n of t){
        if(n.enabled===!1)continue;
        const r=Y();  // spinner()
        r.start(n.title);
        const i=await n.task(r.message);  // passes message() callback
        r.stop(i||n.title)
    }
}
```

Each task: spinner starts with `title`, `task()` can call `message()` to update spinner text,
spinner stops with the returned string (or falls back to `title`). Tasks run sequentially.

This maps directly to Scriptor's multi-script execution: one task per selected script, spinner
shows script name, mid-task updates can show stage ("downloading", "configuring"), stop message
confirms completion or failure.

---

## Paths Rejected

### Keep raw stdout for all execution output
**Why rejected:**
- Already the current design (intentional two-phase). This research validates adding an optional
  formatted layer on top — not replacing the two-phase architecture, but deciding what the
  formatted option looks like.
- For `\r`-heavy scripts: raw stdout remains the right call.

### Use `log.*()` for script output
**Why rejected:**
- No auto-wrap: long output lines (file paths, package names, URLs) overflow terminal width.
- Sync only: cannot feed subprocess output line by line without buffering everything first.

### Buffer all output, display on completion
**Why rejected:**
- Defeats the purpose — users lose real-time visibility into what's happening.
- Large output (package managers, compiler output) could buffer MBs.

---

## Key Findings Summary

1. `stream.*()` works well for short-to-medium chunk output (typical subprocess lines, progress
   words) — async, ANSI-passthrough, `│  ` prefix maintained when chunks fit within terminal width.
2. `stream.*()` does NOT wrap within a chunk — if a single chunk exceeds terminal width, the
   overflow is hard-wrapped by the terminal without `│  `. The demo's "long line" section confirmed
   this in a real terminal: resizing the window changed where the terminal wrapped but `│  ` was
   still absent on the overflow portion.
3. The Bun `ReadableStream → AsyncGenerator<string>` bridge is ~6 lines and works natively.
4. `tasks()` is useful for multi-script execution display — undocumented but stable.
5. `\r` is a hard limitation. Scripts using progress bars must use raw stdout.
6. `stdout.columns = undefined` in non-TTY wraps every chunk individually. Not a production
   concern (Scriptor runs in a user's terminal) but affects test/CI output.
7. Blank lines between `\n`-terminated chunks are a visual side effect, not an error.

---

## Open Questions

1. **`\r` detection at runtime**: Could we detect `\r` in the incoming stream and fall back to
   raw stdout mid-execution? Or is the "which scripts use `\r`" decision better made statically
   (e.g., a field in `scriptor.yaml`)? Not researched.

2. **stderr interleaving**: The demo used `stderr: "inherit"` for subprocess output. Stderr goes
   directly to the terminal without `│  ` prefix — it would interleave visually with the stream
   output. Should stderr be captured and fed through `stream.error()` separately? Not researched.

3. **tasks() + stream.*() composition**: Can a `tasks()` task also call `stream.*()` internally
   to show per-line output within a spinner? Not tested — the spinner's cursor management may
   conflict with stream output.

---

## Files Examined

| File | Purpose |
|------|---------|
| `node_modules/@clack/prompts/dist/index.d.ts` | Type definitions |
| `node_modules/@clack/prompts/dist/index.mjs` | Implementation (minified) |
| `15_Research/clack-sudo-elevation/research_summary.md` | Prior Clack research restored for context |
| `15_Research/tui-library-selection/research_summary.md` | Prior TUI decision restored for context |

## Proof of Concept

`demo.ts` in this folder is runnable and self-contained:

```
bun 15_Research/clack-script-output/demo.ts
```

Exercises all sections: log.*, note(), spinner() (dots + timer), stream.* (simulated + real
subprocess), tasks(), and the `\r` corruption edge case.
