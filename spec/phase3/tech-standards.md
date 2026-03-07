# Phase 3 Tech Standards

_Living document. Updated via Q&A elicitation. Last updated: 2026-03-06._

---

## Runtime & Language

| Concern | Decision |
|---|---|
| Language | TypeScript (strict mode) — inherited from Phase 1 |
| Runtime / Package Manager | Bun — inherited from Phase 1 |
| TUI Framework | Ink.js — inherited from Phase 1 |

> **Rule:** All Phase 1 Bun conventions apply. Use `bun` / `bunx` / `bun install` / `bun run` / `bun test`. Do not use `node`, `npm`, `yarn`, or `npx`.

---

## Key Libraries & Frameworks

| Library | Purpose |
|---|---|
| `ink` | TUI rendering — inherited |
| `js-yaml` | Parse `scriptor.yaml` — inherited |
| `zod` | Runtime validation of `inputs` schema in `scriptor.yaml` with type inference |
| `node:tls` (built-in) | Open raw TLS socket to fetch certificate chain from remote host |
| `@peculiar/x509` | Parse certificate fields (CN, issuer, expiry) and serialize to PEM/DER |

---

## Tooling

Unchanged from Phase 1:

| Concern | Tool |
|---|---|
| Build | `bun build --compile` |
| Test | `bun test` |
| Lint / Format | Biome |
| Package manager | `bun install` |

---

## SSL Cert Plugin — Technical Approach

- **Connection:** Use Bun's Node-compatible `node:tls` to open a TLS socket to the target host and extract the raw peer certificate chain (`getPeerCertificate({ detailed: true })`).
- **Parsing:** A TypeScript X.509 library parses each certificate in the chain to extract: Common Name (CN), Issuer, and expiry date for display in the TUI selectable list.
- **Serialization:** The selected certificate is serialized to PEM or DER depending on the `format` field declared in `scriptor.yaml`, and written to `download_path`.
- **Error handling:** Connection failures (unreachable host, invalid URL, TLS error) are caught and surfaced as a TUI error message; the user may re-enter the URL and retry (FR-3-014).

---

## Architecture Patterns

- **Plugin system:** Built-in, compile-time only. Input types are implemented as TypeScript discriminated union variants — no runtime plugin loading (FR-3-070/071).
- **Input collection phase:** New TUI phase inserted between script selection and the confirmation screen. Inputs are collected sequentially (one prompt at a time per FR-3-051).
- **Argument passing:** Collected input values are appended to the script's command-line invocation as positional arguments in declaration order (FR-3-030/031).

---

## APIs & External Services

| Service | Purpose |
|---|---|
| Remote HTTPS hosts (user-supplied) | TLS connection for ssl-cert input type — outbound from user's machine at input collection time |

---

## Testing

- **Unit tests only** (`bun test`) — inherited from Phase 1.
- SSL cert fetching logic should be abstracted behind an injectable interface to allow unit testing with mock certificate data (no live network calls in tests).

---

## Constraints & Non-Goals

- No runtime/externally-loadable plugin system — new input types require a code change and rebuild.
- Input types limited to `string`, `number`, and `ssl-cert` in Phase 3.
- No min/max constraints on `number` inputs.
- Input values passed as positional args only (no env vars or temp files).

---

## Open Questions

_(none)_
