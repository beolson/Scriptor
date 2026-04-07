import { describe, expect, it } from "vitest";
import { PLATFORMS } from "./platforms.js";

describe("PLATFORMS", () => {
	it("has entries for all three platforms", () => {
		expect(PLATFORMS).toHaveProperty("linux");
		expect(PLATFORMS).toHaveProperty("windows");
		expect(PLATFORMS).toHaveProperty("mac");
	});

	it("linux has a non-empty label and osValues", () => {
		expect(PLATFORMS.linux.label).toBeTruthy();
		expect(PLATFORMS.linux.osValues.length).toBeGreaterThan(0);
	});

	it("windows has a non-empty label and osValues", () => {
		expect(PLATFORMS.windows.label).toBeTruthy();
		expect(PLATFORMS.windows.osValues.length).toBeGreaterThan(0);
	});

	it("mac has a non-empty label and osValues", () => {
		expect(PLATFORMS.mac.label).toBeTruthy();
		expect(PLATFORMS.mac.osValues.length).toBeGreaterThan(0);
	});

	it("linux osValues includes ubuntu-24.04", () => {
		expect(PLATFORMS.linux.osValues).toContain("ubuntu-24.04");
	});

	it("linux osValues includes ubuntu-22.04", () => {
		expect(PLATFORMS.linux.osValues).toContain("ubuntu-22.04");
	});

	it("linux osValues includes debian-12", () => {
		expect(PLATFORMS.linux.osValues).toContain("debian-12");
	});

	it("linux osValues includes fedora-40", () => {
		expect(PLATFORMS.linux.osValues).toContain("fedora-40");
	});

	it("linux osValues includes arch", () => {
		expect(PLATFORMS.linux.osValues).toContain("arch");
	});

	it("windows osValues includes windows-11", () => {
		expect(PLATFORMS.windows.osValues).toContain("windows-11");
	});

	it("windows osValues includes windows-10", () => {
		expect(PLATFORMS.windows.osValues).toContain("windows-10");
	});

	it("mac osValues includes macos-sequoia", () => {
		expect(PLATFORMS.mac.osValues).toContain("macos-sequoia");
	});

	it("mac osValues includes macos-sonoma", () => {
		expect(PLATFORMS.mac.osValues).toContain("macos-sonoma");
	});

	it("mac osValues includes macos-ventura", () => {
		expect(PLATFORMS.mac.osValues).toContain("macos-ventura");
	});
});
