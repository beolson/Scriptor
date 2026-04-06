# Verification

## Acceptance Criteria

| AC | Description | Status |
|----|-------------|--------|
| AC-001 | Spec file co-located with script source is the sole source of truth — no central manifest required | Verified |
| AC-002 | The spec frontmatter supports `platform`, `os`, and `arch` fields | Verified |
| AC-003 | The site displays a browseable list of scripts filterable by platform, OS, and arch | Verified |
| AC-004 | Each entry in the script list shows the script title | Verified |
| AC-005 | Selecting a script navigates to a detail page showing the full spec body, script source, and the run command | Verified |
| AC-006 | The detail page includes a copy button that copies the one-liner to the clipboard | Verified |
| AC-007 | When no scripts match the active filters, the site displays an appropriate empty-state message | Verified |
| AC-008 | Filter options that would produce zero results given the current selection are displayed as greyed-out and unselectable | Verified |

## Issues
