import { describe, expect, it } from "vitest";
import { loadVersion } from "./loadVersion.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReadFile(content: string): () => Promise<string> {
	return () => Promise.resolve(content);
}

function makeFailingReadFile(
	message = "ENOENT: no such file",
): () => Promise<string> {
	return () => Promise.reject(new Error(message));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("loadVersion", () => {
	it("returns the version string from a valid package.json", async () => {
		const readFile = makeReadFile(
			JSON.stringify({ name: "scriptor-web", version: "1.2.3" }),
		);
		const result = await loadVersion({ readFile });
		expect(result).toBe("1.2.3");
	});

	it("returns undefined when the version field is missing", async () => {
		const readFile = makeReadFile(JSON.stringify({ name: "scriptor-web" }));
		const result = await loadVersion({ readFile });
		expect(result).toBeUndefined();
	});

	it("returns undefined when the version field is not a string", async () => {
		const readFile = makeReadFile(
			JSON.stringify({ name: "scriptor-web", version: 123 }),
		);
		const result = await loadVersion({ readFile });
		expect(result).toBeUndefined();
	});

	it("returns undefined when version is an empty string", async () => {
		const readFile = makeReadFile(
			JSON.stringify({ name: "scriptor-web", version: "" }),
		);
		const result = await loadVersion({ readFile });
		expect(result).toBeUndefined();
	});

	it("returns undefined when the file is missing", async () => {
		const readFile = makeFailingReadFile("ENOENT: no such file or directory");
		const result = await loadVersion({ readFile });
		expect(result).toBeUndefined();
	});

	it("returns undefined when the JSON is malformed", async () => {
		const readFile = makeReadFile("{ this is not valid json }");
		const result = await loadVersion({ readFile });
		expect(result).toBeUndefined();
	});

	it("returns undefined when the file content is a JSON array (not an object)", async () => {
		const readFile = makeReadFile(JSON.stringify(["not", "an", "object"]));
		const result = await loadVersion({ readFile });
		expect(result).toBeUndefined();
	});

	it("returns version string from a package.json with many fields", async () => {
		const pkg = {
			name: "scriptor-web",
			version: "0.2.5",
			private: true,
			dependencies: { react: "^19.0.0" },
		};
		const readFile = makeReadFile(JSON.stringify(pkg));
		const result = await loadVersion({ readFile });
		expect(result).toBe("0.2.5");
	});
});
