import { describe, expect, it } from "bun:test";
import {
	getScriptById,
	getScriptsByPlatform,
	loadScripts,
} from "./loadScripts";

const FIXTURE_YAML = `
- id: update-system
  name: Update System Packages
  description: Updates apt package lists
  platform: linux
  arch: x86
  distro: Debian GNU/Linux
  version: "13"
  script: scripts/update-system.sh

- id: install-docker
  name: Install Docker
  description: Installs Docker Engine and Docker Compose plugin
  platform: linux
  arch: x86
  distro: Debian GNU/Linux
  version: "13"
  script: scripts/install-docker.sh
  spec: |
    ## Overview
    Installs Docker Engine on Debian 13.
  dependencies:
    - update-system

- id: install-homebrew
  name: Install Homebrew
  description: Installs the Homebrew package manager on macOS
  platform: mac
  arch: x86
  script: scripts/install-homebrew.sh

- id: install-wsl
  name: Install WSL2
  description: Enables Windows Subsystem for Linux 2
  platform: windows
  arch: x86
  script: scripts/install-wsl.ps1
`;

describe("loadScripts()", () => {
	it("parses valid YAML and returns a typed Script array", () => {
		const scripts = loadScripts(FIXTURE_YAML);
		expect(Array.isArray(scripts)).toBe(true);
		expect(scripts.length).toBe(4);

		const first = scripts[0];
		expect(first).toBeDefined();
		if (first) {
			expect(first.id).toBe("update-system");
			expect(first.name).toBe("Update System Packages");
			expect(first.platform).toBe("linux");
			expect(first.arch).toBe("x86");
		}
	});

	it("missing optional fields default to undefined", () => {
		const scripts = loadScripts(FIXTURE_YAML);
		const homebrew = scripts.find((s) => s.id === "install-homebrew");
		expect(homebrew).toBeDefined();
		if (homebrew) {
			expect(homebrew.spec).toBeUndefined();
			expect(homebrew.distro).toBeUndefined();
			expect(homebrew.version).toBeUndefined();
			expect(homebrew.dependencies).toBeUndefined();
		}
	});

	it("parses spec field as a string when present", () => {
		const scripts = loadScripts(FIXTURE_YAML);
		const docker = scripts.find((s) => s.id === "install-docker");
		expect(docker).toBeDefined();
		if (docker) {
			expect(typeof docker.spec).toBe("string");
			expect(docker.spec).toContain("## Overview");
		}
	});

	it("parses dependencies as a string array when present", () => {
		const scripts = loadScripts(FIXTURE_YAML);
		const docker = scripts.find((s) => s.id === "install-docker");
		expect(docker).toBeDefined();
		if (docker) {
			expect(Array.isArray(docker.dependencies)).toBe(true);
			expect(docker.dependencies).toContain("update-system");
		}
	});
});

describe("getScriptsByPlatform()", () => {
	it("returns only linux entries for platform 'linux'", () => {
		const scripts = loadScripts(FIXTURE_YAML);
		const linux = getScriptsByPlatform(scripts, "linux");
		expect(linux.length).toBe(2);
		for (const s of linux) {
			expect(s.platform).toBe("linux");
		}
	});

	it("returns only mac entries for platform 'mac'", () => {
		const scripts = loadScripts(FIXTURE_YAML);
		const mac = getScriptsByPlatform(scripts, "mac");
		expect(mac.length).toBe(1);
		expect(mac[0]?.platform).toBe("mac");
	});

	it("returns empty array when no scripts match the platform", () => {
		const noMatchYaml = `
- id: install-wsl
  name: Install WSL2
  description: Enables WSL2
  platform: windows
  arch: x86
  script: scripts/install-wsl.ps1
`;
		const scripts = loadScripts(noMatchYaml);
		const mac = getScriptsByPlatform(scripts, "mac");
		expect(mac.length).toBe(0);
	});
});

describe("getScriptById()", () => {
	it("finds the correct entry by id", () => {
		const scripts = loadScripts(FIXTURE_YAML);
		const docker = getScriptById(scripts, "install-docker");
		expect(docker).toBeDefined();
		if (docker) {
			expect(docker.id).toBe("install-docker");
			expect(docker.name).toBe("Install Docker");
		}
	});

	it("returns undefined for an unknown id", () => {
		const scripts = loadScripts(FIXTURE_YAML);
		const result = getScriptById(scripts, "nonexistent-script");
		expect(result).toBeUndefined();
	});
});
