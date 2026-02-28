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

	it("returns null for repo when only unrelated flags are present", () => {
		const result = parseCli(["--verbose"]);
		expect(result.repo).toBeNull();
	});

	it("throws a descriptive error when --repo value is missing a slash", () => {
		expect(() => parseCli(["--repo", "noslash"])).toThrow(
			'Invalid --repo value "noslash": expected format owner/repo',
		);
	});

	it("throws a descriptive error when --repo value is an empty string", () => {
		expect(() => parseCli(["--repo", ""])).toThrow(
			'Invalid --repo value "": expected format owner/repo',
		);
	});

	it("throws a descriptive error when --repo value starts with a slash", () => {
		expect(() => parseCli(["--repo", "/repo"])).toThrow(
			'Invalid --repo value "/repo": expected format owner/repo',
		);
	});

	it("throws a descriptive error when --repo value ends with a slash", () => {
		expect(() => parseCli(["--repo", "owner/"])).toThrow(
			'Invalid --repo value "owner/": expected format owner/repo',
		);
	});

	it("throws a descriptive error when --repo flag has no following value", () => {
		expect(() => parseCli(["--repo"])).toThrow(
			"--repo requires a value in the format owner/repo",
		);
	});

	it("throws a descriptive error when --repo value looks like another flag", () => {
		expect(() => parseCli(["--repo", "--other"])).toThrow(
			"--repo requires a value in the format owner/repo",
		);
	});
});
