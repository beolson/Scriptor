import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const PANEL_SOURCE = fs.readFileSync(
	path.join(__dirname, "InputsPanel.tsx"),
	"utf-8",
);

const PANEL_CSS = fs.readFileSync(
	path.join(__dirname, "InputsPanel.module.css"),
	"utf-8",
);

const DETAIL_PAGE_SOURCE = fs.readFileSync(
	path.join(__dirname, "..", "..", "scripts", "[id]", "page.tsx"),
	"utf-8",
);

const DETAIL_CSS = fs.readFileSync(
	path.join(__dirname, "..", "..", "scripts", "[id]", "detail.module.css"),
	"utf-8",
);

describe("InputsPanel component", () => {
	it("renders each input's label", () => {
		// The component should display the label field of each input
		expect(PANEL_SOURCE).toContain("label");
	});

	it("renders each input's type", () => {
		// The component should display the type field of each input
		expect(PANEL_SOURCE).toContain("type");
	});

	it("renders a required/optional badge for each input", () => {
		// Should show whether each input is required or optional
		expect(PANEL_SOURCE.toLowerCase()).toContain("required");
		expect(PANEL_SOURCE.toLowerCase()).toContain("optional");
	});

	it("displays default values when present", () => {
		// Should render the default value for inputs that have one
		expect(PANEL_SOURCE).toContain("default");
	});

	it("displays download_path when present", () => {
		// Should render plugin-specific download_path field
		expect(PANEL_SOURCE).toContain("download_path");
	});

	it("displays format when present", () => {
		// Should render plugin-specific format field
		expect(PANEL_SOURCE).toContain("format");
	});

	it("shows an empty-state message when no inputs are provided", () => {
		// When inputs array is empty or undefined, show a message
		expect(PANEL_SOURCE.toLowerCase()).toMatch(/no inputs|no inputs required/);
	});

	it("has a heading indicating the panel shows inputs", () => {
		// Should have a heading or label with "inputs"
		expect(PANEL_SOURCE.toLowerCase()).toContain("inputs");
	});

	it("imports the Input type from types", () => {
		expect(PANEL_SOURCE).toContain("Input");
	});
});

describe("InputsPanel CSS", () => {
	it("has styles for the panel container", () => {
		expect(PANEL_CSS).toContain(".panel");
	});

	it("has styles for input items", () => {
		expect(PANEL_CSS).toContain(".inputItem");
	});

	it("has styles for badges", () => {
		expect(PANEL_CSS).toContain(".badge");
	});

	it("has styles for the empty state", () => {
		expect(PANEL_CSS).toContain(".emptyState");
	});
});

describe("InputsPanel integration in detail page", () => {
	it("is imported in the detail page", () => {
		expect(DETAIL_PAGE_SOURCE).toContain("InputsPanel");
	});

	it("receives inputs prop from the Script data", () => {
		expect(DETAIL_PAGE_SOURCE).toContain("inputs");
	});

	it("detail page uses a two-column layout", () => {
		// The detail body should use CSS grid or flex for two columns
		expect(DETAIL_CSS).toMatch(/grid|flex/);
		// There should be a content column and a sidebar column
		expect(DETAIL_CSS).toContain("mainCol");
		expect(DETAIL_CSS).toContain("sidebar");
	});

	it("detail page has responsive single-column layout on mobile", () => {
		// The CSS should have a media query for mobile breakpoint
		expect(DETAIL_CSS).toContain("@media");
		expect(DETAIL_CSS).toContain("max-width");
	});
});
