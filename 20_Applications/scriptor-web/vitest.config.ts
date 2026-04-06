import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react()],
	test: {
		environment: "jsdom",
		include: [
			"app/**/*.test.{ts,tsx}",
			"lib/**/*.test.{ts,tsx}",
			"components/**/*.test.{ts,tsx}",
		],
		globals: true,
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "."),
		},
	},
});
