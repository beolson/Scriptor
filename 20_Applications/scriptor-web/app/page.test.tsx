import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/loadPlatforms", () => ({
	loadPlatforms: vi.fn().mockResolvedValue({
		"ubuntu-24.04-x64": {
			displayName: "Ubuntu 24.04 X64",
			installCommand: "$ curl -fsSL https://scriptor.dev/install.sh | sh",
			codeLabel: "// bash",
		},
		"macos-sequoia-arm64": {
			displayName: "MacOS Sequoia ARM64",
			installCommand: "$ curl -fsSL https://scriptor.dev/install.sh | sh",
			codeLabel: "// zsh",
		},
		"windows-11-x64": {
			displayName: "Windows 11 X64",
			installCommand: "$ irm https://scriptor.dev/install.ps1 | iex",
			codeLabel: "// powershell",
		},
	}),
}));

import Page from "./page.js";

describe("Homepage", () => {
	it("renders one card per platforms.json entry", async () => {
		const jsx = await Page();
		render(jsx);
		expect(screen.getByText("Ubuntu 24.04 X64")).toBeTruthy();
		expect(screen.getByText("MacOS Sequoia ARM64")).toBeTruthy();
		expect(screen.getByText("Windows 11 X64")).toBeTruthy();
	});

	it("links each card to /scripts/[platform-value]", async () => {
		const jsx = await Page();
		render(jsx);
		const ubuntuLink = screen.getByRole("link", { name: /ubuntu 24.04 x64/i });
		expect(ubuntuLink.getAttribute("href")).toBe("/scripts/ubuntu-24.04-x64");
		const macLink = screen.getByRole("link", { name: /macos sequoia arm64/i });
		expect(macLink.getAttribute("href")).toBe("/scripts/macos-sequoia-arm64");
		const winLink = screen.getByRole("link", { name: /windows 11 x64/i });
		expect(winLink.getAttribute("href")).toBe("/scripts/windows-11-x64");
	});

	it("does not render old hero or browse-by headings", async () => {
		const jsx = await Page();
		render(jsx);
		expect(screen.queryByText("> scriptor")).toBeNull();
		expect(screen.queryByText("// platforms")).toBeNull();
	});
});
