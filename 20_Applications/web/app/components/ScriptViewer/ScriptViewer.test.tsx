import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const VIEWER_SOURCE = fs.readFileSync(
	path.join(__dirname, "ScriptViewer.tsx"),
	"utf-8",
);

const VIEWER_CSS = fs.readFileSync(
	path.join(__dirname, "ScriptViewer.module.css"),
	"utf-8",
);

const DETAIL_PAGE_SOURCE = fs.readFileSync(
	path.join(__dirname, "..", "..", "scripts", "[id]", "page.tsx"),
	"utf-8",
);

describe("ScriptViewer component", () => {
	it("is a client component", () => {
		expect(VIEWER_SOURCE).toContain("use client");
	});

	it("renders a collapsible section that is collapsed by default", () => {
		// Should use state to track expanded/collapsed, defaulting to collapsed
		expect(VIEWER_SOURCE).toContain("useState");
		// Default state should be false (collapsed)
		expect(VIEWER_SOURCE).toMatch(/useState\s*\(\s*false\s*\)/);
	});

	it("renders script source code in a <pre><code> block when expanded", () => {
		expect(VIEWER_SOURCE).toContain("<pre");
		expect(VIEWER_SOURCE).toContain("<code");
	});

	it("has a section title indicating it shows the script", () => {
		// Should contain a label or heading referencing "script"
		expect(VIEWER_SOURCE.toLowerCase()).toContain("script");
	});

	it("does not render when scriptSource is empty or undefined", () => {
		// Should have a guard that returns null when there is no source
		expect(VIEWER_SOURCE).toContain("return null");
	});

	it("uses highlight.js for syntax highlighting", () => {
		expect(VIEWER_SOURCE).toContain("hljs");
	});

	it("determines language from file extension", () => {
		// Should map extensions to languages
		expect(VIEWER_SOURCE).toContain(".sh");
		expect(VIEWER_SOURCE).toContain("bash");
		expect(VIEWER_SOURCE).toContain(".ps1");
		expect(VIEWER_SOURCE).toContain("powershell");
	});

	it("has a toggle button/header to expand and collapse", () => {
		expect(VIEWER_SOURCE).toContain("onClick");
	});
});

describe("ScriptViewer CSS", () => {
	it("has max-height and overflow-y for scrolling long scripts", () => {
		expect(VIEWER_CSS).toContain("max-height");
		expect(VIEWER_CSS).toContain("overflow-y");
	});
});

describe("ScriptViewer integration in detail page", () => {
	it("is imported in the detail page", () => {
		expect(DETAIL_PAGE_SOURCE).toContain("ScriptViewer");
	});

	it("receives scriptSource prop from the Script data", () => {
		expect(DETAIL_PAGE_SOURCE).toContain("scriptSource");
	});
});
