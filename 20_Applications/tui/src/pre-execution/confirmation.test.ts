// ---------------------------------------------------------------------------
// Confirmation Screen Tests
//
// Tests for the execution-plan display and confirm/back prompt.
// All deps are injected as fakes. No real @clack/prompts calls.
// TDD: tests were written before the implementation (RED → GREEN).
// ---------------------------------------------------------------------------

import { describe, expect, it } from "bun:test";
import type {
	CollectedInput,
	ScriptEntry,
	ScriptInputs,
} from "../manifest/types.js";
import type { ConfirmationDeps } from "./confirmation.js";
import { formatExecutionPlan, showConfirmation } from "./confirmation.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(
	overrides: Partial<ScriptEntry> & { id: string; name: string },
): ScriptEntry {
	return {
		description: "A test script",
		platform: "linux",
		arch: "x86",
		script: "script.sh",
		dependencies: [],
		optional_dependencies: [],
		requires_elevation: false,
		inputs: [],
		...overrides,
	};
}

function makeDeps(overrides: Partial<ConfirmationDeps> = {}): ConfirmationDeps {
	return {
		confirm: async (_opts: { message: string }) => true,
		isCancel: (val: unknown): val is symbol => typeof val === "symbol",
		cancel: (_hint?: string) => {},
		exit: (_code: number): never => {
			throw new Error("exit");
		},
		...overrides,
	};
}

/** ANSI dim prefix and reset for assertions. */
const DIM_START = "\x1b[2m";
const DIM_END = "\x1b[0m";

// ---------------------------------------------------------------------------
// formatExecutionPlan — numbered scripts in order
// ---------------------------------------------------------------------------

describe("formatExecutionPlan — numbered scripts in order", () => {
	it("includes index 1 for the first script", () => {
		const scripts = [makeEntry({ id: "a", name: "Alpha" })];
		const inputs: ScriptInputs = new Map();
		const plan = formatExecutionPlan(scripts, inputs);
		expect(plan).toContain("1.");
	});

	it("includes script name in the output", () => {
		const scripts = [makeEntry({ id: "a", name: "Alpha" })];
		const inputs: ScriptInputs = new Map();
		const plan = formatExecutionPlan(scripts, inputs);
		expect(plan).toContain("Alpha");
	});

	it("includes sequential indices for multiple scripts", () => {
		const scripts = [
			makeEntry({ id: "a", name: "Alpha" }),
			makeEntry({ id: "b", name: "Beta" }),
			makeEntry({ id: "c", name: "Gamma" }),
		];
		const inputs: ScriptInputs = new Map();
		const plan = formatExecutionPlan(scripts, inputs);
		expect(plan).toContain("1.");
		expect(plan).toContain("2.");
		expect(plan).toContain("3.");
	});

	it("scripts appear in the provided order", () => {
		const scripts = [
			makeEntry({ id: "a", name: "Alpha" }),
			makeEntry({ id: "b", name: "Beta" }),
		];
		const inputs: ScriptInputs = new Map();
		const plan = formatExecutionPlan(scripts, inputs);
		const alphaPos = plan.indexOf("Alpha");
		const betaPos = plan.indexOf("Beta");
		expect(alphaPos).toBeLessThan(betaPos);
	});

	it("includes the heading", () => {
		const scripts = [makeEntry({ id: "a", name: "Alpha" })];
		const inputs: ScriptInputs = new Map();
		const plan = formatExecutionPlan(scripts, inputs);
		expect(plan).toContain("The following scripts will run in order:");
	});
});

// ---------------------------------------------------------------------------
// formatExecutionPlan — description dimmed
// ---------------------------------------------------------------------------

describe("formatExecutionPlan — description dimmed", () => {
	it("wraps description in ANSI dim escape codes", () => {
		const scripts = [
			makeEntry({ id: "a", name: "Alpha", description: "Does alpha things" }),
		];
		const inputs: ScriptInputs = new Map();
		const plan = formatExecutionPlan(scripts, inputs);
		expect(plan).toContain(`${DIM_START}Does alpha things${DIM_END}`);
	});

	it("description appears after the script name with a dash separator", () => {
		const scripts = [
			makeEntry({ id: "a", name: "Alpha", description: "Does stuff" }),
		];
		const inputs: ScriptInputs = new Map();
		const plan = formatExecutionPlan(scripts, inputs);
		expect(plan).toContain("Alpha");
		expect(plan).toContain("—");
		expect(plan).toContain("Does stuff");
	});
});

// ---------------------------------------------------------------------------
// formatExecutionPlan — only non-empty inputs shown
// ---------------------------------------------------------------------------

describe("formatExecutionPlan — only non-empty inputs shown", () => {
	it("shows nothing below the script row when there are no inputs in the map", () => {
		const scripts = [makeEntry({ id: "a", name: "Alpha" })];
		const inputs: ScriptInputs = new Map();
		const plan = formatExecutionPlan(scripts, inputs);
		// Just has the heading, the script row, and the footer — no indented inputs
		const lines = plan.split("\n").filter((l) => l.trim().length > 0);
		// Heading, script row, and footer lines — no blank indent lines
		expect(lines.every((l) => !l.startsWith("  ") || l.trim() === "")).toBe(
			true,
		);
	});

	it("does not show inputs with empty value", () => {
		const scripts = [
			makeEntry({
				id: "a",
				name: "Alpha",
				inputs: [{ id: "email", type: "string", label: "Email" }],
			}),
		];
		const inputs: ScriptInputs = new Map<string, CollectedInput>([
			["email", { value: "" }],
		]);
		const plan = formatExecutionPlan(scripts, inputs);
		expect(plan).not.toContain("Email:");
	});

	it("shows inputs with non-empty value", () => {
		const scripts = [
			makeEntry({
				id: "a",
				name: "Alpha",
				inputs: [{ id: "email", type: "string", label: "Email" }],
			}),
		];
		const inputs: ScriptInputs = new Map<string, CollectedInput>([
			["email", { value: "user@example.com" }],
		]);
		const plan = formatExecutionPlan(scripts, inputs);
		expect(plan).toContain("Email:");
		expect(plan).toContain("user@example.com");
	});
});

// ---------------------------------------------------------------------------
// formatExecutionPlan — string input formatted as label:value
// ---------------------------------------------------------------------------

describe("formatExecutionPlan — string input formatted as label:value", () => {
	it("formats string input as '  {label}: {value}'", () => {
		const scripts = [
			makeEntry({
				id: "a",
				name: "Alpha",
				inputs: [{ id: "host", type: "string", label: "Hostname" }],
			}),
		];
		const inputs: ScriptInputs = new Map<string, CollectedInput>([
			["host", { value: "example.com" }],
		]);
		const plan = formatExecutionPlan(scripts, inputs);
		expect(plan).toContain("  Hostname: example.com");
	});

	it("formats number input as '  {label}: {value}'", () => {
		const scripts = [
			makeEntry({
				id: "a",
				name: "Alpha",
				inputs: [{ id: "port", type: "number", label: "Port" }],
			}),
		];
		const inputs: ScriptInputs = new Map<string, CollectedInput>([
			["port", { value: "8080" }],
		]);
		const plan = formatExecutionPlan(scripts, inputs);
		expect(plan).toContain("  Port: 8080");
	});

	it("formats multiple inputs for a single script", () => {
		const scripts = [
			makeEntry({
				id: "a",
				name: "Alpha",
				inputs: [
					{ id: "host", type: "string", label: "Hostname" },
					{ id: "port", type: "number", label: "Port" },
				],
			}),
		];
		const inputs: ScriptInputs = new Map<string, CollectedInput>([
			["host", { value: "example.com" }],
			["port", { value: "443" }],
		]);
		const plan = formatExecutionPlan(scripts, inputs);
		expect(plan).toContain("  Hostname: example.com");
		expect(plan).toContain("  Port: 443");
	});
});

// ---------------------------------------------------------------------------
// formatExecutionPlan — ssl-cert formatted with download_path and certCN
// ---------------------------------------------------------------------------

describe("formatExecutionPlan — ssl-cert formatted with download_path and certCN", () => {
	it("formats ssl-cert input as '  {label}: {download_path} ({certCN})'", () => {
		const scripts = [
			makeEntry({
				id: "a",
				name: "Alpha",
				inputs: [
					{
						id: "cert",
						type: "ssl-cert",
						label: "CA Certificate",
						download_path: "/etc/ssl/certs/ca.pem",
					},
				],
			}),
		];
		const inputs: ScriptInputs = new Map<string, CollectedInput>([
			[
				"cert",
				{
					value: "/etc/ssl/certs/ca.pem",
					certCN: "My Root CA",
				},
			],
		]);
		const plan = formatExecutionPlan(scripts, inputs);
		expect(plan).toContain(
			"  CA Certificate: /etc/ssl/certs/ca.pem (My Root CA)",
		);
	});

	it("shows download_path from collected input value for ssl-cert", () => {
		const scripts = [
			makeEntry({
				id: "a",
				name: "Alpha",
				inputs: [
					{
						id: "cert",
						type: "ssl-cert",
						label: "Cert",
						download_path: "/tmp/cert.pem",
					},
				],
			}),
		];
		const inputs: ScriptInputs = new Map<string, CollectedInput>([
			["cert", { value: "/tmp/cert.pem", certCN: "Root" }],
		]);
		const plan = formatExecutionPlan(scripts, inputs);
		expect(plan).toContain("/tmp/cert.pem");
		expect(plan).toContain("Root");
	});
});

// ---------------------------------------------------------------------------
// formatExecutionPlan — scripts with no inputs show only name row
// ---------------------------------------------------------------------------

describe("formatExecutionPlan — scripts with no inputs show only name row", () => {
	it("does not add indented rows for a script with no declared inputs", () => {
		const scripts = [makeEntry({ id: "a", name: "Alpha" })];
		const inputs: ScriptInputs = new Map();
		const plan = formatExecutionPlan(scripts, inputs);
		// No lines starting with two spaces after stripping ANSI
		const lines = plan.split("\n");
		const indentedLines = lines.filter(
			(l) => l.startsWith("  ") && l.trim().length > 0,
		);
		expect(indentedLines).toHaveLength(0);
	});

	it("script with all-blank optional inputs shows only name row", () => {
		const scripts = [
			makeEntry({
				id: "a",
				name: "Alpha",
				inputs: [
					{ id: "opt", type: "string", label: "Option", required: false },
				],
			}),
		];
		const inputs: ScriptInputs = new Map<string, CollectedInput>([
			["opt", { value: "" }],
		]);
		const plan = formatExecutionPlan(scripts, inputs);
		const lines = plan.split("\n");
		const indentedLines = lines.filter(
			(l) => l.startsWith("  ") && l.trim().length > 0,
		);
		expect(indentedLines).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// formatExecutionPlan — footer
// ---------------------------------------------------------------------------

describe("formatExecutionPlan — footer", () => {
	it("includes Y / Enter key binding in footer", () => {
		const scripts = [makeEntry({ id: "a", name: "Alpha" })];
		const inputs: ScriptInputs = new Map();
		const plan = formatExecutionPlan(scripts, inputs);
		expect(plan).toContain("Y / Enter");
		expect(plan).toContain("Run these scripts");
	});

	it("includes N / Esc key binding in footer", () => {
		const scripts = [makeEntry({ id: "a", name: "Alpha" })];
		const inputs: ScriptInputs = new Map();
		const plan = formatExecutionPlan(scripts, inputs);
		expect(plan).toContain("N / Esc");
		expect(plan).toContain("Cancel");
	});
});

// ---------------------------------------------------------------------------
// showConfirmation — confirm returning true → "confirm"
// ---------------------------------------------------------------------------

describe("showConfirmation — confirm returning true", () => {
	it("returns 'confirm' when confirm dep resolves true", async () => {
		const scripts = [makeEntry({ id: "a", name: "Alpha" })];
		const inputs: ScriptInputs = new Map();
		const deps = makeDeps({ confirm: async () => true });
		const result = await showConfirmation(scripts, inputs, deps);
		expect(result).toBe("confirm");
	});
});

// ---------------------------------------------------------------------------
// showConfirmation — confirm returning false → cancel + exit(0)
// ---------------------------------------------------------------------------

describe("showConfirmation — confirm returning false", () => {
	it("calls cancel() and exit(0) when confirm dep resolves false", async () => {
		let cancelCalled = false;
		let exitCode: number | undefined;
		const scripts = [makeEntry({ id: "a", name: "Alpha" })];
		const inputs: ScriptInputs = new Map();
		const deps = makeDeps({
			confirm: async () => false,
			cancel: (_hint?: string) => {
				cancelCalled = true;
			},
			exit: (code: number): never => {
				exitCode = code;
				throw new Error(`exit:${code}`);
			},
		});
		try {
			await showConfirmation(scripts, inputs, deps);
		} catch (err) {
			if (!(err as Error).message.startsWith("exit:")) throw err;
		}
		expect(cancelCalled).toBe(true);
		expect(exitCode).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// showConfirmation — confirm returning cancel symbol → cancel + exit(0)
// ---------------------------------------------------------------------------

describe("showConfirmation — confirm returning cancel symbol", () => {
	it("calls cancel() and exit(0) when confirm dep returns a symbol", async () => {
		const CANCEL = Symbol("cancel");
		let cancelCalled = false;
		let exitCode: number | undefined;
		const scripts = [makeEntry({ id: "a", name: "Alpha" })];
		const inputs: ScriptInputs = new Map();
		const deps = makeDeps({
			confirm: async () => CANCEL,
			isCancel: (val: unknown): val is symbol => val === CANCEL,
			cancel: (_hint?: string) => {
				cancelCalled = true;
			},
			exit: (code: number): never => {
				exitCode = code;
				throw new Error(`exit:${code}`);
			},
		});
		try {
			await showConfirmation(scripts, inputs, deps);
		} catch (err) {
			if (!(err as Error).message.startsWith("exit:")) throw err;
		}
		expect(cancelCalled).toBe(true);
		expect(exitCode).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// showConfirmation — formatExecutionPlan output passed as message to confirm
// ---------------------------------------------------------------------------

describe("showConfirmation — message passed to confirm", () => {
	it("passes formatExecutionPlan output as the message to confirm", async () => {
		const scripts = [
			makeEntry({
				id: "a",
				name: "UniqueScriptName",
				description: "Does stuff",
			}),
		];
		const inputs: ScriptInputs = new Map();
		let capturedMessage: string | undefined;
		const deps = makeDeps({
			confirm: async (opts: { message: string }) => {
				capturedMessage = opts.message;
				return true;
			},
		});
		await showConfirmation(scripts, inputs, deps);
		expect(capturedMessage).toBeDefined();
		expect(capturedMessage).toContain("UniqueScriptName");
		expect(capturedMessage).toContain(
			"The following scripts will run in order:",
		);
	});
});
