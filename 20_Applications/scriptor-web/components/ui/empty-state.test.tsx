import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./empty-state.js";

describe("EmptyState", () => {
	it("renders the default message when no message prop is provided", () => {
		render(<EmptyState />);
		expect(
			screen.getByText("No scripts found for this combination."),
		).toBeTruthy();
	});

	it("renders a custom message when provided", () => {
		render(<EmptyState message="Nothing here." />);
		expect(screen.getByText("Nothing here.")).toBeTruthy();
	});
});
