export interface ScriptEntry {
	id: string;
	name: string;
	description: string;
	spec?: string;
	platform: "windows" | "linux" | "mac";
	arch: "x86" | "arm";
	distro?: string;
	version?: string;
	script: string;
	dependencies?: string[];
}
