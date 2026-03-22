import { describe, expect, it } from "bun:test";
import { InvalidArgumentError } from "commander";
import { parseRepo, repoToString } from "./parseRepo.js";

describe("parseRepo", () => {
	it("parses a valid owner/repo string", () => {
		const repo = parseRepo("owner/repo");
		expect(repo.owner).toBe("owner");
		expect(repo.name).toBe("repo");
	});

	it("parses owner and repo with hyphens and numbers", () => {
		const repo = parseRepo("my-org/my-repo-123");
		expect(repo.owner).toBe("my-org");
		expect(repo.name).toBe("my-repo-123");
	});

	it("strips leading and trailing whitespace from input", () => {
		const repo = parseRepo("  owner/repo  ");
		expect(repo.owner).toBe("owner");
		expect(repo.name).toBe("repo");
	});

	it("throws InvalidArgumentError when there is no slash", () => {
		expect(() => parseRepo("ownerrepo")).toThrow(InvalidArgumentError);
	});

	it("throws InvalidArgumentError for extra slash (a/b/c)", () => {
		expect(() => parseRepo("a/b/c")).toThrow(InvalidArgumentError);
	});

	it("throws InvalidArgumentError when owner is empty", () => {
		expect(() => parseRepo("/repo")).toThrow(InvalidArgumentError);
	});

	it("throws InvalidArgumentError when repo name is empty", () => {
		expect(() => parseRepo("owner/")).toThrow(InvalidArgumentError);
	});

	it("throws InvalidArgumentError when owner is whitespace only", () => {
		expect(() => parseRepo("   /repo")).toThrow(InvalidArgumentError);
	});

	it("throws InvalidArgumentError when repo name is whitespace only", () => {
		expect(() => parseRepo("owner/   ")).toThrow(InvalidArgumentError);
	});

	it("throws InvalidArgumentError for empty string", () => {
		expect(() => parseRepo("")).toThrow(InvalidArgumentError);
	});
});

describe("repoToString", () => {
	it("returns owner/repo format", () => {
		const result = repoToString({ owner: "owner", name: "repo" });
		expect(result).toBe("owner/repo");
	});

	it("round-trips through parseRepo and repoToString", () => {
		const input = "my-org/my-repo";
		const result = repoToString(parseRepo(input));
		expect(result).toBe(input);
	});
});
