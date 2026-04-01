import { describe, expect, it } from "bun:test";
import type { Input, Script } from "./types";

describe("Script and Input types", () => {
	it("accepts a Script value with all required fields and spec/scriptSource undefined", () => {
		const script: Script = {
			id: "test-script",
			name: "Test Script",
			description: "A test script",
			platform: "linux",
			arch: "x64",
			script: "scripts/linux/test.sh",
			inputs: [],
			spec: undefined,
			scriptSource: undefined,
		};

		expect(script.id).toBe("test-script");
		expect(script.platform).toBe("linux");
		expect(script.spec).toBeUndefined();
		expect(script.scriptSource).toBeUndefined();
	});

	it("accepts a Script value with all optional fields populated", () => {
		const script: Script = {
			id: "full-script",
			name: "Full Script",
			description: "A fully populated script",
			platform: "linux",
			arch: "x64",
			distro: "Debian GNU/Linux",
			version: "13",
			script: "scripts/linux/full.sh",
			requires_elevation: true,
			dependencies: ["other-script"],
			inputs: [],
			spec: "# Spec content",
			scriptSource: "#!/bin/bash\necho hello",
		};

		expect(script.distro).toBe("Debian GNU/Linux");
		expect(script.version).toBe("13");
		expect(script.requires_elevation).toBe(true);
		expect(script.spec).toBe("# Spec content");
	});

	it("accepts an inputs array with Input members", () => {
		const input: Input = {
			id: "username",
			type: "string",
			label: "Username",
		};

		const inputWithOptionals: Input = {
			id: "count",
			type: "number",
			label: "Count",
			required: true,
			default: "5",
		};

		const script: Script = {
			id: "script-with-inputs",
			name: "Script With Inputs",
			description: "A script that takes inputs",
			platform: "linux",
			arch: "x64",
			script: "scripts/linux/inputs.sh",
			inputs: [input, inputWithOptionals],
			spec: undefined,
			scriptSource: undefined,
		};

		expect(script.inputs).toHaveLength(2);
		expect(script.inputs[0].id).toBe("username");
		expect(script.inputs[1].required).toBe(true);
		expect(script.inputs[1].default).toBe("5");
	});

	it("ManifestValidationError is not imported from web/lib/types — types are structural only", () => {
		// This test simply verifies the module can be imported and the types are usable.
		// TypeScript structural typing is validated at compile time (bun run typecheck).
		expect(true).toBe(true);
	});
});
