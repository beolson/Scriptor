// ---------------------------------------------------------------------------
// resolveDependencies Tests
//
// TDD: tests written before implementation (RED phase).
// Pure function — no side effects, no injectable deps.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "bun:test";
import type { Manifest, ScriptEntry } from "./types.js";
import { CircularDependencyError, MissingDependencyError } from "./types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal ScriptEntry. */
function entry(
	overrides: Partial<ScriptEntry> & Pick<ScriptEntry, "id">,
): ScriptEntry {
	const { id } = overrides;
	return {
		name: id,
		description: "A script",
		platform: "linux",
		arch: "x86",
		script: `scripts/Debian/13/${id}.sh`,
		distro: "Debian GNU/Linux",
		version: "13",
		dependencies: [],
		optional_dependencies: [],
		requires_elevation: false,
		inputs: [],
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Lazy import helper — only imported after RED phase confirms tests fail
// ---------------------------------------------------------------------------

async function getResolveDependencies() {
	const { resolveDependencies } = await import("./resolveDependencies.js");
	return resolveDependencies;
}

// ---------------------------------------------------------------------------
// Basic cases
// ---------------------------------------------------------------------------

describe("resolveDependencies — basic", () => {
	it("returns a single script with no dependencies", async () => {
		const resolveDependencies = await getResolveDependencies();
		const available: Manifest = [entry({ id: "alpha" })];

		const result = resolveDependencies(["alpha"], available);

		expect(result).toEqual(["alpha"]);
	});

	it("places dependency B before dependent A (A depends on B)", async () => {
		const resolveDependencies = await getResolveDependencies();
		const available: Manifest = [
			entry({ id: "alpha", dependencies: ["beta"] }),
			entry({ id: "beta" }),
		];

		const result = resolveDependencies(["alpha"], available);

		const indexA = result.indexOf("alpha");
		const indexB = result.indexOf("beta");
		expect(indexB).toBeLessThan(indexA);
		expect(result).toHaveLength(2);
	});

	it("pulls in a transitive dependency not explicitly selected", async () => {
		const resolveDependencies = await getResolveDependencies();
		const available: Manifest = [
			entry({ id: "alpha", dependencies: ["beta"] }),
			entry({ id: "beta", dependencies: ["gamma"] }),
			entry({ id: "gamma" }),
		];

		const result = resolveDependencies(["alpha"], available);

		expect(result).toContain("gamma");
		expect(result).toContain("beta");
		expect(result).toContain("alpha");
		expect(result.indexOf("gamma")).toBeLessThan(result.indexOf("beta"));
		expect(result.indexOf("beta")).toBeLessThan(result.indexOf("alpha"));
	});

	it("contains no duplicate IDs in the output", async () => {
		const resolveDependencies = await getResolveDependencies();
		const available: Manifest = [
			entry({ id: "alpha", dependencies: ["gamma"] }),
			entry({ id: "beta", dependencies: ["gamma"] }),
			entry({ id: "gamma" }),
		];

		const result = resolveDependencies(["alpha", "beta"], available);

		const unique = new Set(result);
		expect(unique.size).toBe(result.length);
	});

	it("includes all selected IDs in the output", async () => {
		const resolveDependencies = await getResolveDependencies();
		const available: Manifest = [
			entry({ id: "alpha" }),
			entry({ id: "beta" }),
			entry({ id: "gamma" }),
		];

		const result = resolveDependencies(["alpha", "beta", "gamma"], available);

		expect(result).toContain("alpha");
		expect(result).toContain("beta");
		expect(result).toContain("gamma");
	});
});

// ---------------------------------------------------------------------------
// Soft (optional) dependencies
// ---------------------------------------------------------------------------

describe("resolveDependencies — optional_dependencies", () => {
	it("applies a soft edge when the optional dep is in the run set", async () => {
		const resolveDependencies = await getResolveDependencies();
		const available: Manifest = [
			entry({ id: "alpha", optional_dependencies: ["beta"] }),
			entry({ id: "beta" }),
		];

		// Both alpha and beta selected — soft edge should order beta before alpha.
		const result = resolveDependencies(["alpha", "beta"], available);

		expect(result.indexOf("beta")).toBeLessThan(result.indexOf("alpha"));
	});

	it("ignores a soft edge when the optional dep is NOT in the run set", async () => {
		const resolveDependencies = await getResolveDependencies();
		const available: Manifest = [
			entry({ id: "alpha", optional_dependencies: ["beta"] }),
			entry({ id: "beta" }),
		];

		// Only alpha selected — optional dep beta should not be pulled in.
		const result = resolveDependencies(["alpha"], available);

		expect(result).not.toContain("beta");
		expect(result).toEqual(["alpha"]);
	});

	it("ignores a soft edge when the optional dep is not in available", async () => {
		const resolveDependencies = await getResolveDependencies();
		const available: Manifest = [
			entry({ id: "alpha", optional_dependencies: ["missing"] }),
		];

		// missing is not in available, so soft edge is silently ignored.
		const result = resolveDependencies(["alpha"], available);

		expect(result).toEqual(["alpha"]);
	});
});

// ---------------------------------------------------------------------------
// Error cases
// ---------------------------------------------------------------------------

describe("resolveDependencies — errors", () => {
	it("throws MissingDependencyError when a hard dependency is not in available", async () => {
		const resolveDependencies = await getResolveDependencies();
		const available: Manifest = [
			entry({ id: "alpha", dependencies: ["nonexistent"] }),
		];

		expect(() => resolveDependencies(["alpha"], available)).toThrow(
			MissingDependencyError,
		);
	});

	it("throws CircularDependencyError on a two-node cycle A → B → A", async () => {
		const resolveDependencies = await getResolveDependencies();
		const available: Manifest = [
			entry({ id: "alpha", dependencies: ["beta"] }),
			entry({ id: "beta", dependencies: ["alpha"] }),
		];

		expect(() => resolveDependencies(["alpha"], available)).toThrow(
			CircularDependencyError,
		);
	});

	it("CircularDependencyError message contains the cycle path", async () => {
		const resolveDependencies = await getResolveDependencies();
		const available: Manifest = [
			entry({ id: "alpha", dependencies: ["beta"] }),
			entry({ id: "beta", dependencies: ["alpha"] }),
		];

		let thrown: unknown;
		try {
			resolveDependencies(["alpha"], available);
		} catch (err) {
			thrown = err;
		}

		expect(thrown).toBeInstanceOf(CircularDependencyError);
		expect((thrown as CircularDependencyError).message).toContain(
			"Circular dependency detected:",
		);
	});

	it("throws MissingDependencyError when selected ID itself is not in available", async () => {
		const resolveDependencies = await getResolveDependencies();
		const available: Manifest = [entry({ id: "alpha" })];

		expect(() => resolveDependencies(["nonexistent"], available)).toThrow(
			MissingDependencyError,
		);
	});
});
