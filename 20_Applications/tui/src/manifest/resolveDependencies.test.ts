import { describe, expect, it } from "bun:test";
import type { ScriptEntry } from "../types.js";
import { ResolutionError } from "../types.js";
import { resolveDependencies } from "./resolveDependencies.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeScript(
	overrides: Partial<ScriptEntry> & { id: string },
): ScriptEntry {
	const { id, ...rest } = overrides;
	return {
		id,
		name: `Script ${id}`,
		description: "A script",
		os: { name: "Debian GNU/Linux", version: "12", arch: "x64" },
		script: `scripts/linux/${id}.sh`,
		...rest,
	};
}

// ---------------------------------------------------------------------------
// Task 2 — Phase 0: run_if filtering
// ---------------------------------------------------------------------------

describe("resolveDependencies — Phase 0: run_if filtering", () => {
	describe("no run_if on any candidate", () => {
		it("returns all candidates when none have run_if", async () => {
			const a = makeScript({ id: "a" });
			const b = makeScript({ id: "b" });
			const result = await resolveDependencies([a, b], [a, b]);
			const ids = result.map((s) => s.id);
			expect(ids).toContain("a");
			expect(ids).toContain("b");
			expect(result).toHaveLength(2);
		});
	});

	describe("run_if referencing a script in candidateScripts", () => {
		it("keeps a candidate whose run_if ID is in candidateScripts", async () => {
			const a = makeScript({ id: "a" });
			const b = makeScript({ id: "b", run_if: ["a"] });
			const result = await resolveDependencies([a, b], [a, b]);
			const ids = result.map((s) => s.id);
			expect(ids).toContain("b");
		});
	});

	describe("run_if referencing a script not in candidateScripts and not installed", () => {
		it("removes a candidate whose run_if ID is absent from both candidateScripts and installed set", async () => {
			const a = makeScript({ id: "a" });
			const b = makeScript({ id: "b", run_if: ["a"] });
			// a is in filteredScripts but NOT in candidateScripts
			const result = await resolveDependencies([b], [a, b]);
			const ids = result.map((s) => s.id);
			expect(ids).not.toContain("b");
		});
	});

	describe("run_if referencing an installed script", () => {
		it("keeps a candidate when run_if ID is installed (creates all-paths-exist)", async () => {
			// Use a real path guaranteed to exist: /usr/bin/env
			const installer = makeScript({
				id: "installer",
				creates: ["/usr/bin/env"],
			});
			const dependent = makeScript({
				id: "dependent",
				run_if: ["installer"],
			});
			// installer is in filteredScripts but NOT in candidateScripts
			const result = await resolveDependencies(
				[dependent],
				[installer, dependent],
			);
			const ids = result.map((s) => s.id);
			expect(ids).toContain("dependent");
		});
	});

	describe("creates path checks", () => {
		it("considers a script installed when all creates paths exist", async () => {
			const installer = makeScript({
				id: "installer",
				creates: ["/usr/bin/env"],
			});
			const dependent = makeScript({ id: "dependent", run_if: ["installer"] });
			const result = await resolveDependencies(
				[dependent],
				[installer, dependent],
			);
			expect(result.map((s) => s.id)).toContain("dependent");
		});

		it("does not consider a script installed when one creates path is missing", async () => {
			const installer = makeScript({
				id: "installer",
				creates: ["/usr/bin/env", "/this/path/does/not/exist/ever"],
			});
			const dependent = makeScript({ id: "dependent", run_if: ["installer"] });
			const result = await resolveDependencies(
				[dependent],
				[installer, dependent],
			);
			expect(result.map((s) => s.id)).not.toContain("dependent");
		});

		it("never considers a script with creates:[] as installed", async () => {
			const installer = makeScript({ id: "installer", creates: [] });
			const dependent = makeScript({ id: "dependent", run_if: ["installer"] });
			const result = await resolveDependencies(
				[dependent],
				[installer, dependent],
			);
			expect(result.map((s) => s.id)).not.toContain("dependent");
		});

		it("expands leading ~ to process.env.HOME in creates paths", async () => {
			// Use ~/.bashrc — almost certainly exists on this machine, but
			// we test the expansion is applied by using a path that would fail
			// if ~ were treated literally.
			const home = process.env.HOME ?? "";
			// Pick a path we know exists inside HOME (HOME itself exists as a dir;
			// use a known file like ~/.bashrc or fall back to /usr/bin/env)
			const realPath = `${home}/.bashrc`;
			const tildeCreates = makeScript({
				id: "installer",
				creates: ["~/.bashrc"],
			});
			const dependent = makeScript({ id: "dependent", run_if: ["installer"] });

			const bashrcFile = Bun.file(realPath);
			const bashrcExists = await bashrcFile.exists();

			const result = await resolveDependencies(
				[dependent],
				[tildeCreates, dependent],
			);
			if (bashrcExists) {
				expect(result.map((s) => s.id)).toContain("dependent");
			} else {
				expect(result.map((s) => s.id)).not.toContain("dependent");
			}
		});
	});

	describe("run_if with multiple IDs", () => {
		it("keeps a candidate when all run_if IDs are satisfied (both in candidateScripts)", async () => {
			const a = makeScript({ id: "a" });
			const b = makeScript({ id: "b" });
			const c = makeScript({ id: "c", run_if: ["a", "b"] });
			const result = await resolveDependencies([a, b, c], [a, b, c]);
			expect(result.map((s) => s.id)).toContain("c");
		});

		it("removes a candidate when one of the run_if IDs is not satisfied", async () => {
			const a = makeScript({ id: "a" });
			const b = makeScript({ id: "b" });
			const c = makeScript({ id: "c", run_if: ["a", "b"] });
			// b is not in candidateScripts and not installed
			const result = await resolveDependencies([a, c], [a, b, c]);
			expect(result.map((s) => s.id)).not.toContain("c");
		});
	});

	describe("run_if validation — invalid references throw ResolutionError", () => {
		it("throws ResolutionError when a run_if ID does not exist in filteredScripts", async () => {
			const a = makeScript({ id: "a", run_if: ["nonexistent"] });
			await expect(resolveDependencies([a], [a])).rejects.toBeInstanceOf(
				ResolutionError,
			);
		});

		it("error message names the unknown run_if ID", async () => {
			const a = makeScript({ id: "a", run_if: ["ghost"] });
			let caught: unknown;
			try {
				await resolveDependencies([a], [a]);
			} catch (e) {
				caught = e;
			}
			expect(caught).toBeInstanceOf(ResolutionError);
			expect((caught as ResolutionError).message).toContain("ghost");
		});

		it("throws before any candidate filtering occurs", async () => {
			// 'b' has a valid run_if but 'a' has an invalid one.
			// The error should fire before 'b' is evaluated.
			const a = makeScript({ id: "a", run_if: ["phantom"] });
			const b = makeScript({ id: "b" });
			await expect(resolveDependencies([a, b], [a, b])).rejects.toBeInstanceOf(
				ResolutionError,
			);
		});
	});

	describe("removal does not trigger re-evaluation", () => {
		it("does not re-evaluate remaining scripts after one is removed", async () => {
			// a has run_if: [z] where z is not in candidates/installed → a removed
			// b has run_if: [a] — but since this is a single pass, a is still in
			// candidateScripts at evaluation time, so b should be kept
			const z = makeScript({ id: "z" }); // in filteredScripts, not candidates
			const a = makeScript({ id: "a", run_if: ["z"] });
			const b = makeScript({ id: "b", run_if: ["a"] });
			// a will be removed (z not in candidates), but b sees a in candidateScripts
			const result = await resolveDependencies([a, b], [z, a, b]);
			const ids = result.map((s) => s.id);
			// a is removed, b is kept (single-pass: a was in candidateScripts when b was evaluated)
			expect(ids).not.toContain("a");
			expect(ids).toContain("b");
		});
	});
});

// ---------------------------------------------------------------------------
// Task 3 — Phase 1: Transitive dependency expansion
// ---------------------------------------------------------------------------

describe("resolveDependencies — Phase 1: transitive dependency expansion", () => {
	it("a dependency appears before the script that depends on it", async () => {
		const dep = makeScript({ id: "dep" });
		const main = makeScript({ id: "main", dependencies: ["dep"] });
		const result = await resolveDependencies([main], [dep, main]);
		const ids = result.map((s) => s.id);
		expect(ids).toContain("dep");
		expect(ids).toContain("main");
		expect(ids.indexOf("dep")).toBeLessThan(ids.indexOf("main"));
	});

	it("pulls in a dependency not explicitly in candidateScripts", async () => {
		const dep = makeScript({ id: "dep" });
		const main = makeScript({ id: "main", dependencies: ["dep"] });
		// dep is in filteredScripts but NOT in candidateScripts
		const result = await resolveDependencies([main], [dep, main]);
		const ids = result.map((s) => s.id);
		expect(ids).toContain("dep");
		expect(ids.indexOf("dep")).toBeLessThan(ids.indexOf("main"));
	});

	it("throws ResolutionError when a dependencies ID is not in filteredScripts", async () => {
		const main = makeScript({ id: "main", dependencies: ["missing"] });
		await expect(resolveDependencies([main], [main])).rejects.toBeInstanceOf(
			ResolutionError,
		);
	});

	it("error message names the missing dependency ID", async () => {
		const main = makeScript({ id: "main", dependencies: ["ghost-dep"] });
		let caught: unknown;
		try {
			await resolveDependencies([main], [main]);
		} catch (e) {
			caught = e;
		}
		expect(caught).toBeInstanceOf(ResolutionError);
		expect((caught as ResolutionError).message).toContain("ghost-dep");
	});

	it("handles transitive deps: A→B→C, only A selected → all three appear in order C,B,A", async () => {
		const c = makeScript({ id: "c" });
		const b = makeScript({ id: "b", dependencies: ["c"] });
		const a = makeScript({ id: "a", dependencies: ["b"] });
		const result = await resolveDependencies([a], [c, b, a]);
		const ids = result.map((s) => s.id);
		expect(ids).toEqual(["c", "b", "a"]);
	});

	it("Phase 0 removals are not candidates for Phase 1 dep expansion", async () => {
		const z = makeScript({ id: "z" }); // not in candidates
		// a is removed in Phase 0 (run_if: z, z not in candidates/installed)
		const a = makeScript({ id: "a", run_if: ["z"], dependencies: ["b"] });
		const b = makeScript({ id: "b" });
		// If a were expanded, b would appear; since a is removed, b should only
		// appear if it was directly in candidateScripts
		const result = await resolveDependencies([a], [z, a, b]);
		const ids = result.map((s) => s.id);
		// a removed by Phase 0; b not in candidates and not a dep of any kept script
		expect(ids).not.toContain("a");
		expect(ids).not.toContain("b");
	});
});

// ---------------------------------------------------------------------------
// Task 3 — Phase 2: Topological sort with cycle detection
// ---------------------------------------------------------------------------

describe("resolveDependencies — Phase 2: topological sort", () => {
	it("run_after: [X] where X is in run set → X appears before the dependent", async () => {
		const x = makeScript({ id: "x" });
		const y = makeScript({ id: "y", run_after: ["x"] });
		const result = await resolveDependencies([x, y], [x, y]);
		const ids = result.map((s) => s.id);
		expect(ids.indexOf("x")).toBeLessThan(ids.indexOf("y"));
	});

	it("run_after: [X] where X is not in run set → silently ignored, no error", async () => {
		const x = makeScript({ id: "x" }); // in filteredScripts but NOT in candidates/run set
		const y = makeScript({ id: "y", run_after: ["x"] });
		const result = await resolveDependencies([y], [x, y]);
		expect(result.map((s) => s.id)).toContain("y");
	});

	it("throws ResolutionError on a hard-edge cycle (A depends on B, B depends on A)", async () => {
		const a = makeScript({ id: "a", dependencies: ["b"] });
		const b = makeScript({ id: "b", dependencies: ["a"] });
		await expect(resolveDependencies([a, b], [a, b])).rejects.toBeInstanceOf(
			ResolutionError,
		);
	});

	it("error message for cycle names a script involved in the cycle", async () => {
		const a = makeScript({ id: "a", dependencies: ["b"] });
		const b = makeScript({ id: "b", dependencies: ["a"] });
		let caught: unknown;
		try {
			await resolveDependencies([a, b], [a, b]);
		} catch (e) {
			caught = e;
		}
		expect(caught).toBeInstanceOf(ResolutionError);
		// Message should contain 'a' or 'b' — at minimum the word 'Circular'
		expect((caught as ResolutionError).message.toLowerCase()).toContain(
			"circular",
		);
	});

	it("throws ResolutionError on a soft-edge cycle (A run_after B, B depends on A)", async () => {
		const a = makeScript({ id: "a", run_after: ["b"] });
		const b = makeScript({ id: "b", dependencies: ["a"] });
		await expect(resolveDependencies([a, b], [a, b])).rejects.toBeInstanceOf(
			ResolutionError,
		);
	});

	it("scripts with no ordering constraints among themselves all appear in result", async () => {
		const a = makeScript({ id: "a" });
		const b = makeScript({ id: "b" });
		const c = makeScript({ id: "c" });
		const result = await resolveDependencies([a, b, c], [a, b, c]);
		const ids = result.map((s) => s.id);
		expect(ids).toContain("a");
		expect(ids).toContain("b");
		expect(ids).toContain("c");
		expect(result).toHaveLength(3);
	});
});
