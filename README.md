# Scriptor

Platform for browsing and running host-specific setup scripts.

## Releasing

Releases are fully automated via [Changesets](https://github.com/changesets/changesets)
and GitHub Actions.

### 1. Add a changeset

After making your changes, run from the repo root:

```sh
bun run changeset
```

Select the packages to include, choose a bump type (patch / minor / major),
and write a one-line summary. This creates a markdown file in `.changeset/`.
Commit it with your code.

### 2. Open a PR and merge

Include the changeset file in your pull request. After CI passes and review
is approved, merge into `main`.

### 3. Merge the version PR

When changesets are merged to `main`, GitHub Actions automatically opens a
**"chore: version packages"** PR that bumps `package.json` versions and
updates `CHANGELOG.md` files. Review and merge this PR when you're ready
to release.

### 4. Release happens automatically

Merging the version PR triggers the release workflow, which:

1. Tags the commit as `v{version}`
2. Builds the web site, runs E2E tests, and deploys to GitHub Pages

Monitor progress at: `github.com/beolson/Scriptor/actions`
