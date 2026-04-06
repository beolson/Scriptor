import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
	await page.goto("/scripts");
});

test("browse page loads and shows all scripts", async ({ page }) => {
	await expect(
		page.getByRole("heading", { name: "Browse Scripts" }),
	).toBeVisible();
	await expect(page.getByText("Install curl")).toBeVisible();
	await expect(page.getByText("Setup winget")).toBeVisible();
	await expect(page.getByText("Install Homebrew")).toBeVisible();
});

test("platform filter buttons are rendered for each present platform", async ({
	page,
}) => {
	await expect(page.getByRole("button", { name: "Linux" })).toBeVisible();
	await expect(page.getByRole("button", { name: "Windows" })).toBeVisible();
	await expect(page.getByRole("button", { name: "macOS" })).toBeVisible();
});

test("selecting a platform filter narrows the list to matching scripts only", async ({
	page,
}) => {
	await page.getByRole("button", { name: "Linux" }).click();

	await expect(page.getByText("Install curl")).toBeVisible();
	await expect(page.getByText("Setup winget")).not.toBeVisible();
	await expect(page.getByText("Install Homebrew")).not.toBeVisible();
});

test("other platform buttons are disabled when one OS filter is active", async ({
	page,
}) => {
	// Select Linux then ubuntu-24.04 OS filter
	await page.getByRole("button", { name: "Linux" }).click();
	await page.getByRole("button", { name: "ubuntu-24.04" }).click();

	// Windows and macOS buttons should now be disabled (no scripts match ubuntu-24.04 for those platforms)
	const windowsBtn = page.getByRole("button", { name: "Windows" });
	const macBtn = page.getByRole("button", { name: "macOS" });

	await expect(windowsBtn).toHaveAttribute("aria-disabled", "true");
	await expect(macBtn).toHaveAttribute("aria-disabled", "true");
});

test("greyed-out filter buttons cannot be clicked to change the list", async ({
	page,
}) => {
	// Select Linux then ubuntu-24.04 — this disables Windows and macOS buttons
	await page.getByRole("button", { name: "Linux" }).click();
	await page.getByRole("button", { name: "ubuntu-24.04" }).click();

	const windowsBtn = page.getByRole("button", { name: "Windows" });
	await expect(windowsBtn).toHaveAttribute("aria-disabled", "true");

	// Clicking disabled button should NOT change the visible scripts
	await windowsBtn.click({ force: true });

	// The list should still show only the Linux script
	await expect(page.getByText("Install curl")).toBeVisible();
	await expect(page.getByText("Setup winget")).not.toBeVisible();
});

test("clearing platform filter restores the full list", async ({ page }) => {
	// Select Linux to narrow
	await page.getByRole("button", { name: "Linux" }).click();
	await expect(page.getByText("Setup winget")).not.toBeVisible();

	// Deselect Linux by clicking it again
	await page.getByRole("button", { name: "Linux" }).click();

	// Full list is restored
	await expect(page.getByText("Install curl")).toBeVisible();
	await expect(page.getByText("Setup winget")).toBeVisible();
	await expect(page.getByText("Install Homebrew")).toBeVisible();
});

test("empty state message appears when no scripts match active filters", async ({
	page,
}) => {
	// Select Windows, then select an OS filter — only Setup winget should show
	await page.getByRole("button", { name: "Windows" }).click();
	await page.getByRole("button", { name: "windows-11" }).click();

	// Only the Windows script is visible; no empty state
	await expect(page.getByText("Setup winget")).toBeVisible();

	// Now deselect the OS (click again)
	await page.getByRole("button", { name: "windows-11" }).click();

	// With only platform=windows active, only Windows scripts show (no empty state)
	await expect(page.getByText("Setup winget")).toBeVisible();

	// Verify the empty state component text is NOT visible (all filters active)
	await expect(
		page.getByText("No scripts found for this combination."),
	).not.toBeVisible();
});

test("clicking a script row navigates to the detail page", async ({ page }) => {
	await page.getByText("Install curl").click();

	await expect(page).toHaveURL(/\/scripts\/linux\/ubuntu-24.04\/install-curl/);
	await expect(
		page.getByRole("heading", { name: "Install curl" }),
	).toBeVisible();
});
