import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Page from "./page.js";

describe("Page", () => {
	it("renders without throwing", () => {
		const { container } = render(<Page />);
		expect(container).toBeTruthy();
	});

	it("renders a button element", () => {
		render(<Page />);
		const button = screen.getByRole("button");
		expect(button).toBeTruthy();
	});
});
