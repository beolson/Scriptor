# Phase 3 — Delivery Tasks

_TDD methodology: write failing tests first (red), then implement to make them pass (green). Tests are part of each task, not separate._

---

## Task 1 — Input Type Definitions & Zod Schema

**Status:** not started

**Description:**
Install new dependencies and define all TypeScript types and Zod schemas for the `inputs` extension to `scriptor.yaml`. This is the foundational type layer that every other Phase 3 module imports. References FR-3-001, FR-3-070, FR-3-071.

- Run `bun add zod @peculiar/x509` in the TUI package directory.
- Define `InputDef` as a TypeScript discriminated union: `StringInputDef`, `NumberInputDef`, `SslCertInputDef` — each with `id`, `type`, `label`, and type-specific fields (`required`, `default`, `download_path`, `format`).
- Define Zod schemas matching each variant; export a `InputDefSchema` union schema and an `InputDefArraySchema`.
- Export a `CollectedInput` type representing a resolved input: `{ id: string; label: string; value: string }` (for `ssl-cert`, value is the download path).
- Export a `ScriptInputs` type: `Map<scriptId, CollectedInput[]>`.
- No runtime logic — this file is pure type definitions and schemas.

**TDD Approach:**
- **RED:** Write `src/inputs/inputSchema.test.ts` with failing tests using `bun test`: (1) valid string input def parses correctly; (2) valid number input def parses correctly; (3) valid ssl-cert input def parses with `download_path` and `format`; (4) input def with unknown `type` fails Zod parse; (5) ssl-cert missing `download_path` fails Zod parse; (6) `required` defaults to `false` when omitted.
- **GREEN:** Implement `src/inputs/inputSchema.ts` with all Zod schemas and exported types to make all 6 tests pass.
- Cover: all 6 scenarios above; `bun run lint` passes.

---

## Task 2 — scriptor.yaml Loader Extension

**Status:** not started

**Description:**
Extend the existing `scriptor.yaml` loader to parse and validate the new `inputs` list on each script entry using the Zod schema from Task 1. Detect and error on duplicate input `id` values within a script (FR-3-033). References FR-3-001, FR-3-033.

- Extend the YAML schema to include an optional `inputs` field on each script entry using `InputDefArraySchema`.
- After parsing, validate each script's `inputs` list for duplicate `id` values; if any duplicates are found, throw a descriptive load error and exit (FR-3-033).
- The loader must continue to load and validate all existing script fields without regression.
- Export a helper `getInputsForScript(scriptId: string): InputDef[]` from the loader module.

**TDD Approach:**
- **RED:** Write or extend `src/loadConfig.test.ts` with failing tests: (1) YAML with valid `inputs` on a script parses and returns `InputDef[]`; (2) script with no `inputs` field returns empty array; (3) YAML with duplicate input `id` within one script throws a load error; (4) YAML with an unknown input `type` throws a Zod validation error; (5) ssl-cert input missing `format` throws a Zod validation error.
- **GREEN:** Extend the loader to run Zod validation on `inputs` and add the duplicate-ID check.
- Cover: all 5 scenarios; existing loader tests continue to pass; `bun run lint` passes.

---

## Task 3 — SSL Cert Fetcher Service

**Status:** not started

**Description:**
Implement the SSL certificate fetching service as an injectable interface so unit tests can use a mock. The real implementation uses `node:tls` to open a TLS socket and `@peculiar/x509` to parse and serialize certificates. References FR-3-011, FR-3-013, FR-3-014, FR-3-015.

- Define `CertInfo` type: `{ subject: string; issuer: string; expiresAt: Date; rawDer: Uint8Array }`.
- Define `CertFetcher` interface: `fetchChain(host: string, port: number): Promise<CertInfo[]>`.
- Implement `TlsCertFetcher`: opens a TLS socket via `node:tls`, calls `getPeerCertificate({ detailed: true })`, walks the chain, and parses each cert with `@peculiar/x509` to extract subject CN, issuer, and expiry.
- Implement `downloadCert(cert: CertInfo, path: string, format: 'PEM' | 'DER'): Promise<void>`: serializes using `@peculiar/x509` and writes to disk with `Bun.write`.
- Implement `MockCertFetcher` for testing: accepts a preset array of `CertInfo` and returns them without any network call.
- Connection errors (unreachable host, invalid URL, TLS error) must be caught and rethrown as a typed `CertFetchError` with a human-readable message.

**TDD Approach:**
- **RED:** Write `src/inputs/sslCert/certFetcher.test.ts` with failing tests using `bun test`: (1) `MockCertFetcher.fetchChain` returns the preset cert array; (2) `downloadCert` writes a PEM file to a temp path and the file starts with `-----BEGIN CERTIFICATE-----`; (3) `downloadCert` writes a DER file to a temp path and the file is non-empty binary; (4) a `MockCertFetcher` configured to throw produces a `CertFetchError` when called.
- **GREEN:** Implement `TlsCertFetcher`, `MockCertFetcher`, and `downloadCert` to make all 4 tests pass. No live network calls in tests.
- Cover: all 4 scenarios; `bun run lint` passes.

---

## Task 4 — String & Number Input Prompt Components

**Status:** not started

**Description:**
Implement Ink.js components for collecting a single `string` or `number` input from the user. Includes required-field validation and default value pre-fill. References FR-3-020, FR-3-021, FR-3-022.

- `<StringInputPrompt>` — props: `inputDef: StringInputDef; scriptName: string; onSubmit: (value: string) => void`. Renders the script name as context label and the input `label` as the prompt. Pre-fills `default` if declared. If `required` and blank, shows an inline error and does not call `onSubmit`.
- `<NumberInputPrompt>` — same structure as `StringInputPrompt` but validates the entered value is a valid number (integer or decimal). Rejects non-numeric input with an inline error message (FR-3-022).
- Both components display the owning script's name above the prompt label (FR-3-003).
- Use `ink` primitives (`Text`, `Box`, `useInput`/`TextInput` from `ink-input` or equivalent) consistent with Phase 1 patterns.

**TDD Approach:**
- **RED:** Write `src/inputs/components/StringInputPrompt.test.tsx` and `NumberInputPrompt.test.tsx` using `ink-testing-library` and `bun test`: (1) renders script name and input label; (2) pre-fills default value when declared; (3) required string input left blank — `onSubmit` not called, error shown; (4) valid string submitted — `onSubmit` called with value; (5) number input with non-numeric value — error shown, `onSubmit` not called; (6) number input with valid decimal — `onSubmit` called.
- **GREEN:** Implement both components to make all 6 tests pass.
- Cover: all 6 scenarios; `bun run lint` passes.

---

## Task 5 — SSL Cert Input Flow Component

**Status:** not started

**Description:**
Implement the multi-step Ink.js component for the `ssl-cert` input type. Walks the user through: URL entry → TLS fetch → cert selection → certificate download. Handles errors and retry (FR-3-014). References FR-3-010 through FR-3-016.

- `<SslCertInputPrompt>` — props: `inputDef: SslCertInputDef; scriptName: string; fetcher: CertFetcher; onSubmit: (downloadPath: string) => void`.
- Step 1 (URL entry): prompts for a URL, parses host and port (default 443).
- Step 2 (fetching): shows a loading indicator while `fetcher.fetchChain` runs; on error, shows the `CertFetchError` message and returns to step 1 for retry (FR-3-014).
- Step 3 (cert selection): renders a selectable list (arrow keys + Enter). Each entry shows: `CN`, `Issuer`, `Expires: {date}` (FR-3-015). User selects exactly one (FR-3-016).
- Step 4 (download): calls `downloadCert(selected, inputDef.download_path, inputDef.format)`, then calls `onSubmit(inputDef.download_path)`.
- Displays the owning script name above the prompt (FR-3-003).

**TDD Approach:**
- **RED:** Write `src/inputs/components/SslCertInputPrompt.test.tsx` using `ink-testing-library` and `bun test` with `MockCertFetcher`: (1) step 1 renders URL prompt with script name; (2) after valid URL entry, cert list is rendered with CN/Issuer/Expiry for each cert; (3) selecting a cert and pressing Enter calls `onSubmit` with `download_path`; (4) `MockCertFetcher` configured to throw — error message shown, URL prompt re-appears for retry; (5) cert list shows exactly the certs returned by the fetcher.
- **GREEN:** Implement `SslCertInputPrompt` to make all 5 tests pass.
- Cover: all 5 scenarios; `bun run lint` passes.

---

## Task 6 — Input Collection Screen

**Status:** not started

**Description:**
Implement the Ink.js screen that orchestrates collection of all inputs across all selected scripts, one prompt at a time, before the confirmation screen. Handles the cancel/quit flow. References FR-3-002, FR-3-003, FR-3-050, FR-3-051, FR-3-052.

- `<InputCollectionScreen>` — props: `scripts: Array<{ id: string; name: string; inputs: InputDef[] }>; fetcher: CertFetcher; onComplete: (collected: ScriptInputs) => void; onCancel: () => void`.
- Sequences prompts across all scripts in order: for each script, for each input in declaration order, renders the matching prompt component (`StringInputPrompt`, `NumberInputPrompt`, or `SslCertInputPrompt`).
- Each prompt is labeled with the owning script's name (FR-3-003, FR-3-051).
- When Q or Ctrl+C is pressed during collection, shows a confirmation prompt: "Cancel input collection and exit? [y/N]". If confirmed, calls `onCancel`; otherwise resumes collection (FR-3-052).
- When all prompts are answered, calls `onComplete` with the collected `ScriptInputs` map.
- Scripts with no `inputs` are skipped silently (no prompts shown).

**TDD Approach:**
- **RED:** Write `src/inputs/components/InputCollectionScreen.test.tsx` using `ink-testing-library` and `bun test`: (1) single string input for one script — renders prompt, submitting value calls `onComplete` with correct `ScriptInputs`; (2) two scripts with one input each — prompts are shown in order, both collected before `onComplete`; (3) pressing Q mid-collection shows cancel confirmation; (4) confirming cancel calls `onCancel`; (5) declining cancel resumes from the current prompt; (6) scripts with no inputs are skipped, `onComplete` called immediately if no scripts have inputs.
- **GREEN:** Implement `InputCollectionScreen` to make all 6 tests pass.
- Cover: all 6 scenarios; `bun run lint` passes.

---

## Task 7 — Confirmation Screen Extension

**Status:** not started

**Description:**
Extend the existing confirmation screen to display each selected script's collected input values alongside the script name, so the user can review everything before confirming execution. References FR-3-040, FR-3-041.

- In the existing confirmation screen component, add a section below each script name listing its collected inputs: `{label}: {value}`.
- For `ssl-cert` inputs, display the download path and the selected certificate's common name (FR-3-041). The `CollectedInput.value` holds the download path; CN is stored alongside it — extend `CollectedInput` if needed to carry the cert CN for display.
- If a script has no inputs, the existing confirmation display is unchanged.
- The confirmation screen receives the `ScriptInputs` map as an additional prop.

**TDD Approach:**
- **RED:** Write or extend `src/components/ConfirmationScreen.test.tsx` using `ink-testing-library` and `bun test`: (1) script with a string input shows `label: value` in the confirmation list; (2) script with an ssl-cert input shows download path and cert CN; (3) script with no inputs renders unchanged; (4) multiple scripts each show their own inputs under their respective names.
- **GREEN:** Extend the confirmation screen component to accept and render `ScriptInputs`.
- Cover: all 4 scenarios; existing confirmation screen tests continue to pass; `bun run lint` passes.

---

## Task 8 — Script Invocation & Logging Update

**Status:** not started

**Description:**
Update the script execution engine to append collected input values as positional command-line arguments, and update the run logger to record input values alongside each script's output section. References FR-3-030, FR-3-031, FR-3-032, FR-3-060.

- In the script runner/executor module, accept the `ScriptInputs` map. Before invoking each script, look up its collected inputs and append their values to the command-line args in declaration order (FR-3-030, FR-3-031).
- For `ssl-cert` inputs, the arg value is the download path stored in `CollectedInput.value` (FR-3-032).
- In the run logger, before writing a script's output section, write a block for collected inputs: for each input, write `  [input] label={label} id={id} value={value}` (FR-3-060).
- Scripts with no inputs are invoked and logged as before (no regression).

**TDD Approach:**
- **RED:** Write or extend `src/runner/scriptRunner.test.ts` and `src/logger/runLogger.test.ts` using `bun test`: (1) script with two string inputs — command invoked with both values appended as positional args in declaration order; (2) script with ssl-cert input — arg value is the download path; (3) script with no inputs — invoked with no extra args; (4) run log for a script with inputs includes `[input]` lines before the output section; (5) run log for a script with no inputs has no `[input]` lines.
- **GREEN:** Update the runner and logger modules to make all 5 tests pass.
- Cover: all 5 scenarios; existing runner/logger tests continue to pass; `bun run lint` passes.

---

## Task 9 — TUI App Flow Integration

**Status:** not started

**Description:**
Wire the input collection phase into the main TUI application flow, inserting it between script selection and the confirmation screen. Connect the updated confirmation screen, execution engine, and logger so the end-to-end flow works. References FR-3-002, FR-3-004, FR-3-050.

- In the main TUI app component, add an `inputCollection` state between `selectionConfirmed` and `confirmation` states.
- After the user confirms the script selection, transition to `InputCollectionScreen`. Pass the selected scripts (with their `inputs` from the loader) and a `TlsCertFetcher` instance.
- On `onComplete`, store the returned `ScriptInputs` in app state and transition to the confirmation screen.
- On `onCancel`, return to the script selection screen (or exit — match FR-3-052 "exits cleanly with no scripts run"; use exit).
- Pass `ScriptInputs` through to the confirmation screen, the script runner, and the logger.
- If none of the selected scripts have any inputs, skip the input collection screen entirely and proceed directly to confirmation (FR-3-050 — collection only occurs when there are inputs to collect).

**TDD Approach:**
- **RED:** Write or extend `src/App.test.tsx` using `ink-testing-library` and `bun test` with a mock config (scripts with and without inputs) and `MockCertFetcher`: (1) selecting a script with inputs transitions to the input collection screen; (2) completing input collection transitions to the confirmation screen showing input values; (3) cancelling input collection exits the app; (4) selecting a script with no inputs skips input collection and goes straight to confirmation; (5) confirming execution calls the runner with correct positional args appended.
- **GREEN:** Update the main app component state machine to make all 5 tests pass.
- Cover: all 5 scenarios; all prior app flow tests continue to pass; `bun run lint` passes.
