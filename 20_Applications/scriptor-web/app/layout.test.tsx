import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/loadVersion", () => ({
	loadVersion: vi.fn(),
}));

// next/font/google is not available in the test environment
vi.mock("next/font/google", () => ({
	IBM_Plex_Mono: () => ({ variable: "--font-ibmplex" }),
	JetBrains_Mono: () => ({ variable: "--font-jetbrains" }),
}));

import RootLayout from "./layout.js";

describe("RootLayout", () => {
	it("passes version string to Footer when loadVersion resolves", async () => {
		const { loadVersion } = await import("@/lib/loadVersion");
		vi.mocked(loadVersion).mockResolvedValue("1.2.3");

		await act(async () => {
			render(await RootLayout({ children: <div>content</div> }));
		});

		expect(screen.getByText("v1.2.3")).toBeTruthy();
	});

	it("renders Footer without version when loadVersion returns undefined", async () => {
		const { loadVersion } = await import("@/lib/loadVersion");
		vi.mocked(loadVersion).mockResolvedValue(undefined);

		await act(async () => {
			render(await RootLayout({ children: <div>content</div> }));
		});

		expect(screen.queryByText(/^v\d/)).toBeNull();
	});

	it("renders children inside the layout", async () => {
		const { loadVersion } = await import("@/lib/loadVersion");
		vi.mocked(loadVersion).mockResolvedValue("1.0.0");

		await act(async () => {
			render(await RootLayout({ children: <div>test content</div> }));
		});

		expect(screen.getByText("test content")).toBeTruthy();
	});
});
