import { describe, expect, it } from "bun:test";
import { parseCli } from "./parseCli";

describe("parseCli", () => {
	it("parses --repo owner/repo and returns the string", () => {
		const result = parseCli(["--repo", "owner/repo"]);
		expect(result.repo).toBe("owner/repo");
	});

	it("parses --repo with a realistic slug", () => {
		const result = parseCli(["--repo", "my-org/my-scripts"]);
		expect(result.repo).toBe("my-org/my-scripts");
	});

	it("returns null for repo when --repo is absent", () => {
		const result = parseCli([]);
		expect(result.repo).toBeNull();
	});

	it("throws on unknown flags", () => {
		expect(() => parseCli(["--verbose"])).toThrow();
	});

	it("throws a descriptive error when --repo value is missing a slash", () => {
		expect(() => parseCli(["--repo", "noslash"])).toThrow(
			"Expected format owner/repo",
		);
	});

	it("throws a descriptive error when --repo value is an empty string", () => {
		expect(() => parseCli(["--repo", ""])).toThrow(
			"Expected format owner/repo",
		);
	});

	it("throws a descriptive error when --repo value starts with a slash", () => {
		expect(() => parseCli(["--repo", "/repo"])).toThrow(
			"Expected format owner/repo",
		);
	});

	it("throws a descriptive error when --repo value ends with a slash", () => {
		expect(() => parseCli(["--repo", "owner/"])).toThrow(
			"Expected format owner/repo",
		);
	});

	it("throws when --repo flag has no following value", () => {
		expect(() => parseCli(["--repo"])).toThrow();
	});

	it("throws when --repo value looks like another flag", () => {
		expect(() => parseCli(["--repo", "--other"])).toThrow(
			"Expected format owner/repo",
		);
	});
});
