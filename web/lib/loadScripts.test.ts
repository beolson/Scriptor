import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
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

	it("ignores inline YAML spec field (spec comes from .spec.md files)", () => {
		const scripts = loadScripts(FIXTURE_YAML);
		const docker = scripts.find((s) => s.id === "install-docker");
		expect(docker).toBeDefined();
		if (docker) {
			// spec from YAML is no longer read; without a basePath there are no
			// .spec.md files to load, so spec should be undefined
			expect(docker.spec).toBeUndefined();
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

describe("loadScripts() — spec file migration", () => {
	const tmpDir = join(import.meta.dir, "__fixtures_spec_migration__");

	beforeEach(() => {
		mkdirSync(join(tmpDir, "scripts"), { recursive: true });
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("populates spec from a .spec.md file on disk rather than YAML spec field", () => {
		const specContent = "## Overview\n\nInstalls Docker Engine on Debian 13.\n";
		writeFileSync(
			join(tmpDir, "scripts/install-docker.sh.spec.md"),
			specContent,
		);
		writeFileSync(
			join(tmpDir, "scripts/install-docker.sh"),
			"#!/bin/bash\necho hello\n",
		);

		const yaml = `
- id: install-docker
  name: Install Docker
  description: Installs Docker
  platform: linux
  arch: x86
  script: scripts/install-docker.sh
`;
		const scripts = loadScripts(yaml, tmpDir);
		const docker = scripts.find((s) => s.id === "install-docker");
		expect(docker).toBeDefined();
		expect(docker!.spec).toBe(specContent);
	});

	it("populates scriptSource with the contents of the script file", () => {
		const scriptContent = "#!/bin/bash\nset -euo pipefail\necho hello\n";
		writeFileSync(join(tmpDir, "scripts/install-docker.sh"), scriptContent);

		const yaml = `
- id: install-docker
  name: Install Docker
  description: Installs Docker
  platform: linux
  arch: x86
  script: scripts/install-docker.sh
`;
		const scripts = loadScripts(yaml, tmpDir);
		const docker = scripts.find((s) => s.id === "install-docker");
		expect(docker).toBeDefined();
		expect(docker!.scriptSource).toBe(scriptContent);
	});

	it("when no .spec.md file exists, spec is undefined", () => {
		writeFileSync(
			join(tmpDir, "scripts/update-system.sh"),
			"#!/bin/bash\napt update\n",
		);

		const yaml = `
- id: update-system
  name: Update System
  description: Updates packages
  platform: linux
  arch: x86
  script: scripts/update-system.sh
`;
		const scripts = loadScripts(yaml, tmpDir);
		const update = scripts.find((s) => s.id === "update-system");
		expect(update).toBeDefined();
		expect(update!.spec).toBeUndefined();
	});

	it("ignores the YAML spec field even if present", () => {
		const specFileContent = "## From File\n\nThis is the spec file content.\n";
		writeFileSync(
			join(tmpDir, "scripts/install-docker.sh.spec.md"),
			specFileContent,
		);
		writeFileSync(
			join(tmpDir, "scripts/install-docker.sh"),
			"#!/bin/bash\necho hi\n",
		);

		const yaml = `
- id: install-docker
  name: Install Docker
  description: Installs Docker
  platform: linux
  arch: x86
  script: scripts/install-docker.sh
  spec: |
    ## From YAML
    This should be ignored.
`;
		const scripts = loadScripts(yaml, tmpDir);
		const docker = scripts.find((s) => s.id === "install-docker");
		expect(docker).toBeDefined();
		expect(docker!.spec).toBe(specFileContent);
		expect(docker!.spec).not.toContain("From YAML");
	});
});

describe("loadScripts() — input data model and loading", () => {
	it("parses inputs array from YAML with correct Input objects", () => {
		const yaml = `
- id: configure-tls
  name: Configure TLS
  description: Configures TLS endpoint
  platform: linux
  arch: x86
  script: scripts/configure-tls.sh
  inputs:
    - id: service-name
      type: string
      label: Service name
      required: true
    - id: port
      type: number
      label: Port number
      required: true
      default: 443
    - id: cert
      type: ssl-cert
      label: TLS certificate
      download_path: /tmp/scriptor-demo.pem
      format: PEM
`;
		const scripts = loadScripts(yaml);
		const tls = scripts.find((s) => s.id === "configure-tls");
		expect(tls).toBeDefined();
		expect(tls!.inputs).toBeDefined();
		expect(Array.isArray(tls!.inputs)).toBe(true);
		expect(tls!.inputs!.length).toBe(3);
	});

	it("each input has id, type, and label populated", () => {
		const yaml = `
- id: configure-tls
  name: Configure TLS
  description: Configures TLS endpoint
  platform: linux
  arch: x86
  script: scripts/configure-tls.sh
  inputs:
    - id: service-name
      type: string
      label: Service name
      required: true
`;
		const scripts = loadScripts(yaml);
		const tls = scripts.find((s) => s.id === "configure-tls");
		expect(tls).toBeDefined();
		const input = tls!.inputs![0];
		expect(input).toBeDefined();
		expect(input!.id).toBe("service-name");
		expect(input!.type).toBe("string");
		expect(input!.label).toBe("Service name");
	});

	it("preserves optional fields (required, default, download_path, format) when present", () => {
		const yaml = `
- id: configure-tls
  name: Configure TLS
  description: Configures TLS endpoint
  platform: linux
  arch: x86
  script: scripts/configure-tls.sh
  inputs:
    - id: port
      type: number
      label: Port number
      required: true
      default: 443
    - id: cert
      type: ssl-cert
      label: TLS certificate
      download_path: /tmp/scriptor-demo.pem
      format: PEM
`;
		const scripts = loadScripts(yaml);
		const tls = scripts.find((s) => s.id === "configure-tls");
		expect(tls).toBeDefined();

		const port = tls!.inputs!.find((i) => i.id === "port");
		expect(port).toBeDefined();
		expect(port!.required).toBe(true);
		expect(port!.default).toBe("443");

		const cert = tls!.inputs!.find((i) => i.id === "cert");
		expect(cert).toBeDefined();
		expect(cert!.download_path).toBe("/tmp/scriptor-demo.pem");
		expect(cert!.format).toBe("PEM");
	});

	it("a script with no inputs key has inputs as undefined", () => {
		const yaml = `
- id: update-system
  name: Update System
  description: Updates packages
  platform: linux
  arch: x86
  script: scripts/update-system.sh
`;
		const scripts = loadScripts(yaml);
		const update = scripts.find((s) => s.id === "update-system");
		expect(update).toBeDefined();
		expect(update!.inputs).toBeUndefined();
	});

	it("skips malformed input entries missing id, type, or label", () => {
		const yaml = `
- id: configure-tls
  name: Configure TLS
  description: Configures TLS endpoint
  platform: linux
  arch: x86
  script: scripts/configure-tls.sh
  inputs:
    - id: service-name
      type: string
      label: Service name
    - id: missing-type
      label: No type field
    - type: string
      label: No id field
    - id: missing-label
      type: string
    - id: port
      type: number
      label: Port number
`;
		const scripts = loadScripts(yaml);
		const tls = scripts.find((s) => s.id === "configure-tls");
		expect(tls).toBeDefined();
		expect(tls!.inputs).toBeDefined();
		// Only the two valid entries should remain
		expect(tls!.inputs!.length).toBe(2);
		expect(tls!.inputs![0]!.id).toBe("service-name");
		expect(tls!.inputs![1]!.id).toBe("port");
	});
});
