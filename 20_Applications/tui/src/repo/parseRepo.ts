import { InvalidArgumentError } from "commander";
import type { Repo } from "./types.js";

/**
 * Parses a string in "owner/repo" format into a Repo object.
 * Throws `InvalidArgumentError` (from Commander) if the format is invalid.
 */
export function parseRepo(input: string): Repo {
	const trimmed = input.trim();

	const slashIndex = trimmed.indexOf("/");
	if (slashIndex === -1) {
		throw new InvalidArgumentError(
			"Repository must be in owner/repo format (e.g. owner/repo)",
		);
	}

	const owner = trimmed.slice(0, slashIndex).trim();
	const name = trimmed.slice(slashIndex + 1).trim();

	if (owner.length === 0) {
		throw new InvalidArgumentError("Repository owner must not be empty");
	}

	if (name.length === 0) {
		throw new InvalidArgumentError("Repository name must not be empty");
	}

	if (name.includes("/")) {
		throw new InvalidArgumentError(
			"Repository must be in owner/repo format — too many slashes",
		);
	}

	return { owner, name };
}

/**
 * Converts a Repo back to the "owner/repo" string format used for storage and display.
 */
export function repoToString(repo: Repo): string {
	return `${repo.owner}/${repo.name}`;
}
