import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FilterButton } from "./filter-button.js";

describe("FilterButton", () => {
	it("renders the label text", () => {
		render(
			<FilterButton
				label="Linux"
				active={false}
				disabled={false}
				onClick={() => {}}
			/>,
		);
		expect(screen.getByText("Linux")).toBeTruthy();
	});

	it("applies active variant when active=true", () => {
		render(
			<FilterButton
				label="Windows"
				active={true}
				disabled={false}
				onClick={() => {}}
			/>,
		);
		const btn = screen.getByRole("button");
		expect(btn.getAttribute("data-active")).toBe("true");
	});

	it("does not fire onClick when disabled=true", () => {
		const handleClick = vi.fn();
		render(
			<FilterButton
				label="macOS"
				active={false}
				disabled={true}
				onClick={handleClick}
			/>,
		);
		const btn = screen.getByRole("button");
		fireEvent.click(btn);
		expect(handleClick).not.toHaveBeenCalled();
	});

	it("fires onClick when not disabled", () => {
		const handleClick = vi.fn();
		render(
			<FilterButton
				label="Linux"
				active={false}
				disabled={false}
				onClick={handleClick}
			/>,
		);
		const btn = screen.getByRole("button");
		fireEvent.click(btn);
		expect(handleClick).toHaveBeenCalledTimes(1);
	});

	it("sets aria-disabled when disabled=true", () => {
		render(
			<FilterButton
				label="macOS"
				active={false}
				disabled={true}
				onClick={() => {}}
			/>,
		);
		const btn = screen.getByRole("button");
		expect(btn.getAttribute("aria-disabled")).toBe("true");
	});

	it("does not set aria-disabled when not disabled", () => {
		render(
			<FilterButton
				label="Linux"
				active={false}
				disabled={false}
				onClick={() => {}}
			/>,
		);
		const btn = screen.getByRole("button");
		expect(btn.getAttribute("aria-disabled")).toBeNull();
	});
});
