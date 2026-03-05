import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./playwright",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: "list",
	use: {
		baseURL: process.env.GITHUB_ACTIONS
			? "http://localhost:3000/Scriptor"
			: "http://localhost:3000",
		trace: "on-first-retry",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
	webServer: {
		command: "bunx serve out/ -p 3000",
		url: "http://localhost:3000",
		reuseExistingServer: !process.env.CI,
	},
});
