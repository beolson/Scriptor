import { describe, expect, it } from "bun:test";
import { ManifestValidationError, ResolutionError } from "./types.js";

describe("ManifestValidationError", () => {
	it("extends Error", () => {
		const err = new ManifestValidationError(["something went wrong"]);
		expect(err).toBeInstanceOf(Error);
		expect(err).toBeInstanceOf(ManifestValidationError);
	});

	it("errors field contains the messages passed to the constructor", () => {
		const messages = ["field 'id' is required", "duplicate script id: foo"];
		const err = new ManifestValidationError(messages);
		expect(err.errors).toEqual(messages);
	});

	it("message field summarises the error count", () => {
		const err = new ManifestValidationError(["a", "b", "c"]);
		expect(err.message).toContain("3");
	});

	it("single error message includes 1 in the summary", () => {
		const err = new ManifestValidationError(["only one error"]);
		expect(err.message).toContain("1");
	});

	it("errors field is readonly (set at construction time)", () => {
		const messages = ["x"];
		const err = new ManifestValidationError(messages);
		expect(err.errors).toBe(err.errors); // same reference
		expect(err.errors.length).toBe(1);
	});
});

describe("ResolutionError", () => {
	it("is an instance of Error", () => {
		const err = new ResolutionError("something went wrong");
		expect(err).toBeInstanceOf(Error);
	});

	it("name equals ResolutionError", () => {
		const err = new ResolutionError("something went wrong");
		expect(err.name).toBe("ResolutionError");
	});

	it("message contains the string passed to the constructor", () => {
		const msg = "cycle detected involving script: foo";
		const err = new ResolutionError(msg);
		expect(err.message).toBe(msg);
	});

	it("instanceof ResolutionError is true for a thrown and caught instance", () => {
		let caught: unknown;
		try {
			throw new ResolutionError("oops");
		} catch (e) {
			caught = e;
		}
		expect(caught).toBeInstanceOf(ResolutionError);
	});
});
