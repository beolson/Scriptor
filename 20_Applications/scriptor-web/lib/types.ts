export type Platform = "linux" | "windows" | "mac";
export type Arch = "x64" | "arm64";

export interface Script {
	/** Unique identifier derived from folder path: e.g., "linux/ubuntu-24.04/install-docker" */
	id: string;
	/** Human-readable display name from frontmatter `title` field */
	title: string;
	platform: Platform;
	/** OS/distro value from controlled vocabulary, e.g. "ubuntu-24.04" */
	os: string;
	/** Target architecture; undefined means arch-agnostic */
	arch?: Arch;
	/** Full Markdown body of the spec file (rendered on detail page) */
	body: string;
	/** Raw source code of the script file */
	source: string;
	/** One-liner run command for the terminal */
	runCommand: string;
}
