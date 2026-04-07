import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Script } from "../../../lib/types.js";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("../../../lib/loadScripts.js", () => ({
	loadScripts: vi.fn(),
}));

vi.mock("next/navigation", () => ({
	notFound: vi.fn(() => {
		throw new Error("NEXT_NOT_FOUND");
	}),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const linuxScript: Script = {
	id: "linux/ubuntu-24.04/install-curl",
	title: "Install curl",
	platform: "linux",
	os: "ubuntu-24.04",
	body: "Installs curl on Ubuntu 24.04.",
	source: "#!/bin/bash\napt-get install -y curl",
	runCommand:
		"curl -fsSL https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/linux/ubuntu-24.04/install-curl.sh | bash",
};

const windowsScript: Script = {
	id: "windows/windows-11/setup-winget",
	title: "Setup winget",
	platform: "windows",
	os: "windows-11",
	body: "Sets up winget on Windows 11.",
	source: "# PowerShell\nwinget upgrade --all",
	runCommand:
		"irm https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/windows/windows-11/setup-winget.ps1 | iex",
};

const archScript: Script = {
	id: "linux/ubuntu-24.04/install-git",
	title: "Install git",
	platform: "linux",
	os: "ubuntu-24.04",
	arch: "x64",
	body: "Installs git for x64.",
	source: "#!/bin/bash\napt-get install -y git",
	runCommand:
		"curl -fsSL https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/linux/ubuntu-24.04/install-git.sh | bash",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function importPage() {
	const mod = await import("./page.js");
	return mod;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Detail page — /scripts/[...slug]", () => {
	it("renders the script title in an h1", async () => {
		const { loadScripts } = await import("../../../lib/loadScripts.js");
		vi.mocked(loadScripts).mockResolvedValue([linuxScript]);

		const { default: Page } = await importPage();

		await act(async () => {
			render(
				await Page({
					params: Promise.resolve({
						slug: ["linux", "ubuntu-24.04", "install-curl"],
					}),
				}),
			);
		});

		expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
		expect(screen.getByText("Install curl")).toBeTruthy();
	});

	it("renders platform and OS metadata", async () => {
		const { loadScripts } = await import("../../../lib/loadScripts.js");
		vi.mocked(loadScripts).mockResolvedValue([linuxScript]);

		const { default: Page } = await importPage();

		await act(async () => {
			render(
				await Page({
					params: Promise.resolve({
						slug: ["linux", "ubuntu-24.04", "install-curl"],
					}),
				}),
			);
		});

		expect(screen.getByText("linux")).toBeTruthy();
		expect(screen.getByText("ubuntu-24.04")).toBeTruthy();
	});

	it("renders arch metadata when present", async () => {
		const { loadScripts } = await import("../../../lib/loadScripts.js");
		vi.mocked(loadScripts).mockResolvedValue([archScript]);

		const { default: Page } = await importPage();

		await act(async () => {
			render(
				await Page({
					params: Promise.resolve({
						slug: ["linux", "ubuntu-24.04", "install-git"],
					}),
				}),
			);
		});

		expect(screen.getByText("x64")).toBeTruthy();
	});

	it("renders the spec body as markdown", async () => {
		const { loadScripts } = await import("../../../lib/loadScripts.js");
		vi.mocked(loadScripts).mockResolvedValue([linuxScript]);

		const { default: Page } = await importPage();

		await act(async () => {
			render(
				await Page({
					params: Promise.resolve({
						slug: ["linux", "ubuntu-24.04", "install-curl"],
					}),
				}),
			);
		});

		expect(screen.getByText("Installs curl on Ubuntu 24.04.")).toBeTruthy();
	});

	it("renders the script source in a code block", async () => {
		const { loadScripts } = await import("../../../lib/loadScripts.js");
		vi.mocked(loadScripts).mockResolvedValue([linuxScript]);

		const { default: Page } = await importPage();

		await act(async () => {
			render(
				await Page({
					params: Promise.resolve({
						slug: ["linux", "ubuntu-24.04", "install-curl"],
					}),
				}),
			);
		});

		expect(screen.getByText(/apt-get install -y curl/)).toBeTruthy();
	});

	it("renders the run command", async () => {
		const { loadScripts } = await import("../../../lib/loadScripts.js");
		vi.mocked(loadScripts).mockResolvedValue([linuxScript]);

		const { default: Page } = await importPage();

		await act(async () => {
			render(
				await Page({
					params: Promise.resolve({
						slug: ["linux", "ubuntu-24.04", "install-curl"],
					}),
				}),
			);
		});

		expect(
			screen.getByText(/curl -fsSL.*install-curl\.sh \| bash/),
		).toBeTruthy();
	});

	it("renders a CopyButton for the run command", async () => {
		const { loadScripts } = await import("../../../lib/loadScripts.js");
		vi.mocked(loadScripts).mockResolvedValue([linuxScript]);

		const { default: Page } = await importPage();

		await act(async () => {
			render(
				await Page({
					params: Promise.resolve({
						slug: ["linux", "ubuntu-24.04", "install-curl"],
					}),
				}),
			);
		});

		expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
	});

	it("renders windows run command for windows scripts", async () => {
		const { loadScripts } = await import("../../../lib/loadScripts.js");
		vi.mocked(loadScripts).mockResolvedValue([windowsScript]);

		const { default: Page } = await importPage();

		await act(async () => {
			render(
				await Page({
					params: Promise.resolve({
						slug: ["windows", "windows-11", "setup-winget"],
					}),
				}),
			);
		});

		expect(screen.getByText(/irm.*setup-winget\.ps1 \| iex/)).toBeTruthy();
	});

	it("calls notFound() for an unknown slug", async () => {
		const { loadScripts } = await import("../../../lib/loadScripts.js");
		vi.mocked(loadScripts).mockResolvedValue([linuxScript]);

		const { default: Page } = await importPage();

		await expect(
			Page({
				params: Promise.resolve({
					slug: ["linux", "ubuntu-24.04", "nonexistent"],
				}),
			}),
		).rejects.toThrow("NEXT_NOT_FOUND");
	});
});
