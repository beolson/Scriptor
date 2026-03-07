#!/usr/bin/env bash
# Usage: ./release.sh
#
# Applies pending changesets, commits the version bump, tags, and pushes.
# Run `bun run changeset` from the repo root first to describe your changes.
set -euo pipefail

# Fail fast if there are no pending changesets
if ! ls .changeset/*.md 2>/dev/null | grep -qv README; then
  echo "No changesets found. Run 'bun run changeset' first to describe your changes."
  exit 1
fi

# Apply version bumps and update CHANGELOGs
bun run version

# Read the new TUI version (canonical release version)
VERSION=$(node -p "require('./tui/package.json').version")

# Commit, tag, and push
git add .changeset/ tui/package.json tui/CHANGELOG.md web/package.json web/CHANGELOG.md
git commit -m "chore: release v$VERSION"
git tag "v$VERSION"
git push
git push origin "v$VERSION"

echo "Released v$VERSION — release.yml is now building the binaries."
