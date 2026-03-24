// ---------------------------------------------------------------------------
// Script Selection Screens Tests
//
// Tests for thin @clack/prompts wrappers for the script selection phase.
// All clack calls go through injectable deps for testability.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "bun:test";
import type { ScriptEntry } from "../manifest/types.js";
import type { ClackDeps } from "./screens.js";
import {
	showIndividualSelect,
	showMainMenu,
	showNoScripts,
} from "./screens.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Cancel symbol — the value @clack/prompts returns when the user presses Ctrl-C. */
const CANCEL = Symbol("clack-cancel");

/**
 * Builds a minimal fake ClackDeps that records calls and returns canned values.
 */
function makeClack(
	opts: {
		selectResult?: string | symbol;
		multiselectResult?: string[] | symbol;
		logWarnCalls?: string[];
		logInfoCalls?: string[];
	} = {},
): ClackDeps & {
	selectCalls: Array<{
		message: string;
		options: Array<{ value: string; label: string; hint?: string }>;
	}>;
	multiselectCalls: Array<{
		message: string;
		options: Array<{ value: string; label: string; hint?: string }>;
		initialValues: string[];
	}>;
	logWarnCalls: string[];
	logInfoCalls: string[];
} {
	const selectCalls: Array<{
		message: string;
		options: Array<{ value: string; label: string; hint?: string }>;
	}> = [];
	const multiselectCalls: Array<{
		message: string;
		options: Array<{ value: string; label: string; hint?: string }>;
		initialValues: string[];
	}> = [];
	const logWarnCalls: string[] = opts.logWarnCalls ?? [];
	const logInfoCalls: string[] = opts.logInfoCalls ?? [];

	// Allow the select result to be an array of values for multiple calls
	let selectCallCount = 0;
	const selectResults = Array.isArray(opts.selectResult)
		? opts.selectResult
		: [opts.selectResult ?? "individual"];

	return {
		select: async (selectOpts: {
			message: string;
			options: Array<{ value: string; label?: string; hint?: string }>;
		}) => {
			selectCalls.push({
				message: selectOpts.message,
				options: selectOpts.options.map((o) => ({
					value: o.value,
					label: o.label ?? o.value,
					hint: o.hint,
				})),
			});
			const result =
				selectResults[selectCallCount] ??
				selectResults[selectResults.length - 1];
			selectCallCount++;
			return result ?? "individual";
		},
		multiselect: async (multiselectOpts: {
			message: string;
			options: Array<{ value: string; label?: string; hint?: string }>;
			initialValues?: string[];
		}) => {
			multiselectCalls.push({
				message: multiselectOpts.message,
				options: multiselectOpts.options.map((o) => ({
					value: o.value,
					label: o.label ?? o.value,
					hint: o.hint,
				})),
				initialValues: multiselectOpts.initialValues ?? [],
			});
			return opts.multiselectResult ?? [];
		},
		log: {
			warn: (message: string) => {
				logWarnCalls.push(message);
			},
			info: (message: string) => {
				logInfoCalls.push(message);
			},
		},
		isCancel: (val: unknown): val is symbol => val === CANCEL,
		cancel: (_hint?: string) => {},
		// Exposed for assertions
		selectCalls,
		multiselectCalls,
		logWarnCalls,
		logInfoCalls,
	} as unknown as ClackDeps & {
		selectCalls: Array<{
			message: string;
			options: Array<{ value: string; label: string; hint?: string }>;
		}>;
		multiselectCalls: Array<{
			message: string;
			options: Array<{ value: string; label: string; hint?: string }>;
			initialValues: string[];
		}>;
		logWarnCalls: string[];
		logInfoCalls: string[];
	};
}

/** Builds a minimal fake ScriptEntry. */
function makeEntry(
	overrides: Partial<ScriptEntry> & { id: string; name: string },
): ScriptEntry {
	return {
		description: "A test script",
		platform: "linux",
		arch: "x86",
		script: "script.sh",
		distro: "Debian GNU/Linux",
		version: "13",
		group: "tools",
		dependencies: [],
		optional_dependencies: [],
		requires_elevation: false,
		inputs: [],
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// showNoScripts
// ---------------------------------------------------------------------------

describe("showNoScripts", () => {
	it("calls log.warn with the hostLabel", () => {
		const clack = makeClack();
		const fakeExit = (_code: number): never => {
			throw new Error("__EXIT__");
		};
		try {
			showNoScripts("linux/x86/Debian 13", { clack, exit: fakeExit });
		} catch (err) {
			if ((err as Error).message !== "__EXIT__") throw err;
		}
		expect(clack.logWarnCalls).toHaveLength(1);
		expect(clack.logWarnCalls[0]).toContain("linux/x86/Debian 13");
	});

	it("calls exit(0) after warning", () => {
		const clack = makeClack();
		let exitCode: number | undefined;
		const fakeExit = (code: number): never => {
			exitCode = code;
			throw new Error("__EXIT__");
		};
		try {
			showNoScripts("linux/x86", { clack, exit: fakeExit });
		} catch (err) {
			if ((err as Error).message !== "__EXIT__") throw err;
		}
		expect(exitCode).toBe(0);
	});

	it("calls log.warn before exit", () => {
		const clack = makeClack();
		const callOrder: string[] = [];
		const warnCalls: string[] = [];
		clack.log.warn = (message: string) => {
			callOrder.push("warn");
			warnCalls.push(message);
		};
		try {
			showNoScripts("linux/x86", {
				clack,
				exit: (_code: number): never => {
					callOrder.push("exit");
					throw new Error("__EXIT__");
				},
			});
		} catch (err) {
			if ((err as Error).message !== "__EXIT__") throw err;
		}
		expect(callOrder).toEqual(["warn", "exit"]);
	});
});

// ---------------------------------------------------------------------------
// showMainMenu
// ---------------------------------------------------------------------------

describe("showMainMenu — option list", () => {
	it("includes all provided group names as options", async () => {
		const clack = makeClack({ selectResult: "tools" });
		await showMainMenu(["tools", "dev", "security"], { clack });
		const opts = clack.selectCalls[0]?.options ?? [];
		const values = opts.map((o) => o.value);
		expect(values).toContain("tools");
		expect(values).toContain("dev");
		expect(values).toContain("security");
	});

	it("includes an 'Individual scripts' option", async () => {
		const clack = makeClack({ selectResult: "individual" });
		await showMainMenu(["tools"], { clack });
		const opts = clack.selectCalls[0]?.options ?? [];
		const labels = opts.map((o) => o.label);
		expect(labels.some((l) => l.toLowerCase().includes("individual"))).toBe(
			true,
		);
	});

	it("includes a 'Settings' option", async () => {
		const clack = makeClack({ selectResult: "tools" });
		await showMainMenu(["tools"], { clack });
		const opts = clack.selectCalls[0]?.options ?? [];
		const labels = opts.map((o) => o.label);
		expect(labels.some((l) => l.toLowerCase().includes("settings"))).toBe(true);
	});

	it("calls select exactly once when a group is chosen", async () => {
		const clack = makeClack({ selectResult: "tools" });
		await showMainMenu(["tools"], { clack });
		expect(clack.selectCalls).toHaveLength(1);
	});
});

describe("showMainMenu — return value", () => {
	it("returns 'individual' when the individual-scripts option is chosen", async () => {
		// The individual option value should be "individual"
		const clack = makeClack({ selectResult: "individual" });
		const result = await showMainMenu(["tools"], { clack });
		expect(result).toBe("individual");
	});

	it("returns the group name when a group is chosen", async () => {
		const clack = makeClack({ selectResult: "security" });
		const result = await showMainMenu(["tools", "security"], { clack });
		expect(result).toBe("security");
	});
});

describe("showMainMenu — settings loop", () => {
	it("shows settings info message when settings is selected", async () => {
		// First call returns "settings", second call returns "tools"
		let callCount = 0;
		const clack = makeClack();
		clack.select = (async () => {
			callCount++;
			if (callCount === 1) return "settings";
			return "tools";
		}) as unknown as ClackDeps["select"];
		await showMainMenu(["tools"], { clack });
		expect(
			clack.logInfoCalls.some((m) => m.toLowerCase().includes("settings")),
		).toBe(true);
	});

	it("loops back to select after settings is chosen", async () => {
		let callCount = 0;
		const clack = makeClack();
		clack.select = (async () => {
			callCount++;
			if (callCount === 1) return "settings";
			return "tools";
		}) as unknown as ClackDeps["select"];
		const result = await showMainMenu(["tools"], { clack });
		expect(callCount).toBe(2);
		expect(result).toBe("tools");
	});

	it("loops multiple times when settings is selected repeatedly", async () => {
		let callCount = 0;
		const clack = makeClack();
		clack.select = (async () => {
			callCount++;
			if (callCount < 3) return "settings";
			return "individual";
		}) as unknown as ClackDeps["select"];
		const result = await showMainMenu(["tools"], { clack });
		expect(callCount).toBe(3);
		expect(result).toBe("individual");
	});
});

describe("showMainMenu — cancel symbol exits", () => {
	it("calls exit(0) when select returns the cancel symbol", async () => {
		let exitCode: number | undefined;
		const clack = makeClack({ selectResult: CANCEL });
		try {
			await showMainMenu(["tools"], {
				clack,
				exit: (code) => {
					exitCode = code;
					throw new Error(`exit:${code}`);
				},
			});
		} catch (err) {
			if (!(err as Error).message.startsWith("exit:")) throw err;
		}
		expect(exitCode).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// showIndividualSelect
// ---------------------------------------------------------------------------

describe("showIndividualSelect — label formatting", () => {
	it("labels installed scripts with [installed] suffix", async () => {
		const clack = makeClack({ multiselectResult: [] });
		const scripts = [
			makeEntry({ id: "a", name: "Alpha", installed: true }),
			makeEntry({ id: "b", name: "Beta", installed: false }),
		];
		await showIndividualSelect(scripts, { clack });
		const opts = clack.multiselectCalls[0]?.options ?? [];
		const alpha = opts.find((o) => o.value === "a");
		const beta = opts.find((o) => o.value === "b");
		expect(alpha?.label).toContain("[installed]");
		expect(beta?.label).not.toContain("[installed]");
	});

	it("uses script description as hint", async () => {
		const clack = makeClack({ multiselectResult: [] });
		const scripts = [
			makeEntry({ id: "a", name: "Alpha", description: "Does alpha things" }),
		];
		await showIndividualSelect(scripts, { clack });
		const opts = clack.multiselectCalls[0]?.options ?? [];
		const alpha = opts.find((o) => o.value === "a");
		expect(alpha?.hint).toBe("Does alpha things");
	});
});

describe("showIndividualSelect — pre-check behavior", () => {
	it("does not pre-check installed scripts", async () => {
		const clack = makeClack({ multiselectResult: [] });
		const scripts = [makeEntry({ id: "a", name: "Alpha", installed: true })];
		await showIndividualSelect(scripts, { clack });
		const call = clack.multiselectCalls[0];
		expect(call?.initialValues ?? []).not.toContain("a");
	});

	it("does not pre-check uninstalled scripts either", async () => {
		const clack = makeClack({ multiselectResult: [] });
		const scripts = [makeEntry({ id: "b", name: "Beta", installed: false })];
		await showIndividualSelect(scripts, { clack });
		const call = clack.multiselectCalls[0];
		expect(call?.initialValues ?? []).not.toContain("b");
	});
});

describe("showIndividualSelect — return value", () => {
	it("returns IDs of selected entries", async () => {
		const clack = makeClack({ multiselectResult: ["a", "c"] });
		const scripts = [
			makeEntry({ id: "a", name: "Alpha" }),
			makeEntry({ id: "b", name: "Beta" }),
			makeEntry({ id: "c", name: "Gamma" }),
		];
		const result = await showIndividualSelect(scripts, { clack });
		expect(result).toEqual(["a", "c"]);
	});

	it("returns empty array when nothing is selected", async () => {
		const clack = makeClack({ multiselectResult: [] });
		const scripts = [makeEntry({ id: "a", name: "Alpha" })];
		const result = await showIndividualSelect(scripts, { clack });
		expect(result).toEqual([]);
	});
});

describe("showIndividualSelect — cancel symbol exits", () => {
	it("calls exit(0) when multiselect returns the cancel symbol", async () => {
		let exitCode: number | undefined;
		const clack = makeClack({ multiselectResult: CANCEL });
		const scripts = [makeEntry({ id: "a", name: "Alpha" })];
		try {
			await showIndividualSelect(scripts, {
				clack,
				exit: (code) => {
					exitCode = code;
					throw new Error(`exit:${code}`);
				},
			});
		} catch (err) {
			if (!(err as Error).message.startsWith("exit:")) throw err;
		}
		expect(exitCode).toBe(0);
	});
});
