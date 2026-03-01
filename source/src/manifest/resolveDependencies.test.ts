import { describe, expect, test } from "bun:test";
import type { ScriptEntry } from "./parseManifest";
import {
	CircularDependencyError,
	MissingDependencyError,
	resolveDependencies,
} from "./resolveDependencies";

// ---------------------------------------------------------------------------
// Helpers — build ScriptEntry fixtures
// ---------------------------------------------------------------------------

function entry(
	id: string,
	dependencies: string[] = [],
	overrides: Partial<ScriptEntry> = {},
): ScriptEntry {
	return {
		id,
		name: `Script ${id}`,
		description: `Description for ${id}`,
		platform: "mac",
		arch: "arm",
		script: `scripts/${id}.sh`,
		dependencies,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// No dependencies
// ---------------------------------------------------------------------------

describe("resolveDependencies — no dependencies", () => {
	test("selecting a script with no dependencies returns [script]", () => {
		const a = entry("a");
		const result = resolveDependencies(["a"], [a]);
		expect(result).toEqual([a]);
	});

	test("selecting multiple scripts with no dependencies returns them in selection order", () => {
		const a = entry("a");
		const b = entry("b");
		const c = entry("c");
		const result = resolveDependencies(["a", "b", "c"], [a, b, c]);
		expect(result).toEqual([a, b, c]);
	});
});

// ---------------------------------------------------------------------------
// Single-level dependencies
// ---------------------------------------------------------------------------

describe("resolveDependencies — single-level dependencies", () => {
	test("dependency comes before the script that declares it", () => {
		const dep = entry("dep");
		const script = entry("script", ["dep"]);
		const result = resolveDependencies(["script"], [dep, script]);
		expect(result).toEqual([dep, script]);
	});

	test("multiple dependencies of a single script all precede it", () => {
		const dep1 = entry("dep1");
		const dep2 = entry("dep2");
		const script = entry("script", ["dep1", "dep2"]);
		const result = resolveDependencies(["script"], [dep1, dep2, script]);
		// dep1 and dep2 must both appear before script
		const ids = result.map((e) => e.id);
		expect(ids.indexOf("dep1")).toBeLessThan(ids.indexOf("script"));
		expect(ids.indexOf("dep2")).toBeLessThan(ids.indexOf("script"));
		expect(result).toContainEqual(dep1);
		expect(result).toContainEqual(dep2);
		expect(result).toContainEqual(script);
		expect(result).toHaveLength(3);
	});
});

// ---------------------------------------------------------------------------
// Multi-level chains
// ---------------------------------------------------------------------------

describe("resolveDependencies — multi-level chains", () => {
	test("A depends on B which depends on C: returns [C, B, A]", () => {
		const c = entry("C");
		const b = entry("B", ["C"]);
		const a = entry("A", ["B"]);
		const result = resolveDependencies(["A"], [c, b, a]);
		expect(result.map((e) => e.id)).toEqual(["C", "B", "A"]);
	});

	test("four-level chain resolves deepest dependency first", () => {
		const d = entry("D");
		const c = entry("C", ["D"]);
		const b = entry("B", ["C"]);
		const a = entry("A", ["B"]);
		const result = resolveDependencies(["A"], [d, c, b, a]);
		expect(result.map((e) => e.id)).toEqual(["D", "C", "B", "A"]);
	});
});

// ---------------------------------------------------------------------------
// Shared dependency deduplication
// ---------------------------------------------------------------------------

describe("resolveDependencies — shared dependency deduplication", () => {
	test("shared dependency between two selected scripts is included once", () => {
		const shared = entry("shared");
		const s1 = entry("s1", ["shared"]);
		const s2 = entry("s2", ["shared"]);
		const result = resolveDependencies(["s1", "s2"], [shared, s1, s2]);
		const ids = result.map((e) => e.id);
		expect(ids.filter((id) => id === "shared")).toHaveLength(1);
		expect(ids.indexOf("shared")).toBeLessThan(ids.indexOf("s1"));
		expect(ids.indexOf("shared")).toBeLessThan(ids.indexOf("s2"));
	});

	test("diamond dependency (A→B→D and A→C→D): D included once", () => {
		// A depends on B and C; both B and C depend on D
		const d = entry("D");
		const b = entry("B", ["D"]);
		const c = entry("C", ["D"]);
		const a = entry("A", ["B", "C"]);
		const result = resolveDependencies(["A"], [d, b, c, a]);
		const ids = result.map((e) => e.id);
		expect(ids.filter((id) => id === "D")).toHaveLength(1);
		expect(ids.indexOf("D")).toBeLessThan(ids.indexOf("B"));
		expect(ids.indexOf("D")).toBeLessThan(ids.indexOf("C"));
		expect(ids.indexOf("B")).toBeLessThan(ids.indexOf("A"));
		expect(ids.indexOf("C")).toBeLessThan(ids.indexOf("A"));
	});

	test("selecting a script already used as a dep does not duplicate it", () => {
		const dep = entry("dep");
		const script = entry("script", ["dep"]);
		// "dep" is both a dependency of "script" and explicitly selected
		const result = resolveDependencies(["dep", "script"], [dep, script]);
		const ids = result.map((e) => e.id);
		expect(ids.filter((id) => id === "dep")).toHaveLength(1);
		expect(ids.indexOf("dep")).toBeLessThan(ids.indexOf("script"));
	});
});

// ---------------------------------------------------------------------------
// MissingDependencyError
// ---------------------------------------------------------------------------

describe("resolveDependencies — MissingDependencyError", () => {
	test("throws MissingDependencyError when a declared dependency is not in available list", () => {
		const script = entry("script", ["missing-dep"]);
		expect(() => resolveDependencies(["script"], [script])).toThrow(
			MissingDependencyError,
		);
	});

	test("MissingDependencyError contains the missing id", () => {
		const script = entry("script", ["ghost"]);
		let caught: unknown;
		try {
			resolveDependencies(["script"], [script]);
		} catch (e) {
			caught = e;
		}
		expect(caught).toBeInstanceOf(MissingDependencyError);
		expect((caught as MissingDependencyError).missingId).toBe("ghost");
	});

	test("throws MissingDependencyError when a selected script id is not in available list", () => {
		expect(() => resolveDependencies(["nonexistent"], [])).toThrow(
			MissingDependencyError,
		);
	});

	test("MissingDependencyError has a descriptive message containing the missing id", () => {
		const script = entry("script", ["phantom"]);
		let caught: unknown;
		try {
			resolveDependencies(["script"], [script]);
		} catch (e) {
			caught = e;
		}
		expect((caught as MissingDependencyError).message).toContain("phantom");
	});

	test("throws MissingDependencyError for transitive missing dependency", () => {
		const b = entry("B", ["C"]); // C is not in available
		const a = entry("A", ["B"]);
		let caught: unknown;
		try {
			resolveDependencies(["A"], [a, b]);
		} catch (e) {
			caught = e;
		}
		expect(caught).toBeInstanceOf(MissingDependencyError);
		expect((caught as MissingDependencyError).missingId).toBe("C");
	});
});

// ---------------------------------------------------------------------------
// CircularDependencyError
// ---------------------------------------------------------------------------

describe("resolveDependencies — CircularDependencyError", () => {
	test("throws CircularDependencyError for direct self-dependency", () => {
		const a = entry("A", ["A"]);
		expect(() => resolveDependencies(["A"], [a])).toThrow(
			CircularDependencyError,
		);
	});

	test("throws CircularDependencyError for two-node cycle (A→B→A)", () => {
		const a = entry("A", ["B"]);
		const b = entry("B", ["A"]);
		expect(() => resolveDependencies(["A"], [a, b])).toThrow(
			CircularDependencyError,
		);
	});

	test("throws CircularDependencyError for three-node cycle (A→B→C→A)", () => {
		const a = entry("A", ["B"]);
		const b = entry("B", ["C"]);
		const c = entry("C", ["A"]);
		expect(() => resolveDependencies(["A"], [a, b, c])).toThrow(
			CircularDependencyError,
		);
	});

	test("CircularDependencyError has a descriptive message", () => {
		const a = entry("A", ["B"]);
		const b = entry("B", ["A"]);
		let caught: unknown;
		try {
			resolveDependencies(["A"], [a, b]);
		} catch (e) {
			caught = e;
		}
		expect(caught).toBeInstanceOf(CircularDependencyError);
		expect((caught as CircularDependencyError).message).toMatch(
			/circular|cycle/i,
		);
	});
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("resolveDependencies — edge cases", () => {
	test("empty selected list returns empty array", () => {
		const a = entry("a");
		const result = resolveDependencies([], [a]);
		expect(result).toEqual([]);
	});

	test("empty available list with empty selected returns empty array", () => {
		const result = resolveDependencies([], []);
		expect(result).toEqual([]);
	});

	test("order of unrelated selected scripts is preserved", () => {
		const x = entry("x");
		const y = entry("y");
		const z = entry("z");
		// All independent — original selection order should be honored
		const result = resolveDependencies(["z", "x", "y"], [x, y, z]);
		expect(result.map((e) => e.id)).toEqual(["z", "x", "y"]);
	});
});
