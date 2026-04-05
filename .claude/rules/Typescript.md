---
description: TypeScript coding standards for this Bun-based project
globs: ["**/*.ts", "**/*.tsx"]
---

# TypeScript Rules

## Import Organization

All `import` statements must appear at the top of the file, before any executable code.

- No imports scattered through the file body
- Static imports only at the top level — do not use dynamic `import()` for modules that could be static top-level imports
- Group imports in this order, separated by a blank line:
  1. Bun built-ins (`bun:sqlite`, `bun:test`, etc.)
  2. Node.js built-ins (`node:fs`, `node:path`, etc.)
  3. External packages
  4. Internal/relative imports

```ts
// Good
import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { parseConfig } from './config.ts';

export function run() { ... }
```

```ts
// Bad — import in the middle of the file
export function run() { ... }

import yaml from 'js-yaml'; // ❌
```

---

## Prefer Bun Native APIs

This project runs on Bun. Use Bun-native APIs instead of Node.js equivalents wherever available.

### File I/O

| Instead of | Use |
|---|---|
| `fs.readFile` / `fs.promises.readFile` | `await Bun.file(path).text()` |
| `fs.readFile` (JSON) | `await Bun.file(path).json()` |
| `fs.readFile` (binary) | `await Bun.file(path).arrayBuffer()` |
| `fs.writeFile` / `fs.promises.writeFile` | `await Bun.write(path, data)` |
| `fs.createReadStream` | `Bun.file(path).stream()` |
| Manual recursive glob | `new Bun.Glob(pattern)` → `glob.scan(dir)` |

```ts
// Good
const text = await Bun.file('./data.json').json();
await Bun.write('./output.txt', result);

// Bad
import { readFile, writeFile } from 'node:fs/promises'; // ❌ for read/write
```

### Environment Variables

Bun automatically loads `.env` — no `dotenv` package needed.

| Instead of | Use |
|---|---|
| `process.env.VAR` | `Bun.env.VAR` |
| `dotenv` package | (not needed) |

### Process Spawning

| Instead of | Use |
|---|---|
| `child_process.spawn` | `Bun.spawn()` |
| `child_process.spawnSync` | `Bun.spawnSync()` |
| `child_process.exec` | `Bun.spawn({ cmd, shell: true })` |

### HTTP Server

| Instead of | Use |
|---|---|
| `http.createServer()` | `Bun.serve()` |
| `https.createServer()` | `Bun.serve({ tls: {...} })` |

Use Web-standard `Request`, `Response`, and `Headers` objects inside the handler.

### WebSockets

| Instead of | Use |
|---|---|
| `ws` package | `Bun.serve({ websocket: {...} })` |

### Crypto / Hashing

| Instead of | Use |
|---|---|
| `crypto.createHash(algo)` | `new Bun.CryptoHasher(algo)` |
| `crypto.createHmac(algo, key)` | `new Bun.CryptoHasher(algo, key)` |
| `bcrypt` / `argon2` packages | `Bun.password.hash()` / `Bun.password.verify()` |

### Database

| Instead of | Use |
|---|---|
| `better-sqlite3` | `import { Database } from 'bun:sqlite'` |

### Testing

| Instead of | Use |
|---|---|
| `jest` / `vitest` | `import { describe, it, expect } from 'bun:test'` |

Run tests with `bun test`.

### Bundling

| Instead of | Use |
|---|---|
| webpack / rollup / parcel / esbuild | `Bun.build()` or `bun build` CLI |

### Streams

| Instead of | Use |
|---|---|
| Node.js `Readable` / `Writable` | Web standard `ReadableStream` / `WritableStream` |
| `fs.createReadStream` | `Bun.file(path).stream()` |

---

## Error Handling

Catch blocks must not simply log and exit. That pattern swallows context and makes errors hard to trace.

**A catch block must do one of:**

1. **Recover** — take a concrete action that fixes the problem and allows execution to continue
2. **Rethrow with context** — wrap the error with additional details and re-throw
3. **Not exist** — if there is nothing useful to do in the catch, remove the try/catch and let the error propagate

```ts
// Good — rethrow with context
try {
  config = loadConfig(cwd);
} catch (err) {
  throw new Error(`Failed to load config from ${cwd}: ${(err as Error).message}`, { cause: err });
}

// Good — recover
try {
  data = JSON.parse(raw);
} catch {
  data = defaultData;
}

// Bad — log and exit ❌
try {
  config = loadConfig(cwd);
} catch (err) {
  console.error(`Error loading config: ${(err as Error).message}`);
  process.exit(1);
}
```

**Top-level error boundary:** Each entry point (`main()` or equivalent) should have a single top-level try/catch that formats and reports unhandled errors before exiting. All other catch blocks should recover or rethrow — never exit.

```ts
// Good — single boundary at the entry point
async function main() {
  // ... no try/catch inside unless recovering or rethrowing
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
```

---

## Acceptable Node.js Compatibility APIs

Use the `node:` prefix for operations without a Bun-native equivalent:

- `node:fs` — for `mkdir`, `readdir`, `stat`, `rename`, `unlink`, `rm`, `rmdir`
- `node:path` — path manipulation (`join`, `resolve`, `dirname`, `basename`)
- `node:crypto` — for operations not covered by `Bun.CryptoHasher`
- `node:readline` — interactive line-by-line stdin reading
