export interface Script {
	/** Unique identifier derived from folder path: e.g., "linux/ubuntu-24.04-x64/install-docker" */
	id: string;
	/** Human-readable display name from frontmatter `title` field */
	title: string;
	/** One-line description from frontmatter `description` field */
	description: string;
	/** Combined target identifier, e.g. "ubuntu-24.04-x64", "macos-tahoe-arm64", "windows-11-x64" */
	platform: string;
	/** Full Markdown body of the spec file (rendered on detail page) */
	body: string;
	/** Raw source code of the script file */
	source: string;
	/** One-liner run command for the terminal */
	runCommand: string;
}
