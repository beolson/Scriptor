import { describe, expect, it } from "bun:test";
import {
	CACHE_DIR,
	CONFIG_PATH,
	DEFAULT_REPO,
	KEYCHAIN_ACCOUNT,
	KEYCHAIN_SERVICE,
	SCRIPTOR_DIR,
} from "./config.js";

describe("app-level constants", () => {
	it("DEFAULT_REPO equals 'beolson/Scriptor'", () => {
		expect(DEFAULT_REPO).toBe("beolson/Scriptor");
	});

	it("KEYCHAIN_SERVICE equals 'scriptor'", () => {
		expect(KEYCHAIN_SERVICE).toBe("scriptor");
	});

	it("KEYCHAIN_ACCOUNT equals 'github-token'", () => {
		expect(KEYCHAIN_ACCOUNT).toBe("github-token");
	});

	it("SCRIPTOR_DIR is a string containing '/.scriptor'", () => {
		expect(typeof SCRIPTOR_DIR).toBe("string");
		expect(SCRIPTOR_DIR).toContain("/.scriptor");
	});

	it("CACHE_DIR starts with SCRIPTOR_DIR", () => {
		expect(CACHE_DIR.startsWith(SCRIPTOR_DIR)).toBe(true);
	});

	it("CONFIG_PATH starts with SCRIPTOR_DIR", () => {
		expect(CONFIG_PATH.startsWith(SCRIPTOR_DIR)).toBe(true);
	});
});
