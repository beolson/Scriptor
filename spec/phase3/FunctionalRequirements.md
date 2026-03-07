# Phase 3 Functional Requirements

## Summary

Add a user input system to the Scriptor TUI. Scripts can declare zero or more typed inputs in `scriptor.yaml`; the TUI collects those inputs from the user before executing any scripts. Basic input types include strings and numbers. A plugin system supports custom input types, with the first plugin being "SSL Cert": it prompts the user for a web URL, fetches the certificate chain from that URL, lets the user select a certificate from the chain, and downloads it to a path declared in the yaml. This feature requires schema extensions to `scriptor.yaml`.

## Functional Requirements

- FR-3-001: Each script in `scriptor.yaml` may declare zero or more typed inputs.
- FR-3-002: When the user confirms a multi-script run, the TUI collects all inputs for all selected scripts upfront in a single session before any script executes.
- FR-3-003: During input collection, each input prompt is clearly labeled with the name of the script it belongs to, so the user knows which script each input feeds.
- FR-3-004: After all inputs are collected, execution proceeds as defined in Phase 1 (sequential, confirmation screen, progress list).

## SSL Cert Plugin

- FR-3-010: The `ssl-cert` input type prompts the user for a web URL.
- FR-3-011: The TUI connects to the URL and retrieves the TLS certificate chain.
- FR-3-012: The TUI presents the certificates in the chain as a selectable list, allowing the user to choose one.
- FR-3-013: The selected certificate is downloaded to a path declared in the `scriptor.yaml` input definition for that field, in the format also declared in that definition (e.g. `PEM`, `DER`).
- FR-3-014: If the connection to the URL fails (unreachable host, invalid URL, TLS error, etc.), the TUI displays a clear error message and allows the user to re-enter the URL and retry. Execution does not proceed until all inputs are successfully resolved.
- FR-3-015: The certificate chain is presented as a selectable list. Each entry shows: Common Name (CN), Issuer, and expiry date.
- FR-3-016: The user selects exactly one certificate from the chain.

## Input Metadata (string & number types)

Each `string` or `number` input declaration in `scriptor.yaml` supports:

| Field | Description |
|---|---|
| `label` | Human-readable name shown in the TUI prompt |
| `required` | Boolean; if `true`, the user must provide a value before proceeding |
| `default` | Pre-filled value the user can accept or override |

- FR-3-020: If a required input is left blank, the TUI displays a validation error and does not advance until a value is provided.
- FR-3-021: If a default value is declared, it is pre-populated in the input field; the user may accept or change it.
- FR-3-022: `number` inputs accept integers and decimals. The TUI validates that the entered value is a valid number and rejects non-numeric input, but imposes no min/max constraints.

## Script Invocation with Inputs

- FR-3-030: Input values are passed to the script as command-line arguments when it is invoked.
- FR-3-031: The order of arguments follows the order inputs are declared in `scriptor.yaml` for that script.
- FR-3-033: Input `id` values must be unique within a script's `inputs` list. If duplicate input ids are detected for any script when loading `scriptor.yaml`, the TUI displays a load error and exits.
- FR-3-032: For the `ssl-cert` plugin type, the argument value passed to the script is the local filesystem path where the certificate was downloaded.

## Logging (updated)

- FR-3-060: Input values collected for each script are written to the run log file, alongside that script's output section. This includes the input label, id, and value (for `ssl-cert` inputs, the download path is logged).

## Input Collection UX

- FR-3-050: Input collection occurs after the user selects scripts and before the confirmation screen.
- FR-3-051: The TUI presents inputs one at a time (or grouped per script), clearly labeled with the owning script's name.
- FR-3-052: If the user presses Q or Ctrl+C during input collection, the TUI shows a confirmation prompt ("Cancel input collection and exit?"). If confirmed, the TUI exits cleanly with no scripts run.

## Confirmation Screen (updated)

- FR-3-040: The confirmation screen (from Phase 1) is extended to display each script's collected input values alongside the script name, so the user can review everything before confirming execution.
- FR-3-041: For `ssl-cert` inputs, the confirmation screen shows the download path and the selected certificate's common name (or subject).

## scriptor.yaml Schema Extension

Each script entry gains an optional `inputs` list. Each input entry includes:

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string (slug) | yes | Identifier for the input; used for ordering args |
| `type` | enum | yes | `string`, `number`, or a plugin type (e.g. `ssl-cert`) |
| `label` | string | yes | Human-readable prompt label shown in TUI |
| `required` | boolean | no | Whether a value must be provided (default: `false`) |
| `default` | string \| number | no | Pre-filled default value (not applicable to plugin types) |

Additional fields for the `ssl-cert` plugin type:

| Field | Type | Required | Description |
|---|---|---|---|
| `download_path` | string | yes | Filesystem path where the selected certificate will be saved |
| `format` | enum | yes | Certificate format: `PEM` or `DER` |

## Plugin System

- FR-3-070: Custom input types ("plugins") are built into the TUI binary and shipped as part of a TUI release. There is no runtime plugin loading mechanism.
- FR-3-071: Phase 3 ships with one custom input type: `ssl-cert`. Additional custom types will be added in future phases by extending the TUI codebase.

## Out of Scope

- Runtime/externally-loadable plugin system (future phases will add new types via code changes).
- Input types beyond `string`, `number`, and `ssl-cert`.
- Min/max constraints on `number` inputs.
- Sharing input values across scripts in a multi-script run (duplicate input ids within a script are a validation error).
- Script parameter passing via environment variables or temp files (args only).

## Open Questions

_(none — requirements sufficiently defined)_
