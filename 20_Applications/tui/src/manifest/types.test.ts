import { describe, expect, it } from "bun:test";
import { CircularDependencyError, MissingDependencyError } from "./types.js";

// ---------------------------------------------------------------------------
// MissingDependencyError
// ---------------------------------------------------------------------------

describe("MissingDependencyError", () => {
	it("passes instanceof check", () => {
		const error = new MissingDependencyError("dep-id not available");
		expect(error).toBeInstanceOf(MissingDependencyError);
	});

	it("passes instanceof Error check", () => {
		const error = new MissingDependencyError("dep-id not available");
		expect(error).toBeInstanceOf(Error);
	});

	it("has name === 'MissingDependencyError'", () => {
		const error = new MissingDependencyError("dep-id not available");
		expect(error.name).toBe("MissingDependencyError");
	});

	it("preserves the message", () => {
		const msg =
			'Cannot select "my-script": dependency "dep-id" is not available for this host';
		const error = new MissingDependencyError(msg);
		expect(error.message).toBe(msg);
	});
});

// ---------------------------------------------------------------------------
// CircularDependencyError
// ---------------------------------------------------------------------------

describe("CircularDependencyError", () => {
	it("passes instanceof check", () => {
		const error = new CircularDependencyError("A → B → A");
		expect(error).toBeInstanceOf(CircularDependencyError);
	});

	it("passes instanceof Error check", () => {
		const error = new CircularDependencyError("A → B → A");
		expect(error).toBeInstanceOf(Error);
	});

	it("has name === 'CircularDependencyError'", () => {
		const error = new CircularDependencyError("A → B → A");
		expect(error.name).toBe("CircularDependencyError");
	});

	it("preserves the message", () => {
		const msg = "Circular dependency detected: A → B → A";
		const error = new CircularDependencyError(msg);
		expect(error.message).toBe(msg);
	});
});
