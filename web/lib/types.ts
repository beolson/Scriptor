export interface Script {
	id: string;
	name: string;
	description: string;
	spec?: string;
	platform: "windows" | "linux" | "mac";
	arch: "x86" | "arm";
	distro?: string;
	version?: string;
	dependencies?: string[];
	script: string;
}
