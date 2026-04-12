---
status: Ready
created: 2026-04-12
---

# Verification

## Acceptance Criteria

| AC | Description | Status |
|----|-------------|--------|
| AC-001 | Browse page shows groups first, then ungrouped scripts in a visually distinct block | Verified |
| AC-002 | Ungrouped scripts are visually separated from group entries | Verified |
| AC-003 | Each group entry has a visual badge/tag distinguishing it from script entries | Verified |
| AC-004 | Group entries have an inline expand control revealing nested member script links | Verified |
| AC-005 | Clicking a group entry (not the expand control) navigates to the group detail page | Verified |
| AC-006 | Group detail page shows title, description, platform info, and copyable one-liner | Verified |
| AC-007 | Group detail page lists member scripts in declared order as links to detail pages | Verified |
| AC-008 | Group detail page layout is visually consistent with individual script detail pages | Verified |
| AC-009 | Group one-liner is copyable from the group detail page | Verified |
| AC-010 | Running the group one-liner executes all member scripts in order | Verified |
| AC-011 | Runner prints a per-script progress indicator before each script runs | Verified |
| AC-012 | Runner halts and reports failure if a member script fails | Verified |
| AC-013 | Individual member scripts remain independently runnable | Verified |
| AC-014 | Build generates run-all.sh/ps1 runner at scripts/<platform>/<group-name>/ | Verified |
| AC-015 | Generated runner hard-codes ordered member script raw GitHub URLs | Verified |
| AC-016 | Site footer displays package version on every page | Verified |
| AC-017 | Missing/unresolvable version omits footer version field gracefully — no build failure | Verified |

## Issues
