import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CopyButton } from "./copy-button.js";

describe("CopyButton", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		Object.assign(navigator, {
			clipboard: {
				writeText: vi.fn().mockResolvedValue(undefined),
			},
		});
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('renders with default label "Copy"', () => {
		render(<CopyButton text="some text" />);
		expect(screen.getByRole("button").textContent).toBe("Copy");
	});

	it("renders with custom label when provided", () => {
		render(<CopyButton text="some text" label="Copy command" />);
		expect(screen.getByRole("button").textContent).toBe("Copy command");
	});

	it('shows "Copied!" immediately after click', async () => {
		render(<CopyButton text="hello world" />);
		await act(async () => {
			fireEvent.click(screen.getByRole("button"));
		});
		expect(screen.getByRole("button").textContent).toBe("Copied!");
	});

	it("reverts to original label after 1500 ms", async () => {
		render(<CopyButton text="hello world" />);
		await act(async () => {
			fireEvent.click(screen.getByRole("button"));
		});
		expect(screen.getByRole("button").textContent).toBe("Copied!");
		act(() => {
			vi.advanceTimersByTime(1500);
		});
		expect(screen.getByRole("button").textContent).toBe("Copy");
	});

	it("calls clipboard.writeText with the correct text", async () => {
		render(<CopyButton text="my run command" />);
		await act(async () => {
			fireEvent.click(screen.getByRole("button"));
		});
		expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
			"my run command",
		);
	});
});
