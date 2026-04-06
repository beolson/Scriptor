---
name: h4h:manage
description: Project lifecycle management orchestrator. Use when the user invokes "/h4h-manage" or says "manage project", "what's next", "project status", or "what can I work on". Do NOT invoke automatically.
disable-model-invocation: true
---

# Project Lifecycle Manager

## Overview

Evaluates the current project state by scanning `10_Specs/` and presents available actions to the user. Delegates execution of the chosen action to a subagent loaded with step-specific instructions. One action per invocation.

## Document Structure

```
10_Specs/
  Prd/                          # Product Requirements Documents
    {NNN}-{name}.md
  ADR/                          # Architecture Decision Records
    {NNN}-{name}.md
  Research/                     # Standalone research & demos
    {NNN}-{name}/
      Outcome.md
  Epics/                        # Epic directories
    {NNN}-{name}/
      status.yaml               # Epic-level status tracking
      Functional.md             # Use cases, acceptance criteria, workflows
      Research.md               # Codebase research findings
      TechRequirements.md       # Technical specification
      Plan.md                   # Delivery tasks (TDD)
```

## Frontmatter Convention

All spec documents use YAML frontmatter:

```yaml
---
status: Draft | Ready
created: YYYY-MM-DD
---
```

Epic directories use a separate `status.yaml`:

```yaml
status: Draft | Ready | Complete
prd: NNN-name
completed_steps: []
```

`completed_steps` values: `functional`, `research`, `tech`, `delivery`, `verify`, `complete`

## Workflow

### Step 1 — Ensure Directories

Create these directories if they do not exist:
- `10_Specs/Prd/`
- `10_Specs/ADR/`
- `10_Specs/Research/`
- `10_Specs/Epics/`

### Step 2 — Evaluate Project State

Scan `10_Specs/` to build a state summary:

1. **PRDs**: List all `.md` files in `10_Specs/Prd/`. Read YAML frontmatter from each to get `status`.
2. **ADRs**: List all `.md` files in `10_Specs/ADR/`. Read YAML frontmatter from each to get `status`.
3. **Research**: List all subdirectories in `10_Specs/Research/`. Read `Outcome.md` frontmatter from each to get `status`.
4. **Epics**: List all subdirectories in `10_Specs/Epics/`. Read `status.yaml` from each to get `status` and `completed_steps`. Check which document files exist.

Record for each item: name, status, and (for epics) completed_steps.

### Step 3 — Determine Available Actions

Use this decision tree:

```
HAS_READY_PRD = any PRD with status: Ready

ACTIONS = []

# Always available
if any PRD has status: Draft → add "Resume PRD: {name}"
add "Create New PRD"

# Require at least one Ready PRD
if HAS_READY_PRD:
  if any ADR has status: Draft → add "Resume ADR: {name}"
  add "Create New ADR"

  if any Research has status: Draft → add "Resume Research: {name}"
  add "Conduct Research"

  add "Create New Epic"

  for each epic where status != Complete:
    next = determine_next_epic_step(epic)
    add "{next} — Epic: {name}"
    if next starts with "Build":
      add "Build All — Epic: {name}"
```

**determine_next_epic_step(epic):**

Each line is a guard clause — return the action immediately when the condition is true; only reach the next line if it isn't.

```
if "functional" not in completed_steps:
  → return "Resume Functional" (if Functional.md exists with status: Draft)
  → return "Define Functional" (otherwise)

if "research" not in completed_steps:
  → return "Resume Codebase Research" (if Research.md exists with status: Draft)
  → return "Research Codebase" (otherwise)

if "tech" not in completed_steps:
  → return "Resume Tech Requirements" (if TechRequirements.md exists with status: Draft)
  → return "Define Tech Requirements" (otherwise)

if "delivery" not in completed_steps:
  → return "Define Delivery Plan"

if Plan.md has tasks with status "not started" or "in progress":
  → return "Build (next task: {task title})"

if "verify" not in completed_steps:
  → return "Verify"

if "complete" not in completed_steps:
  → return "Complete Epic"
```

### Step 4 — User Chooses Action

- If exactly one action is available, confirm it with the user.
- If multiple actions are available, present them grouped by category (PRD, ADR, Research, Epics) and use `AskUserQuestion` to let the user choose.

### Step 5 — Delegate to Subagent

Based on the chosen action, determine the step file to load:

| Action | Step File | Also Load |
|---|---|---|
| Create/Resume PRD | `steps/01_define_prd.md` | `steps/_elicitation.md` |
| Create/Resume ADR | `steps/02_define_adr.md` | `steps/_elicitation.md` |
| Conduct/Resume Research | `steps/03_conduct_research.md` | `steps/_elicitation.md` |
| Define/Resume Functional | `steps/04_epic_define_functional.md` | `steps/_elicitation.md` |
| Research Codebase | `steps/05_epic_research_codebase.md` | — |
| Define/Resume Tech | `steps/06_epic_define_tech.md` | `steps/_elicitation.md` |
| Define Delivery Plan | `steps/07_epic_define_delivery.md` | — |
| Build (next task) | `steps/08_epic_build.md` | — |
| Build All | `steps/08_epic_build_all.md` | — |
| Verify | `steps/09_epic_verify.md` | — |
| Complete Epic | `steps/10_epic_complete.md` | — |

1. Read the step file from `.claude/skills/manage/steps/`.
2. If the step uses elicitation, also read `steps/_elicitation.md`.
3. Compose a subagent prompt that includes:
   - The full content of the step file
   - The elicitation instructions (if applicable)
   - The specific target (e.g., which epic directory, which PRD to resume)
   - Relevant state context (e.g., list of Ready PRDs for the epic to reference)
4. Dispatch using the `Agent` tool — **always use a subagent, never execute the step inline** — and wait for completion.

### Step 6 — Report Outcome and Offer to Continue

After the subagent completes:

1. Summarize what was accomplished.
2. Re-evaluate the project state (Steps 2–3) to determine the recommended next action.
3. If a recommended next action exists, use `AskUserQuestion` to ask the user:
   > "The recommended next step is **[action]**. Would you like to continue with that, see all available actions, or stop here?"
   - If the user confirms the recommended action → go to Step 5 with that action.
   - If the user wants to see all options → present them grouped as in Step 4, then go to Step 5 with their choice.
   - If the user wants to stop → end the session.
4. If no further actions are available, inform the user the project is fully up to date.

## Key Rules

- One action per invocation — do not chain multiple actions.
- Always evaluate state fresh — never assume state from a prior invocation.
- Step files contain the detailed instructions — this orchestrator should not duplicate them.
- The orchestrator reads step files but does not modify them.
- All step files are located relative to this skill: `.claude/skills/manage/steps/`.