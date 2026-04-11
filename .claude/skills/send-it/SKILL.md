---
name: send-it
description: >
  Ships code end-to-end: stage, commit, push, open a PR, watch CI, and fix
  failures in a loop until all checks pass — then stops. With "all the way",
  "to production", "and deploy", or "and release" also merges the PR, handles
  the Changesets version PR, and watches the GitHub Pages deployment through to
  completion.

  Use this skill whenever the user has code ready to ship and says things like
  "send it", "ship this", "push and PR", "check this in", "commit and create a
  PR", "get this merged", or any phrase meaning "drive this code to a green PR".
  Also use it when they say "send it all the way", "ship to production", or
  "deploy this" to go the full distance to a live site.
---

# Send It

Drives code from "working on my machine" to a green PR — or all the way to a
live deployment.

---

## First: assess the current state

Before doing anything, quickly orient:

- What files have changed? (`git status`, `git diff --stat`)
- What branch are we on? Are we already on a feature branch, or on `main`?
- Is there already an open PR for this branch?
- Is CI already running, or have checks already passed?

Jump to the right step. Don't re-do work that's already done.

---

## Mode: "Send it" (default)

Stop after CI goes green. Do **not** merge or deploy unless explicitly asked.

### Step 1 — Pre-flight checks

Run the full pre-commit suite and fix any issues before touching git:

```bash
bun run lint
bun run format
bun run typecheck
bun run test:unit
```

Fix failures as you find them. After `bun run format` rewrites files, re-stage
those files. Do not commit if any of these still fail.

### Step 2 — Branch

If already on a descriptive feature branch, stay. If on `main`, create one:

```bash
git checkout -b <verb>/<short-description>   # e.g. feat/add-curl-script
```

Derive the name from what the code actually does, not from the conversation.

### Step 3 — Commit

Stage changed files by name — not `git add .`. Avoid accidentally including
`.env`, lock-file noise, or unrelated files.

Write a commit message that explains **why** the change was made, not just what
changed. Check `git log --oneline` to match the repo's conventions. Follow the
project's co-author footer:

```
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

### Step 4 — Push and open a PR

```bash
git push -u origin <branch>
gh pr create --title "..." --body "..."
```

PR body should include:
- A short summary of what changed and why
- A test plan checklist if there are meaningful things to verify
- The Claude Code footer: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`

Record the PR number.

### Step 5 — CI watch-and-fix loop

```bash
gh pr checks <number> --watch
```

**All checks pass** → done. Report the PR URL and stop.

**Any check fails** → diagnose, fix, re-push, and watch again:

```bash
gh run view <run-id> --log-failed 2>&1 | tail -80
```

Common failure patterns in this repo:

| Failure | Fix |
|---|---|
| Biome lint error | `bun run lint`, fix the flagged lines |
| Biome format | `bun run format`, re-stage the reformatted files |
| TypeScript error | fix the type error, re-run `bun run typecheck` |
| Unit test failure | fix the test or the code, re-run `bun run test:unit` |
| E2E test failure | tests run against `scripts-fixture/`, not `scripts/`; check that `SCRIPTS_DIR=scripts-fixture` is set in the failing step and that the fixture scripts still match what the tests expect |
| Build failure | fix the error, run `bun run build` locally to confirm |

After fixing:

```bash
git add <changed files>
git commit -m "fix: <what was broken and why>"
git push
gh pr checks <number> --watch
```

Repeat until green. If the same failure appears after two fix attempts, stop
and explain what you tried and what's still broken — don't keep guessing.

---

## Mode: "All the way"

Triggered by: "all the way", "to production", "and deploy", "and release",
"and merge it". Complete all steps above first, then continue below.

### Step 6 — Ensure a changeset exists

Before merging, confirm `.changeset/` has an unconsumed changeset for
`@scriptor/scriptor-web`. If not, create one:

```markdown
# .changeset/<short-name>.md
---
"@scriptor/scriptor-web": patch   # patch for fixes/scripts; minor for features
---

One-line description of what changed
```

Commit and push it, wait for CI to re-pass, then merge:

```bash
gh pr merge <number> --squash --delete-branch
```

### Step 7 — Handle the Changesets version PR

The merge to `main` triggers the Release workflow. Watch it, then find and
merge the auto-created version PR:

```bash
gh run list --branch main --limit 3 --json status,name,databaseId
gh run watch <release-run-id>
# once Changesets job completes:
gh pr list --search "chore: version packages" --json number,url
gh pr merge <version-pr-number> --squash --delete-branch
```

### Step 8 — Watch the deployment

Merging the version PR triggers the final Release run (Changesets + Deploy):

```bash
gh run list --branch main --limit 3 --json status,name,databaseId
gh run watch <deploy-run-id>
gh run view <deploy-run-id> --json status,conclusion,jobs \
  --jq '{status,conclusion,jobs:[.jobs[]|{name,conclusion,status}]}'
```

If the deployment fails, read `gh run view <id> --log-failed`, fix the issue,
and run a new PR → merge → version PR → deploy cycle.

Report the final deployment URL when done.

---

## Things to avoid

- Never `git add .` — always stage files by name
- Never force-push to `main`
- Never skip CI or use `--no-verify`
- Never merge a PR without confirming CI is green first
- Never proceed to "all the way" steps if the user only said "send it"
- Don't self-approve PRs (GitHub will reject it); just merge directly when CI is green
