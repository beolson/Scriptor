import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
	await page.goto("/scripts/windows");
});

test("browse page loads and shows windows scripts", async ({ page }) => {
	await expect(page.getByText("Setup winget")).toBeVisible();
	await expect(page.getByText("Install Git")).toBeVisible();
	await expect(page.getByText("Install VS Code")).toBeVisible();
});

test("each script row shows its description", async ({ page }) => {
	await expect(
		page.getByText("Ensures the Windows Package Manager (winget) is up to date."),
	).toBeVisible();
});

test("clicking a script row navigates to the detail page", async ({ page }) => {
	await page.getByText("Setup winget").click();

	await expect(page).toHaveURL(
		/\/scripts\/windows\/windows-11-x64\/setup-winget/,
	);
	await expect(
		page.getByRole("heading", { name: /Setup winget/ }),
	).toBeVisible();
});
