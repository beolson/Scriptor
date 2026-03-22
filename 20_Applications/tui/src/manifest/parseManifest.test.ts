// ---------------------------------------------------------------------------
// parseManifest Tests
//
// TDD: tests written before implementation.
// All tests use injectable deps (log.error, exit) so no real process.exit
// or console output occurs.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "bun:test";
import type { ParseManifestDeps } from "./parseManifest.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface CapturedErrors {
	errors: string[];
	exitCode: number | undefined;
}

function makeDeps(captured: CapturedErrors): ParseManifestDeps {
	return {
		log: {
			error: (msg: string) => {
				captured.errors.push(msg);
			},
		},
		exit: (code: number): never => {
			captured.exitCode = code;
			throw new Error(`exit:${code}`);
		},
	};
}

// ---------------------------------------------------------------------------
// Shared YAML fragments
// ---------------------------------------------------------------------------

const MINIMAL_WINDOWS_YAML = `
- id: setup-foo
  name: Setup Foo
  description: A minimal windows entry
  platform: windows
  arch: x86
  script: scripts/Windows/setup-foo.ps1
`;

const MINIMAL_LINUX_YAML = `
- id: install-basics
  name: Install Basics
  description: A minimal linux entry
  platform: linux
  arch: x86
  distro: Debian GNU/Linux
  version: "13"
  script: scripts/Debian/13/install-basics.sh
`;

const FULL_ENTRY_YAML = `
- id: install-full
  name: Install Full
  description: Entry with all optional fields
  platform: linux
  arch: arm
  distro: Ubuntu
  version: "22.04"
  script: scripts/Ubuntu/22.04/install-full.sh
  group: networking
  dependencies:
    - install-basics
  optional_dependencies:
    - install-extras
  requires_elevation: true
  creates: ~/.local/bin/full-tool
  inputs:
    - id: cert
      type: ssl-cert
      label: Cert URL
      required: true
      download_path: /tmp/cert.pem
      format: PEM
`;

// ---------------------------------------------------------------------------
// Lazy import helper — only imported after RED phase confirms tests fail
// ---------------------------------------------------------------------------

async function getParseManifest() {
	const { parseManifest } = await import("./parseManifest.js");
	return parseManifest;
}

// ---------------------------------------------------------------------------
// Valid inputs
// ---------------------------------------------------------------------------

describe("parseManifest — valid inputs", () => {
	it("parses a minimal windows entry correctly", async () => {
		const parseManifest = await getParseManifest();
		const captured: CapturedErrors = { errors: [], exitCode: undefined };
		const manifest = parseManifest(MINIMAL_WINDOWS_YAML, makeDeps(captured));

		expect(manifest).toHaveLength(1);
		const entry = manifest[0];
		expect(entry?.id).toBe("setup-foo");
		expect(entry?.name).toBe("Setup Foo");
		expect(entry?.description).toBe("A minimal windows entry");
		expect(entry?.platform).toBe("windows");
		expect(entry?.arch).toBe("x86");
		expect(entry?.script).toBe("scripts/Windows/setup-foo.ps1");
		// defaults applied
		expect(entry?.dependencies).toEqual([]);
		expect(entry?.optional_dependencies).toEqual([]);
		expect(entry?.inputs).toEqual([]);
		expect(entry?.requires_elevation).toBe(false);
		expect(captured.errors).toHaveLength(0);
		expect(captured.exitCode).toBeUndefined();
	});

	it("parses a valid linux entry with distro and version", async () => {
		const parseManifest = await getParseManifest();
		const captured: CapturedErrors = { errors: [], exitCode: undefined };
		const manifest = parseManifest(MINIMAL_LINUX_YAML, makeDeps(captured));

		expect(manifest).toHaveLength(1);
		const entry = manifest[0];
		expect(entry?.platform).toBe("linux");
		expect(entry?.distro).toBe("Debian GNU/Linux");
		expect(entry?.version).toBe("13");
		expect(captured.errors).toHaveLength(0);
	});

	it("parses an entry with all optional fields", async () => {
		const parseManifest = await getParseManifest();
		const captured: CapturedErrors = { errors: [], exitCode: undefined };
		const manifest = parseManifest(FULL_ENTRY_YAML, makeDeps(captured));

		expect(manifest).toHaveLength(1);
		const entry = manifest[0];
		expect(entry?.group).toBe("networking");
		expect(entry?.dependencies).toEqual(["install-basics"]);
		expect(entry?.optional_dependencies).toEqual(["install-extras"]);
		expect(entry?.requires_elevation).toBe(true);
		expect(entry?.creates).toBe("~/.local/bin/full-tool");
		expect(entry?.inputs).toHaveLength(1);
		expect(captured.errors).toHaveLength(0);
	});

	it("InputDef passthrough preserves unknown fields (download_path, format)", async () => {
		const parseManifest = await getParseManifest();
		const captured: CapturedErrors = { errors: [], exitCode: undefined };
		const manifest = parseManifest(FULL_ENTRY_YAML, makeDeps(captured));

		const input = manifest[0]?.inputs[0];
		expect(input?.id).toBe("cert");
		expect(input?.type).toBe("ssl-cert");
		expect((input as Record<string, unknown>)?.download_path).toBe(
			"/tmp/cert.pem",
		);
		expect((input as Record<string, unknown>)?.format).toBe("PEM");
	});

	it("applies defaults for missing optional arrays", async () => {
		const parseManifest = await getParseManifest();
		const captured: CapturedErrors = { errors: [], exitCode: undefined };
		const manifest = parseManifest(MINIMAL_WINDOWS_YAML, makeDeps(captured));

		const entry = manifest[0];
		expect(entry?.dependencies).toEqual([]);
		expect(entry?.optional_dependencies).toEqual([]);
		expect(entry?.inputs).toEqual([]);
		expect(entry?.requires_elevation).toBe(false);
	});

	it("parses multiple entries", async () => {
		const parseManifest = await getParseManifest();
		const captured: CapturedErrors = { errors: [], exitCode: undefined };
		const yaml = `
- id: entry-a
  name: Entry A
  description: First entry
  platform: windows
  arch: x86
  script: scripts/Windows/a.ps1
- id: entry-b
  name: Entry B
  description: Second entry
  platform: mac
  arch: arm
  script: scripts/Mac/b.sh
`;
		const manifest = parseManifest(yaml, makeDeps(captured));
		expect(manifest).toHaveLength(2);
		expect(manifest[0]?.id).toBe("entry-a");
		expect(manifest[1]?.id).toBe("entry-b");
	});
});

// ---------------------------------------------------------------------------
// Fatal error paths
// ---------------------------------------------------------------------------

describe("parseManifest — fatal errors call log.error then exit(1)", () => {
	it("invalid YAML calls log.error and exit(1)", async () => {
		const parseManifest = await getParseManifest();
		const captured: CapturedErrors = { errors: [], exitCode: undefined };
		const deps = makeDeps(captured);

		expect(() => parseManifest("{ invalid yaml: [unclosed", deps)).toThrow(
			"exit:1",
		);
		expect(captured.errors).toHaveLength(1);
		expect(captured.exitCode).toBe(1);
	});

	it("missing required field (id) calls log.error and exit(1)", async () => {
		const parseManifest = await getParseManifest();
		const captured: CapturedErrors = { errors: [], exitCode: undefined };
		const deps = makeDeps(captured);
		const yaml = `
- name: No ID Entry
  description: Missing id
  platform: windows
  arch: x86
  script: scripts/Windows/no-id.ps1
`;
		expect(() => parseManifest(yaml, deps)).toThrow("exit:1");
		expect(captured.errors).toHaveLength(1);
		expect(captured.exitCode).toBe(1);
	});

	it("wrong type on a field calls log.error and exit(1)", async () => {
		const parseManifest = await getParseManifest();
		const captured: CapturedErrors = { errors: [], exitCode: undefined };
		const deps = makeDeps(captured);
		const yaml = `
- id: 12345
  name: Bad ID Type
  description: id is a number not a string
  platform: windows
  arch: x86
  script: scripts/Windows/bad.ps1
`;
		expect(() => parseManifest(yaml, deps)).toThrow("exit:1");
		expect(captured.errors).toHaveLength(1);
		expect(captured.exitCode).toBe(1);
	});

	it("duplicate input id calls log.error and exit(1)", async () => {
		const parseManifest = await getParseManifest();
		const captured: CapturedErrors = { errors: [], exitCode: undefined };
		const deps = makeDeps(captured);
		const yaml = `
- id: setup-dup
  name: Setup Dup
  description: Has duplicate input ids
  platform: windows
  arch: x86
  script: scripts/Windows/dup.ps1
  inputs:
    - id: token
      type: string
      label: Token
    - id: token
      type: string
      label: Token Again
`;
		expect(() => parseManifest(yaml, deps)).toThrow("exit:1");
		expect(captured.errors).toHaveLength(1);
		expect(captured.exitCode).toBe(1);
	});

	it("distro present on windows entry calls log.error and exit(1)", async () => {
		const parseManifest = await getParseManifest();
		const captured: CapturedErrors = { errors: [], exitCode: undefined };
		const deps = makeDeps(captured);
		const yaml = `
- id: windows-with-distro
  name: Windows With Distro
  description: windows entry should not have distro
  platform: windows
  arch: x86
  distro: Debian GNU/Linux
  script: scripts/Windows/bad.ps1
`;
		expect(() => parseManifest(yaml, deps)).toThrow("exit:1");
		expect(captured.errors).toHaveLength(1);
		expect(captured.exitCode).toBe(1);
	});

	it("version present on mac entry calls log.error and exit(1)", async () => {
		const parseManifest = await getParseManifest();
		const captured: CapturedErrors = { errors: [], exitCode: undefined };
		const deps = makeDeps(captured);
		const yaml = `
- id: mac-with-version
  name: Mac With Version
  description: mac entry should not have version
  platform: mac
  arch: arm
  version: "14"
  script: scripts/Mac/bad.sh
`;
		expect(() => parseManifest(yaml, deps)).toThrow("exit:1");
		expect(captured.errors).toHaveLength(1);
		expect(captured.exitCode).toBe(1);
	});

	it("linux entry without distro calls log.error and exit(1)", async () => {
		const parseManifest = await getParseManifest();
		const captured: CapturedErrors = { errors: [], exitCode: undefined };
		const deps = makeDeps(captured);
		const yaml = `
- id: linux-no-distro
  name: Linux No Distro
  description: linux entry missing distro
  platform: linux
  arch: x86
  version: "13"
  script: scripts/Debian/13/no-distro.sh
`;
		expect(() => parseManifest(yaml, deps)).toThrow("exit:1");
		expect(captured.errors).toHaveLength(1);
		expect(captured.exitCode).toBe(1);
	});

	it("linux entry without version calls log.error and exit(1)", async () => {
		const parseManifest = await getParseManifest();
		const captured: CapturedErrors = { errors: [], exitCode: undefined };
		const deps = makeDeps(captured);
		const yaml = `
- id: linux-no-version
  name: Linux No Version
  description: linux entry missing version
  platform: linux
  arch: x86
  distro: Debian GNU/Linux
  script: scripts/Debian/13/no-version.sh
`;
		expect(() => parseManifest(yaml, deps)).toThrow("exit:1");
		expect(captured.errors).toHaveLength(1);
		expect(captured.exitCode).toBe(1);
	});
});
