import { describe, expect, test } from "bun:test";
import { getInputsForScript, parseManifest } from "./parseManifest";

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe("parseManifest — happy path", () => {
	test("empty list returns empty array", () => {
		const result = parseManifest("[]");
		expect(result).toEqual([]);
	});

	test("valid windows entry is parsed correctly", () => {
		const yaml = `
- id: install-git
  name: Install Git
  description: Installs Git on Windows
  platform: windows
  arch: x86
  script: scripts/windows/install-git.ps1
`;
		const result = parseManifest(yaml);
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({
			id: "install-git",
			name: "Install Git",
			description: "Installs Git on Windows",
			platform: "windows",
			arch: "x86",
			script: "scripts/windows/install-git.ps1",
			dependencies: [],
			run_after: [],
			inputs: [],
			requires_sudo: false,
			requires_admin: false,
		});
	});

	test("valid mac entry is parsed correctly", () => {
		const yaml = `
- id: install-bun
  name: Install Bun
  description: Installs Bun.js on macOS
  platform: mac
  arch: arm
  script: scripts/mac/install-bun.sh
`;
		const result = parseManifest(yaml);
		expect(result).toHaveLength(1);
		expect(result[0]?.platform).toBe("mac");
		expect(result[0]?.arch).toBe("arm");
	});

	test("valid linux entry with distro and version is parsed correctly", () => {
		const yaml = `
- id: install-docker
  name: Install Docker
  description: Installs Docker on Ubuntu
  platform: linux
  arch: x86
  script: scripts/linux/install-docker.sh
  distro: ubuntu
  version: "24.04"
`;
		const result = parseManifest(yaml);
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({
			id: "install-docker",
			name: "Install Docker",
			description: "Installs Docker on Ubuntu",
			platform: "linux",
			arch: "x86",
			script: "scripts/linux/install-docker.sh",
			distro: "ubuntu",
			version: "24.04",
			dependencies: [],
			run_after: [],
			inputs: [],
			requires_sudo: false,
			requires_admin: false,
		});
	});

	test("entry with dependencies is parsed correctly", () => {
		const yaml = `
- id: install-compose
  name: Install Docker Compose
  description: Installs Docker Compose (requires Docker)
  platform: linux
  arch: x86
  script: scripts/linux/install-compose.sh
  distro: ubuntu
  version: "22.04"
  dependencies:
    - install-docker
    - install-curl
`;
		const result = parseManifest(yaml);
		expect(result).toHaveLength(1);
		expect(result[0]?.dependencies).toEqual(["install-docker", "install-curl"]);
	});

	test("multiple entries are all parsed", () => {
		const yaml = `
- id: install-git
  name: Install Git
  description: Git for Windows
  platform: windows
  arch: x86
  script: scripts/windows/git.ps1
- id: install-git
  name: Install Git
  description: Git for macOS
  platform: mac
  arch: arm
  script: scripts/mac/git.sh
`;
		const result = parseManifest(yaml);
		expect(result).toHaveLength(2);
	});

	test("entry with no dependencies field defaults to empty array", () => {
		const yaml = `
- id: standalone
  name: Standalone Script
  description: No dependencies
  platform: windows
  arch: arm
  script: scripts/windows/standalone.ps1
`;
		const result = parseManifest(yaml);
		expect(result[0]?.dependencies).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// Missing required fields
// ---------------------------------------------------------------------------

describe("parseManifest — missing required fields", () => {
	test("missing id throws descriptive error", () => {
		const yaml = `
- name: Install Git
  description: Installs Git
  platform: windows
  arch: x86
  script: scripts/windows/git.ps1
`;
		expect(() => parseManifest(yaml)).toThrow(/id/i);
	});

	test("missing name throws descriptive error", () => {
		const yaml = `
- id: install-git
  description: Installs Git
  platform: windows
  arch: x86
  script: scripts/windows/git.ps1
`;
		expect(() => parseManifest(yaml)).toThrow(/name/i);
	});

	test("missing description throws descriptive error", () => {
		const yaml = `
- id: install-git
  name: Install Git
  platform: windows
  arch: x86
  script: scripts/windows/git.ps1
`;
		expect(() => parseManifest(yaml)).toThrow(/description/i);
	});

	test("missing platform throws descriptive error", () => {
		const yaml = `
- id: install-git
  name: Install Git
  description: Installs Git
  arch: x86
  script: scripts/windows/git.ps1
`;
		expect(() => parseManifest(yaml)).toThrow(/platform/i);
	});

	test("missing arch throws descriptive error", () => {
		const yaml = `
- id: install-git
  name: Install Git
  description: Installs Git
  platform: windows
  script: scripts/windows/git.ps1
`;
		expect(() => parseManifest(yaml)).toThrow(/arch/i);
	});

	test("missing script throws descriptive error", () => {
		const yaml = `
- id: install-git
  name: Install Git
  description: Installs Git
  platform: windows
  arch: x86
`;
		expect(() => parseManifest(yaml)).toThrow(/script/i);
	});
});

// ---------------------------------------------------------------------------
// Invalid enum values
// ---------------------------------------------------------------------------

describe("parseManifest — invalid enum values", () => {
	test("invalid platform value throws descriptive error", () => {
		const yaml = `
- id: install-git
  name: Install Git
  description: Installs Git
  platform: bsd
  arch: x86
  script: scripts/bsd/git.sh
`;
		expect(() => parseManifest(yaml)).toThrow(/platform/i);
	});

	test("invalid arch value throws descriptive error", () => {
		const yaml = `
- id: install-git
  name: Install Git
  description: Installs Git
  platform: windows
  arch: mips
  script: scripts/windows/git.ps1
`;
		expect(() => parseManifest(yaml)).toThrow(/arch/i);
	});
});

// ---------------------------------------------------------------------------
// Linux-only field rules
// ---------------------------------------------------------------------------

describe("parseManifest — Linux-only field rules", () => {
	test("linux entry missing distro throws validation error", () => {
		const yaml = `
- id: install-docker
  name: Install Docker
  description: Installs Docker
  platform: linux
  arch: x86
  script: scripts/linux/docker.sh
  version: "24.04"
`;
		expect(() => parseManifest(yaml)).toThrow(/distro/i);
	});

	test("linux entry missing version throws validation error", () => {
		const yaml = `
- id: install-docker
  name: Install Docker
  description: Installs Docker
  platform: linux
  arch: x86
  script: scripts/linux/docker.sh
  distro: ubuntu
`;
		expect(() => parseManifest(yaml)).toThrow(/version/i);
	});

	test("windows entry with distro is rejected", () => {
		const yaml = `
- id: install-git
  name: Install Git
  description: Installs Git
  platform: windows
  arch: x86
  script: scripts/windows/git.ps1
  distro: ubuntu
`;
		expect(() => parseManifest(yaml)).toThrow(/distro/i);
	});

	test("mac entry with version is rejected", () => {
		const yaml = `
- id: install-bun
  name: Install Bun
  description: Installs Bun
  platform: mac
  arch: arm
  script: scripts/mac/bun.sh
  version: "14.0"
`;
		expect(() => parseManifest(yaml)).toThrow(/version/i);
	});

	test("windows entry with version is rejected", () => {
		const yaml = `
- id: install-git
  name: Install Git
  description: Installs Git
  platform: windows
  arch: x86
  script: scripts/windows/git.ps1
  version: "11"
`;
		expect(() => parseManifest(yaml)).toThrow(/version/i);
	});

	test("mac entry with distro is rejected", () => {
		const yaml = `
- id: install-bun
  name: Install Bun
  description: Installs Bun
  platform: mac
  arch: arm
  script: scripts/mac/bun.sh
  distro: ubuntu
`;
		expect(() => parseManifest(yaml)).toThrow(/distro/i);
	});
});

// ---------------------------------------------------------------------------
// Malformed YAML / invalid top-level structure
// ---------------------------------------------------------------------------

describe("parseManifest — malformed input", () => {
	test("unparseable YAML throws error", () => {
		expect(() => parseManifest("{ unclosed: [")).toThrow();
	});

	test("non-array YAML (plain object) throws error", () => {
		const yaml = `
scripts:
  - id: install-git
`;
		expect(() => parseManifest(yaml)).toThrow(/array/i);
	});

	test("non-array YAML (scalar string) throws error", () => {
		expect(() => parseManifest("just a string")).toThrow(/array/i);
	});
});

// ---------------------------------------------------------------------------
// inputs field — Task 2
// ---------------------------------------------------------------------------

describe("parseManifest — inputs field", () => {
	test("YAML with valid inputs on a script parses and returns InputDef[]", () => {
		const yaml = `
- id: install-git
  name: Install Git
  description: Installs Git
  platform: windows
  arch: x86
  script: scripts/windows/git.ps1
  inputs:
    - id: username
      type: string
      label: GitHub Username
      required: true
`;
		const result = parseManifest(yaml);
		expect(result).toHaveLength(1);
		const inputs = result[0]?.inputs ?? [];
		expect(inputs).toHaveLength(1);
		expect(inputs[0]?.id).toBe("username");
		expect(inputs[0]?.type).toBe("string");
		expect(inputs[0]?.label).toBe("GitHub Username");
	});

	test("script with no inputs field returns empty array", () => {
		const yaml = `
- id: install-git
  name: Install Git
  description: Installs Git
  platform: windows
  arch: x86
  script: scripts/windows/git.ps1
`;
		const result = parseManifest(yaml);
		expect(result[0]?.inputs).toEqual([]);
	});

	test("YAML with duplicate input id within one script throws a load error", () => {
		const yaml = `
- id: install-git
  name: Install Git
  description: Installs Git
  platform: windows
  arch: x86
  script: scripts/windows/git.ps1
  inputs:
    - id: username
      type: string
      label: GitHub Username
    - id: username
      type: string
      label: GitHub Username Again
`;
		expect(() => parseManifest(yaml)).toThrow(/duplicate/i);
	});

	test("YAML with an unknown input type throws a Zod validation error", () => {
		const yaml = `
- id: install-git
  name: Install Git
  description: Installs Git
  platform: windows
  arch: x86
  script: scripts/windows/git.ps1
  inputs:
    - id: token
      type: secret
      label: API Token
`;
		expect(() => parseManifest(yaml)).toThrow();
	});

	test("ssl-cert input missing format throws a Zod validation error", () => {
		const yaml = `
- id: install-git
  name: Install Git
  description: Installs Git
  platform: windows
  arch: x86
  script: scripts/windows/git.ps1
  inputs:
    - id: cert
      type: ssl-cert
      label: Server Certificate
      download_path: /tmp/cert.pem
`;
		expect(() => parseManifest(yaml)).toThrow();
	});
});

// ---------------------------------------------------------------------------
// requires_sudo field
// ---------------------------------------------------------------------------

describe("parseManifest — requires_sudo", () => {
	test("requires_sudo: true on linux entry is parsed correctly", () => {
		const yaml = `
- id: install-docker
  name: Install Docker
  description: Installs Docker on Ubuntu
  platform: linux
  arch: x86
  script: scripts/linux/install-docker.sh
  distro: ubuntu
  version: "24.04"
  requires_sudo: true
`;
		const result = parseManifest(yaml);
		expect(result[0]?.requires_sudo).toBe(true);
	});

	test("omitted requires_sudo defaults to false", () => {
		const yaml = `
- id: install-git
  name: Install Git
  description: Installs Git on Windows
  platform: windows
  arch: x86
  script: scripts/windows/install-git.ps1
`;
		const result = parseManifest(yaml);
		expect(result[0]?.requires_sudo).toBe(false);
	});

	test("requires_sudo: true on windows entry is rejected", () => {
		const yaml = `
- id: install-git
  name: Install Git
  description: Installs Git on Windows
  platform: windows
  arch: x86
  script: scripts/windows/install-git.ps1
  requires_sudo: true
`;
		expect(() => parseManifest(yaml)).toThrow(/requires_sudo/);
	});

	test("non-boolean requires_sudo is rejected", () => {
		const yaml = `
- id: install-docker
  name: Install Docker
  description: Installs Docker on Ubuntu
  platform: linux
  arch: x86
  script: scripts/linux/install-docker.sh
  distro: ubuntu
  version: "24.04"
  requires_sudo: "yes"
`;
		expect(() => parseManifest(yaml)).toThrow(/requires_sudo/);
	});
});

// ---------------------------------------------------------------------------
// requires_admin field
// ---------------------------------------------------------------------------

describe("parseManifest — requires_admin", () => {
	test("requires_admin: true on windows entry is parsed correctly", () => {
		const yaml = `
- id: setup-devbox
  name: Setup Devbox
  description: Sets up a devbox on Windows
  platform: windows
  arch: x86
  script: scripts/windows/setup-devbox.ps1
  requires_admin: true
`;
		const result = parseManifest(yaml);
		expect(result[0]?.requires_admin).toBe(true);
	});

	test("omitted requires_admin defaults to false", () => {
		const yaml = `
- id: install-git
  name: Install Git
  description: Installs Git on Windows
  platform: windows
  arch: x86
  script: scripts/windows/install-git.ps1
`;
		const result = parseManifest(yaml);
		expect(result[0]?.requires_admin).toBe(false);
	});

	test("requires_admin: true on linux entry is rejected", () => {
		const yaml = `
- id: install-docker
  name: Install Docker
  description: Installs Docker on Ubuntu
  platform: linux
  arch: x86
  script: scripts/linux/install-docker.sh
  distro: ubuntu
  version: "24.04"
  requires_admin: true
`;
		expect(() => parseManifest(yaml)).toThrow(/requires_admin/);
	});

	test("requires_admin: true on mac entry is rejected", () => {
		const yaml = `
- id: install-bun
  name: Install Bun
  description: Installs Bun on macOS
  platform: mac
  arch: arm
  script: scripts/mac/install-bun.sh
  requires_admin: true
`;
		expect(() => parseManifest(yaml)).toThrow(/requires_admin/);
	});

	test("non-boolean requires_admin is rejected", () => {
		const yaml = `
- id: setup-devbox
  name: Setup Devbox
  description: Sets up a devbox on Windows
  platform: windows
  arch: x86
  script: scripts/windows/setup-devbox.ps1
  requires_admin: "yes"
`;
		expect(() => parseManifest(yaml)).toThrow(/requires_admin/);
	});
});

// ---------------------------------------------------------------------------
// run_after field
// ---------------------------------------------------------------------------

describe("parseManifest — run_after field", () => {
	test("run_after omitted defaults to empty array", () => {
		const yaml = `
- id: install-git
  name: Install Git
  description: Installs Git on Windows
  platform: windows
  arch: x86
  script: scripts/windows/install-git.ps1
`;
		const result = parseManifest(yaml);
		expect(result[0]?.run_after).toEqual([]);
	});

	test("run_after: [] parses as empty array", () => {
		const yaml = `
- id: install-git
  name: Install Git
  description: Installs Git on Windows
  platform: windows
  arch: x86
  script: scripts/windows/install-git.ps1
  run_after: []
`;
		const result = parseManifest(yaml);
		expect(result[0]?.run_after).toEqual([]);
	});

	test("run_after with one id parses correctly", () => {
		const yaml = `
- id: configure-certs
  name: Configure Certs
  description: Configures certs
  platform: linux
  arch: x86
  script: scripts/linux/configure-certs.sh
  distro: ubuntu
  version: "24.04"
  run_after:
    - install-uv
`;
		const result = parseManifest(yaml);
		expect(result[0]?.run_after).toEqual(["install-uv"]);
	});

	test("run_after that is not an array throws a descriptive error", () => {
		const yaml = `
- id: install-git
  name: Install Git
  description: Installs Git on Windows
  platform: windows
  arch: x86
  script: scripts/windows/install-git.ps1
  run_after: install-curl
`;
		expect(() => parseManifest(yaml)).toThrow(/run_after/);
	});
});

describe("getInputsForScript", () => {
	test("returns the inputs for a known script id", () => {
		const yaml = `
- id: install-git
  name: Install Git
  description: Installs Git
  platform: windows
  arch: x86
  script: scripts/windows/git.ps1
  inputs:
    - id: username
      type: string
      label: GitHub Username
`;
		const entries = parseManifest(yaml);
		const inputs = getInputsForScript("install-git", entries);
		expect(inputs).toHaveLength(1);
		expect(inputs[0]?.id).toBe("username");
	});

	test("returns empty array for a script id with no inputs", () => {
		const yaml = `
- id: install-git
  name: Install Git
  description: Installs Git
  platform: windows
  arch: x86
  script: scripts/windows/git.ps1
`;
		const entries = parseManifest(yaml);
		const inputs = getInputsForScript("install-git", entries);
		expect(inputs).toEqual([]);
	});

	test("returns empty array for an unknown script id", () => {
		const yaml = `
- id: install-git
  name: Install Git
  description: Installs Git
  platform: windows
  arch: x86
  script: scripts/windows/git.ps1
`;
		const entries = parseManifest(yaml);
		const inputs = getInputsForScript("nonexistent", entries);
		expect(inputs).toEqual([]);
	});
});
