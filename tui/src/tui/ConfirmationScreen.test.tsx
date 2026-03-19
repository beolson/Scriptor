import { describe, expect, test } from "bun:test";
import { renderToString } from "ink";
import type { CollectedInput, ScriptInputs } from "../inputs/inputSchema.js";
import type { ScriptEntry } from "../manifest/parseManifest.js";
import { ConfirmationScreen } from "./ConfirmationScreen.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeScript(
	id: string,
	name: string,
	description = "A script",
): ScriptEntry {
	return {
		id,
		name,
		description,
		platform: "linux",
		arch: "x86",
		script: "echo hi",
		dependencies: [],
		run_after: [],
		inputs: [],
		distro: "ubuntu",
		version: "24.04",
		requires_sudo: false,
		requires_admin: false,
	};
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ConfirmationScreen", () => {
	// Test 1: script with a string input shows `label: value` in the
	// confirmation list
	test("script with a string input shows label: value", () => {
		const script = makeScript("script-a", "Deploy Script");

		const inputs: CollectedInput[] = [
			{ id: "username", label: "GitHub Username", value: "octocat" },
		];
		const scriptInputs: ScriptInputs = new Map([["script-a", inputs]]);

		const output = renderToString(
			<ConfirmationScreen
				scripts={[script]}
				scriptInputs={scriptInputs}
				onConfirm={() => {}}
				onBack={() => {}}
			/>,
		);

		expect(output).toContain("Deploy Script");
		expect(output).toContain("GitHub Username");
		expect(output).toContain("octocat");
	});

	// Test 2: script with an ssl-cert input shows download path and cert CN
	test("script with ssl-cert input shows download path and cert CN", () => {
		const script = makeScript("script-a", "Cert Script");

		const inputs: CollectedInput[] = [
			{
				id: "cert",
				label: "TLS Certificate",
				value: "/tmp/my-cert.pem",
				certCN: "example.com",
			},
		];
		const scriptInputs: ScriptInputs = new Map([["script-a", inputs]]);

		const output = renderToString(
			<ConfirmationScreen
				scripts={[script]}
				scriptInputs={scriptInputs}
				onConfirm={() => {}}
				onBack={() => {}}
			/>,
		);

		expect(output).toContain("Cert Script");
		expect(output).toContain("/tmp/my-cert.pem");
		expect(output).toContain("example.com");
	});

	// Test 3: script with no inputs renders unchanged (no input section shown)
	test("script with no inputs renders unchanged", () => {
		const script = makeScript("script-a", "Plain Script");
		const scriptInputs: ScriptInputs = new Map();

		const output = renderToString(
			<ConfirmationScreen
				scripts={[script]}
				scriptInputs={scriptInputs}
				onConfirm={() => {}}
				onBack={() => {}}
			/>,
		);

		expect(output).toContain("Plain Script");
		// Should not contain any input-related label text beyond the script name
		expect(output).not.toContain("label:");
	});

	// Test 4: multiple scripts each show their own inputs under their
	// respective names
	test("multiple scripts each show their own inputs", () => {
		const scriptA = makeScript("script-a", "Script A");
		const scriptB = makeScript("script-b", "Script B");

		const inputsA: CollectedInput[] = [
			{ id: "username", label: "Username", value: "alice" },
		];
		const inputsB: CollectedInput[] = [
			{ id: "port", label: "Port", value: "8080" },
		];
		const scriptInputs: ScriptInputs = new Map([
			["script-a", inputsA],
			["script-b", inputsB],
		]);

		const output = renderToString(
			<ConfirmationScreen
				scripts={[scriptA, scriptB]}
				scriptInputs={scriptInputs}
				onConfirm={() => {}}
				onBack={() => {}}
			/>,
		);

		expect(output).toContain("Script A");
		expect(output).toContain("Username");
		expect(output).toContain("alice");
		expect(output).toContain("Script B");
		expect(output).toContain("Port");
		expect(output).toContain("8080");
	});
});
