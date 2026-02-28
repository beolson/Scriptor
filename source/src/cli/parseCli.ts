export interface CliArgs {
	repo: string | null;
}

/**
 * Parses process.argv-style argument list.
 * Supported flags:
 *   --repo <owner/repo>  Override the default script repository.
 *
 * Throws a descriptive Error for invalid flag usage.
 * Returns { repo: null } when --repo is not provided.
 */
export function parseCli(argv: string[]): CliArgs {
	let repo: string | null = null;

	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === "--repo") {
			const value = argv[i + 1];
			if (value === undefined || value.startsWith("--")) {
				throw new Error("--repo requires a value in the format owner/repo");
			}
			if (!isValidRepo(value)) {
				throw new Error(
					`Invalid --repo value "${value}": expected format owner/repo`,
				);
			}
			repo = value;
			i++; // consume the value token
		}
	}

	return { repo };
}

/** owner/repo: both owner and repo must be non-empty, exactly one slash */
function isValidRepo(value: string): boolean {
	const slashIndex = value.indexOf("/");
	if (slashIndex <= 0) return false; // no slash, or slash is the first char
	if (slashIndex === value.length - 1) return false; // slash is the last char
	return true;
}
