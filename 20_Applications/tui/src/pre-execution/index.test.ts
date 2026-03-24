// ---------------------------------------------------------------------------
// Pre-Execution Orchestrator Tests
//
// Tests exercise `runPreExecution` with all three deps injected as fakes.
// No real I/O is performed.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "bun:test";
import type {
	PreExecutionResult,
	ScriptEntry,
	ScriptInputs,
	ScriptSelectionResult,
} from "../manifest/types.js";
import { runPreExecution } from "./index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeScript(id: string): ScriptEntry {
	return {
		id,
		name: `Script ${id}`,
		description: `Description for ${id}`,
		platform: "linux",
		arch: "x86",
		script: `${id}.sh`,
		dependencies: [],
		optional_dependencies: [],
		requires_elevation: false,
		inputs: [],
	};
}

function makeSelectionResult(
	scripts: ScriptEntry[] = [],
): ScriptSelectionResult {
	return {
		orderedScripts: scripts,
		inputs: new Map(),
		installedIds: new Set(),
	};
}

function makeInputs(entries: [string, string][] = []): ScriptInputs {
	return new Map(entries.map(([k, v]) => [k, { value: v }]));
}

interface FakeDeps {
	collectInputs: (scripts: ScriptEntry[]) => Promise<ScriptInputs>;
	showConfirmation: (
		scripts: ScriptEntry[],
		inputs: ScriptInputs,
	) => Promise<"confirm">;
	checkWindowsElevation: (scripts: ScriptEntry[]) => Promise<"ok">;
}

function makeDeps(overrides: Partial<FakeDeps> = {}): FakeDeps {
	return {
		collectInputs: async () => new Map(),
		showConfirmation: async () => "confirm",
		checkWindowsElevation: async () => "ok",
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe("happy path", () => {
	it("collectInputs called with orderedScripts from selectionResult", async () => {
		const scripts = [makeScript("a"), makeScript("b")];
		const selectionResult = makeSelectionResult(scripts);
		let capturedScripts: ScriptEntry[] | undefined;

		const deps = makeDeps({
			collectInputs: async (s) => {
				capturedScripts = s;
				return new Map();
			},
		});

		await runPreExecution(selectionResult, deps);

		expect(capturedScripts).toBe(scripts);
	});

	it("showConfirmation called with orderedScripts and inputs from collectInputs", async () => {
		const scripts = [makeScript("x")];
		const selectionResult = makeSelectionResult(scripts);
		const fakeInputs = makeInputs([["x-input", "hello"]]);
		let capturedScripts: ScriptEntry[] | undefined;
		let capturedInputs: ScriptInputs | undefined;

		const deps = makeDeps({
			collectInputs: async () => fakeInputs,
			showConfirmation: async (s, inputs) => {
				capturedScripts = s;
				capturedInputs = inputs;
				return "confirm";
			},
		});

		await runPreExecution(selectionResult, deps);

		expect(capturedScripts).toBe(scripts);
		expect(capturedInputs).toBe(fakeInputs);
	});

	it("checkWindowsElevation called after confirmation", async () => {
		const order: string[] = [];
		const deps = makeDeps({
			showConfirmation: async () => {
				order.push("showConfirmation");
				return "confirm";
			},
			checkWindowsElevation: async () => {
				order.push("checkWindowsElevation");
				return "ok";
			},
		});

		await runPreExecution(makeSelectionResult(), deps);

		expect(order.indexOf("showConfirmation")).toBeLessThan(
			order.indexOf("checkWindowsElevation"),
		);
	});

	it("checkWindowsElevation called with orderedScripts", async () => {
		const scripts = [makeScript("elev")];
		const selectionResult = makeSelectionResult(scripts);
		let capturedScripts: ScriptEntry[] | undefined;

		const deps = makeDeps({
			checkWindowsElevation: async (s) => {
				capturedScripts = s;
				return "ok";
			},
		});

		await runPreExecution(selectionResult, deps);

		expect(capturedScripts).toBe(scripts);
	});

	it("returns PreExecutionResult with orderedScripts from selectionResult", async () => {
		const scripts = [makeScript("r1"), makeScript("r2")];
		const selectionResult = makeSelectionResult(scripts);

		const result: PreExecutionResult = await runPreExecution(
			selectionResult,
			makeDeps(),
		);

		expect(result.orderedScripts).toBe(scripts);
	});

	it("returns PreExecutionResult with inputs from collectInputs", async () => {
		const fakeInputs = makeInputs([["foo", "bar"]]);
		const deps = makeDeps({
			collectInputs: async () => fakeInputs,
		});

		const result: PreExecutionResult = await runPreExecution(
			makeSelectionResult(),
			deps,
		);

		expect(result.inputs).toBe(fakeInputs);
	});
});

// ---------------------------------------------------------------------------
// checkWindowsElevation not called until after confirmation
// ---------------------------------------------------------------------------

describe("checkWindowsElevation sequencing", () => {
	it("checkWindowsElevation called after showConfirmation", async () => {
		const order: string[] = [];
		const deps = makeDeps({
			showConfirmation: async () => {
				order.push("showConfirmation");
				return "confirm";
			},
			checkWindowsElevation: async () => {
				order.push("checkWindowsElevation");
				return "ok";
			},
		});

		await runPreExecution(makeSelectionResult(), deps);

		expect(order.indexOf("showConfirmation")).toBeLessThan(
			order.indexOf("checkWindowsElevation"),
		);
	});

	it("checkWindowsElevation called exactly once on confirm", async () => {
		let elevationCallCount = 0;

		const deps = makeDeps({
			checkWindowsElevation: async () => {
				elevationCallCount++;
				return "ok";
			},
		});

		await runPreExecution(makeSelectionResult(), deps);

		expect(elevationCallCount).toBe(1);
	});
});
