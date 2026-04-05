import { expect, test } from "@playwright/test";

test("home page loads and renders a button", async ({ page }) => {
	await page.goto("/");
	const button = page.getByRole("button");
	await expect(button).toBeVisible();
});
