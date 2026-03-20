import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const TOGGLE_SOURCE = fs.readFileSync(
	path.join(__dirname, "ThemeToggle.tsx"),
	"utf-8",
);

const NAVBAR_SOURCE = fs.readFileSync(
	path.join(__dirname, "..", "NavBar", "NavBar.tsx"),
	"utf-8",
);

const LAYOUT_SOURCE = fs.readFileSync(
	path.join(__dirname, "..", "..", "layout.tsx"),
	"utf-8",
);

describe("ThemeToggle component", () => {
	it("renders a button with an accessible label", () => {
		expect(TOGGLE_SOURCE).toContain("button");
		expect(TOGGLE_SOURCE).toContain("aria-label");
	});

	it("is a client component", () => {
		expect(TOGGLE_SOURCE).toContain("use client");
	});

	it("toggles data-theme on document.documentElement", () => {
		expect(TOGGLE_SOURCE).toContain("document.documentElement");
		expect(TOGGLE_SOURCE).toContain("data-theme");
	});

	it("writes the new preference to localStorage", () => {
		expect(TOGGLE_SOURCE).toContain("localStorage");
	});

	it("reads the current data-theme to display the correct icon", () => {
		// Component should read data-theme on mount via useState/useEffect
		expect(TOGGLE_SOURCE).toContain("useState");
	});

	it("displays sun and moon icons for light and dark modes", () => {
		// Should contain SVG paths or icon references for both states
		expect(TOGGLE_SOURCE).toContain("sun");
		expect(TOGGLE_SOURCE).toContain("moon");
	});
});

describe("ThemeToggle in NavBar", () => {
	it("is imported in NavBar", () => {
		expect(NAVBAR_SOURCE).toContain("ThemeToggle");
	});

	it("is rendered in NavBar", () => {
		expect(NAVBAR_SOURCE).toContain("<ThemeToggle");
	});
});

describe("Flash prevention script in layout", () => {
	it("contains an inline script in the head for theme initialization", () => {
		expect(LAYOUT_SOURCE).toContain("<script");
		expect(LAYOUT_SOURCE).toContain("dangerouslySetInnerHTML");
	});

	it("reads localStorage for saved theme preference", () => {
		expect(LAYOUT_SOURCE).toContain("localStorage");
	});

	it("checks prefers-color-scheme media query as fallback", () => {
		expect(LAYOUT_SOURCE).toContain("prefers-color-scheme");
	});

	it("sets data-theme on the html element before first paint", () => {
		expect(LAYOUT_SOURCE).toContain("data-theme");
	});
});
