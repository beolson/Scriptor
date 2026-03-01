import { Command, InvalidArgumentError } from "commander";

export interface CliArgs {
	repo: string | null;
}

/** owner/repo: both owner and repo must be non-empty, exactly one slash */
function parseRepo(value: string): string {
	const slashIndex = value.indexOf("/");
	if (slashIndex <= 0 || slashIndex === value.length - 1) {
		throw new InvalidArgumentError(
			`Expected format owner/repo, got "${value}"`,
		);
	}
	return value;
}

/**
 * Parses process.argv-style argument list via commander.
 * Supported flags:
 *   --repo <owner/repo>  Override the default script repository.
 *
 * Returns { repo: null } when --repo is not provided.
 */
export function parseCli(argv: string[]): CliArgs {
	const program = new Command()
		.name("scriptor")
		.description("Run host-specific setup scripts from a GitHub repository")
		.option("--repo <owner/repo>", "override the script repository", parseRepo)
		.allowExcessArguments(false)
		.exitOverride(); // throw instead of calling process.exit

	program.parse(argv, { from: "user" });

	const opts = program.opts<{ repo?: string }>();
	return { repo: opts.repo ?? null };
}
