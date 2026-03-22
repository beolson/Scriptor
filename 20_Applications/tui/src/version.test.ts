import { describe, expect, it } from "bun:test";

declare const VERSION: string;

describe("VERSION", () => {
	it("is defined and non-empty", () => {
		expect(VERSION).toBeDefined();
		expect(typeof VERSION).toBe("string");
		expect(VERSION.length).toBeGreaterThan(0);
	});

	it("matches semver format", () => {
		expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
	});
});
