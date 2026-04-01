export interface Input {
	id: string;
	type: string;
	label: string;
	required?: boolean;
	default?: string;
}

export interface Script {
	id: string;
	name: string;
	description: string;
	platform: string;
	arch: string;
	distro?: string;
	version?: string;
	script: string;
	requires_elevation?: boolean;
	dependencies?: string[];
	inputs: Input[];
	spec: string | undefined;
	scriptSource: string | undefined;
}
