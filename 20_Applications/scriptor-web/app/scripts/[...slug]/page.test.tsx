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
	id: "linux/ubuntu-24.04-x64/install-curl",
	title: "Install curl",
	description: "Installs curl on Ubuntu.",
	platform: "ubuntu-24.04-x64",
	body: "Installs curl on Ubuntu 24.04 x64.",
	source: "#!/bin/bash\napt-get install -y curl",
	runCommand:
		"curl -fsSL https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/linux/ubuntu-24.04-x64/install-curl.sh | bash",
};

const windowsScript: Script = {
	id: "windows/windows-11-x64/setup-winget",
	title: "Setup winget",
	description: "Ensures winget is up to date.",
	platform: "windows-11-x64",
	body: "Sets up winget on Windows 11 x64.",
	source: "# PowerShell\nwinget upgrade --all",
	runCommand:
		"irm https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/windows/windows-11-x64/setup-winget.ps1 | iex",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function importPage() {
	const mod = await import("./page.js");
	return mod;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Detail page — /scripts/[...slug]", () => {
	it("renders > {script title} in an h1", async () => {
		const { loadScripts } = await import("../../../lib/loadScripts.js");
		vi.mocked(loadScripts).mockResolvedValue([linuxScript]);

		const { default: Page } = await importPage();

		await act(async () => {
			render(
				await Page({
					params: Promise.resolve({
						slug: ["linux", "ubuntu-24.04-x64", "install-curl"],
					}),
				}),
			);
		});

		expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
		expect(screen.getByText(/>\s*Install curl/)).toBeTruthy();
	});

	it("renders the target in the metadata sidebar", async () => {
		const { loadScripts } = await import("../../../lib/loadScripts.js");
		vi.mocked(loadScripts).mockResolvedValue([linuxScript]);

		const { default: Page } = await importPage();

		await act(async () => {
			render(
				await Page({
					params: Promise.resolve({
						slug: ["linux", "ubuntu-24.04-x64", "install-curl"],
					}),
				}),
			);
		});

		expect(screen.getByText("ubuntu-24.04-x64")).toBeTruthy();
	});

	it("renders the spec body as markdown", async () => {
		const { loadScripts } = await import("../../../lib/loadScripts.js");
		vi.mocked(loadScripts).mockResolvedValue([linuxScript]);

		const { default: Page } = await importPage();

		await act(async () => {
			render(
				await Page({
					params: Promise.resolve({
						slug: ["linux", "ubuntu-24.04-x64", "install-curl"],
					}),
				}),
			);
		});

		expect(screen.getByText("Installs curl on Ubuntu 24.04 x64.")).toBeTruthy();
	});

	it("renders the script source in a code block", async () => {
		const { loadScripts } = await import("../../../lib/loadScripts.js");
		vi.mocked(loadScripts).mockResolvedValue([linuxScript]);

		const { default: Page } = await importPage();

		await act(async () => {
			render(
				await Page({
					params: Promise.resolve({
						slug: ["linux", "ubuntu-24.04-x64", "install-curl"],
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
						slug: ["linux", "ubuntu-24.04-x64", "install-curl"],
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
						slug: ["linux", "ubuntu-24.04-x64", "install-curl"],
					}),
				}),
			);
		});

		expect(screen.getByRole("button", { name: "[copy]" })).toBeTruthy();
	});

	it("renders windows target in the metadata sidebar", async () => {
		const { loadScripts } = await import("../../../lib/loadScripts.js");
		vi.mocked(loadScripts).mockResolvedValue([windowsScript]);

		const { default: Page } = await importPage();

		await act(async () => {
			render(
				await Page({
					params: Promise.resolve({
						slug: ["windows", "windows-11-x64", "setup-winget"],
					}),
				}),
			);
		});

		expect(screen.getByText("windows-11-x64")).toBeTruthy();
	});

	it("calls notFound() for an unknown slug", async () => {
		const { loadScripts } = await import("../../../lib/loadScripts.js");
		vi.mocked(loadScripts).mockResolvedValue([linuxScript]);

		const { default: Page } = await importPage();

		await expect(
			Page({
				params: Promise.resolve({
					slug: ["linux", "ubuntu-24.04-x64", "nonexistent"],
				}),
			}),
		).rejects.toThrow("NEXT_NOT_FOUND");
	});
});
