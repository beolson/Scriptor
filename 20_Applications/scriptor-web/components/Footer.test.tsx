import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Footer } from "./Footer.js";

describe("Footer", () => {
	it("renders the tagline", () => {
		render(<Footer />);
		expect(screen.getByText(/scriptor/)).toBeTruthy();
	});

	it("renders the GitHub link", () => {
		render(<Footer />);
		const link = screen.getByRole("link", { name: /github/i });
		expect(link).toBeTruthy();
		expect((link as HTMLAnchorElement).href).toContain("github.com");
	});

	it("renders version string with v prefix when version prop is provided", () => {
		render(<Footer version="1.2.3" />);
		expect(screen.getByText("v1.2.3")).toBeTruthy();
	});

	it("does not render any version element when version prop is undefined", () => {
		render(<Footer />);
		expect(screen.queryByText(/^v\d/)).toBeNull();
	});

	it("does not render any version element when version prop is explicitly undefined", () => {
		render(<Footer version={undefined} />);
		expect(screen.queryByText(/^v\d/)).toBeNull();
	});

	it("renders footer content (tagline and GitHub link) regardless of version prop", () => {
		render(<Footer version="2.0.0" />);
		expect(screen.getByText(/scriptor/)).toBeTruthy();
		expect(screen.getByRole("link", { name: /github/i })).toBeTruthy();
		expect(screen.getByText("v2.0.0")).toBeTruthy();
	});
});
