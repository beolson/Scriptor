import { describe, expect, it } from "bun:test";
import type {
	CollectedInput,
	PreExecutionResult,
	ScriptInputs,
} from "./types.js";
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

// ---------------------------------------------------------------------------
// CollectedInput
// ---------------------------------------------------------------------------

describe("CollectedInput", () => {
	it("is valid with only value (no certCN)", () => {
		const input: CollectedInput = { value: "hello" };
		expect(input.value).toBe("hello");
		expect(input.certCN).toBeUndefined();
	});

	it("is valid with both value and certCN", () => {
		const input: CollectedInput = {
			value: "/path/to/cert.pem",
			certCN: "my.domain.com",
		};
		expect(input.value).toBe("/path/to/cert.pem");
		expect(input.certCN).toBe("my.domain.com");
	});
});

// ---------------------------------------------------------------------------
// ScriptInputs
// ---------------------------------------------------------------------------

describe("ScriptInputs", () => {
	it("is assignable as Map<string, CollectedInput>", () => {
		const inputs: ScriptInputs = new Map<string, CollectedInput>();
		inputs.set("my-input", { value: "test" });
		expect(inputs.get("my-input")?.value).toBe("test");
	});

	it("stores and retrieves CollectedInput with certCN", () => {
		const inputs: ScriptInputs = new Map<string, CollectedInput>();
		inputs.set("cert-input", { value: "/tmp/cert.pem", certCN: "example.com" });
		expect(inputs.get("cert-input")?.certCN).toBe("example.com");
	});
});

// ---------------------------------------------------------------------------
// PreExecutionResult
// ---------------------------------------------------------------------------

describe("PreExecutionResult", () => {
	it("has orderedScripts array and inputs Map", () => {
		const result: PreExecutionResult = {
			orderedScripts: [],
			inputs: new Map<string, CollectedInput>(),
			installedIds: new Set<string>(),
		};
		expect(Array.isArray(result.orderedScripts)).toBe(true);
		expect(result.inputs).toBeInstanceOf(Map);
	});
});
