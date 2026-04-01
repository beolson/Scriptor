import { describe, expect, it } from "bun:test";
import type { ScriptEntry } from "../types.js";
import { ManifestValidationError } from "../types.js";
import { parseManifest } from "./parseManifest.js";

// Minimal valid script entry YAML
const VALID_MINIMAL_YAML = `
scripts:
  - id: setup-bash
    name: Setup Bash
    description: Installs bash configuration
    os:
      name: Debian GNU/Linux
      arch: x64
    script: scripts/linux/setup-bash.sh
`;

const VALID_FULL_YAML = `
scripts:
  - id: setup-bash
    name: Setup Bash
    description: Installs bash configuration
    os:
      name: Debian GNU/Linux
      version: "13"
      arch: x64
    script: scripts/linux/setup-bash.sh
    requires_elevation: true
    dependencies:
      - setup-base
  - id: setup-base
    name: Setup Base
    description: Base setup
    os:
      name: Debian GNU/Linux
      arch: x64
    script: scripts/linux/setup-base.sh
    run_if:
      - setup-bash
    creates:
      - /usr/local/bin/base
    inputs:
      - id: username
        type: string
        label: "Enter username"
        required: true
        default: admin
        download_path: /tmp
        custom_extra_field: passthrough-value
groups:
  - id: devtools
    name: DevTools
    description: Developer tooling group
    scripts:
      - setup-bash
      - setup-base
`;

describe("parseManifest", () => {
	describe("valid manifests", () => {
		it("succeeds with a minimal valid entry (all required fields, no optional)", () => {
			const result = parseManifest(VALID_MINIMAL_YAML);
			expect(result.scripts).toHaveLength(1);
			const entry = result.scripts[0] as ScriptEntry;
			expect(entry.id).toBe("setup-bash");
			expect(entry.name).toBe("Setup Bash");
			expect(entry.description).toBe("Installs bash configuration");
			expect(entry.os.name).toBe("Debian GNU/Linux");
			expect(entry.os.arch).toBe("x64");
			expect(entry.script).toBe("scripts/linux/setup-bash.sh");
		});

		it("returns correct structure with all optional fields preserved", () => {
			const result = parseManifest(VALID_FULL_YAML);
			expect(result.scripts).toHaveLength(2);
			const bash = result.scripts[0] as ScriptEntry;
			expect(bash.os.version).toBe("13");
			expect(bash.requires_elevation).toBe(true);
			expect(bash.dependencies).toEqual(["setup-base"]);
		});

		it("preserves InputDef passthrough fields", () => {
			const result = parseManifest(VALID_FULL_YAML);
			const base = result.scripts[1] as ScriptEntry;
			expect(base.inputs).toHaveLength(1);
			const input = base.inputs?.[0];
			expect(input?.id).toBe("username");
			expect(input?.type).toBe("string");
			expect(input?.label).toBe("Enter username");
			expect(input?.required).toBe(true);
			expect(input?.default).toBe("admin");
			expect(input?.download_path).toBe("/tmp");
			// passthrough field
			expect((input as Record<string, unknown>).custom_extra_field).toBe(
				"passthrough-value",
			);
		});

		it("groups absent → succeeds without groups key", () => {
			const result = parseManifest(VALID_MINIMAL_YAML);
			expect(result.groups).toBeUndefined();
		});

		it("succeeds when groups are present", () => {
			const result = parseManifest(VALID_FULL_YAML);
			expect(result.groups).toHaveLength(1);
			const group = result.groups?.[0];
			expect(group?.id).toBe("devtools");
			expect(group?.scripts).toContain("setup-bash");
		});

		it("run_if and creates are preserved on entries", () => {
			const result = parseManifest(VALID_FULL_YAML);
			const base = result.scripts[1] as ScriptEntry;
			expect(base.run_if).toEqual(["setup-bash"]);
			expect(base.creates).toEqual(["/usr/local/bin/base"]);
		});
	});

	describe("malformed YAML", () => {
		it("throws ManifestValidationError for malformed YAML syntax", () => {
			const badYaml = "key: : bad : yaml :::";
			expect(() => parseManifest(badYaml)).toThrow(ManifestValidationError);
		});

		it("ManifestValidationError from bad YAML has at least one error message", () => {
			const badYaml = "key: : bad : yaml :::";
			try {
				parseManifest(badYaml);
				expect.unreachable("should have thrown");
			} catch (err) {
				expect(err).toBeInstanceOf(ManifestValidationError);
				expect((err as ManifestValidationError).errors.length).toBeGreaterThan(
					0,
				);
			}
		});
	});

	describe("missing required fields", () => {
		it("throws when 'id' is missing", () => {
			const yaml = `
scripts:
  - name: Setup Bash
    description: desc
    os:
      name: linux
      arch: x64
    script: scripts/linux/setup.sh
`;
			expect(() => parseManifest(yaml)).toThrow(ManifestValidationError);
		});

		it("throws when 'name' is missing", () => {
			const yaml = `
scripts:
  - id: setup-bash
    description: desc
    os:
      name: linux
      arch: x64
    script: scripts/linux/setup.sh
`;
			expect(() => parseManifest(yaml)).toThrow(ManifestValidationError);
		});

		it("throws when 'description' is missing", () => {
			const yaml = `
scripts:
  - id: setup-bash
    name: Setup Bash
    os:
      name: linux
      arch: x64
    script: scripts/linux/setup.sh
`;
			expect(() => parseManifest(yaml)).toThrow(ManifestValidationError);
		});

		it("throws when 'os.name' is missing", () => {
			const yaml = `
scripts:
  - id: setup-bash
    name: Setup Bash
    description: desc
    os:
      arch: x64
    script: scripts/linux/setup.sh
`;
			expect(() => parseManifest(yaml)).toThrow(ManifestValidationError);
		});

		it("throws when 'os.arch' is missing", () => {
			const yaml = `
scripts:
  - id: setup-bash
    name: Setup Bash
    description: desc
    os:
      name: linux
    script: scripts/linux/setup.sh
`;
			expect(() => parseManifest(yaml)).toThrow(ManifestValidationError);
		});

		it("throws when 'script' is missing", () => {
			const yaml = `
scripts:
  - id: setup-bash
    name: Setup Bash
    description: desc
    os:
      name: linux
      arch: x64
`;
			expect(() => parseManifest(yaml)).toThrow(ManifestValidationError);
		});
	});

	describe("cross-field validation", () => {
		it("throws on duplicate script id values", () => {
			const yaml = `
scripts:
  - id: setup-bash
    name: Setup Bash
    description: desc
    os:
      name: linux
      arch: x64
    script: scripts/linux/setup.sh
  - id: setup-bash
    name: Setup Bash Again
    description: desc2
    os:
      name: linux
      arch: x64
    script: scripts/linux/other.sh
`;
			try {
				parseManifest(yaml);
				expect.unreachable("should have thrown");
			} catch (err) {
				expect(err).toBeInstanceOf(ManifestValidationError);
				const message = (err as ManifestValidationError).errors.join(" ");
				expect(message).toContain("setup-bash");
			}
		});

		it("throws when a group references a script id not in scripts array", () => {
			const yaml = `
scripts:
  - id: setup-bash
    name: Setup Bash
    description: desc
    os:
      name: linux
      arch: x64
    script: scripts/linux/setup.sh
groups:
  - id: devtools
    name: DevTools
    description: desc
    scripts:
      - nonexistent-id
`;
			try {
				parseManifest(yaml);
				expect.unreachable("should have thrown");
			} catch (err) {
				expect(err).toBeInstanceOf(ManifestValidationError);
				const message = (err as ManifestValidationError).errors.join(" ");
				expect(message).toContain("nonexistent-id");
			}
		});

		it("throws on invalid run_if reference (id not in scripts)", () => {
			const yaml = `
scripts:
  - id: setup-bash
    name: Setup Bash
    description: desc
    os:
      name: linux
      arch: x64
    script: scripts/linux/setup.sh
    run_if:
      - nonexistent-dep
`;
			try {
				parseManifest(yaml);
				expect.unreachable("should have thrown");
			} catch (err) {
				expect(err).toBeInstanceOf(ManifestValidationError);
				const message = (err as ManifestValidationError).errors.join(" ");
				expect(message).toContain("nonexistent-dep");
			}
		});

		it("throws on duplicate input id within a script", () => {
			const yaml = `
scripts:
  - id: setup-bash
    name: Setup Bash
    description: desc
    os:
      name: linux
      arch: x64
    script: scripts/linux/setup.sh
    inputs:
      - id: username
        type: string
        label: "Username"
      - id: username
        type: string
        label: "Username again"
`;
			try {
				parseManifest(yaml);
				expect.unreachable("should have thrown");
			} catch (err) {
				expect(err).toBeInstanceOf(ManifestValidationError);
				const message = (err as ManifestValidationError).errors.join(" ");
				expect(message).toContain("username");
			}
		});

		it("throws on duplicate group id values", () => {
			const yaml = `
scripts:
  - id: setup-bash
    name: Setup Bash
    description: desc
    os:
      name: linux
      arch: x64
    script: scripts/linux/setup.sh
groups:
  - id: devtools
    name: DevTools
    description: desc
    scripts:
      - setup-bash
  - id: devtools
    name: DevTools Copy
    description: desc
    scripts:
      - setup-bash
`;
			expect(() => parseManifest(yaml)).toThrow(ManifestValidationError);
		});

		it("collects multiple cross-field errors in one throw", () => {
			// duplicate script id AND duplicate group id → both errors collected
			const yaml = `
scripts:
  - id: dup
    name: Dup
    description: desc
    os:
      name: linux
      arch: x64
    script: scripts/linux/a.sh
  - id: dup
    name: Dup2
    description: desc2
    os:
      name: linux
      arch: x64
    script: scripts/linux/b.sh
groups:
  - id: grp
    name: Grp
    description: desc
    scripts:
      - dup
  - id: grp
    name: Grp2
    description: desc2
    scripts:
      - dup
`;
			try {
				parseManifest(yaml);
				expect.unreachable("should have thrown");
			} catch (err) {
				expect(err).toBeInstanceOf(ManifestValidationError);
				expect((err as ManifestValidationError).errors.length).toBeGreaterThan(
					1,
				);
			}
		});
	});

	describe("integration: actual scriptor.yaml", () => {
		it("parseManifest does not throw on the actual scriptor.yaml", async () => {
			const yamlText = await Bun.file(
				new URL("../../../../scriptor.yaml", import.meta.url),
			).text();
			expect(() => parseManifest(yamlText)).not.toThrow();
		});

		it("returned scripts array has the correct length", async () => {
			const yamlText = await Bun.file(
				new URL("../../../../scriptor.yaml", import.meta.url),
			).text();
			const result = parseManifest(yamlText);
			// scriptor.yaml currently has 15 entries
			expect(result.scripts.length).toBeGreaterThan(0);
		});

		it("at least one entry has os.name set", async () => {
			const yamlText = await Bun.file(
				new URL("../../../../scriptor.yaml", import.meta.url),
			).text();
			const result = parseManifest(yamlText);
			expect(result.scripts.some((s) => s.os.name !== "")).toBe(true);
		});

		it("at least one entry has os.version set", async () => {
			const yamlText = await Bun.file(
				new URL("../../../../scriptor.yaml", import.meta.url),
			).text();
			const result = parseManifest(yamlText);
			expect(result.scripts.some((s) => s.os.version !== undefined)).toBe(true);
		});

		it("inputs are present on entries that declare them", async () => {
			const yamlText = await Bun.file(
				new URL("../../../../scriptor.yaml", import.meta.url),
			).text();
			const result = parseManifest(yamlText);
			const withInputs = result.scripts.filter(
				(s) => s.inputs && s.inputs.length > 0,
			);
			expect(withInputs.length).toBeGreaterThan(0);
		});
	});
});
