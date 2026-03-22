import { describe, expect, it } from "bun:test";
import { findGitRoot, LocalRepoError, readLocalManifest } from "./localRepo.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const FAKE_GIT_ROOT = "/home/user/projects/my-repo";
const FAKE_MANIFEST = "scripts:\n  - id: install-git\n";

function makeSpawn(opts: {
	exitCode?: number | null;
	stdout?: string;
	throws?: Error;
}): (cmd: string[]) => Promise<{ exitCode: number | null; stdout: string }> {
	return async (_cmd) => {
		if (opts.throws) throw opts.throws;
		return {
			exitCode: opts.exitCode === undefined ? 0 : opts.exitCode,
			stdout: opts.stdout ?? "",
		};
	};
}

function makeReadFile(opts: {
	content?: string;
	throws?: Error;
}): (path: string) => Promise<string> {
	return async (_path) => {
		if (opts.throws) throw opts.throws;
		return opts.content ?? "";
	};
}

// ---------------------------------------------------------------------------
// findGitRoot
// ---------------------------------------------------------------------------

describe("findGitRoot — success", () => {
	it("returns the trimmed stdout from git rev-parse", async () => {
		const spawn = makeSpawn({
			exitCode: 0,
			stdout: `${FAKE_GIT_ROOT}\n`,
		});
		const result = await findGitRoot({ spawn });
		expect(result).toBe(FAKE_GIT_ROOT);
	});

	it("trims whitespace from the git output", async () => {
		const spawn = makeSpawn({
			exitCode: 0,
			stdout: `  ${FAKE_GIT_ROOT}  \n`,
		});
		const result = await findGitRoot({ spawn });
		expect(result).toBe(FAKE_GIT_ROOT);
	});
});

describe("findGitRoot — not in a git repo", () => {
	it("throws LocalRepoError when exit code is non-zero", async () => {
		const spawn = makeSpawn({ exitCode: 128, stdout: "" });
		await expect(findGitRoot({ spawn })).rejects.toThrow(LocalRepoError);
	});

	it("throws LocalRepoError when exit code is null", async () => {
		const spawn = makeSpawn({ exitCode: null, stdout: "" });
		await expect(findGitRoot({ spawn })).rejects.toThrow(LocalRepoError);
	});

	it("includes a descriptive message when not in a git repo", async () => {
		const spawn = makeSpawn({ exitCode: 128, stdout: "" });
		await expect(findGitRoot({ spawn })).rejects.toThrow(
			"Not inside a git repository",
		);
	});
});

describe("findGitRoot — spawn throws", () => {
	it("wraps the spawn error in a LocalRepoError", async () => {
		const spawn = makeSpawn({ throws: new Error("git not found") });
		await expect(findGitRoot({ spawn })).rejects.toThrow(LocalRepoError);
	});

	it("includes the original error message", async () => {
		const spawn = makeSpawn({ throws: new Error("git not found") });
		await expect(findGitRoot({ spawn })).rejects.toThrow("git not found");
	});
});

// ---------------------------------------------------------------------------
// readLocalManifest
// ---------------------------------------------------------------------------

describe("readLocalManifest — success", () => {
	it("returns the manifest content", async () => {
		const spawn = makeSpawn({ exitCode: 0, stdout: `${FAKE_GIT_ROOT}\n` });
		const readFile = makeReadFile({ content: FAKE_MANIFEST });
		const result = await readLocalManifest({ spawn, readFile });
		expect(result.manifest).toBe(FAKE_MANIFEST);
	});

	it("returns the git root", async () => {
		const spawn = makeSpawn({ exitCode: 0, stdout: `${FAKE_GIT_ROOT}\n` });
		const readFile = makeReadFile({ content: FAKE_MANIFEST });
		const result = await readLocalManifest({ spawn, readFile });
		expect(result.gitRoot).toBe(FAKE_GIT_ROOT);
	});

	it("reads scriptor.yaml from the git root path", async () => {
		const spawn = makeSpawn({ exitCode: 0, stdout: `${FAKE_GIT_ROOT}\n` });
		const readPaths: string[] = [];
		const readFile = async (path: string) => {
			readPaths.push(path);
			return FAKE_MANIFEST;
		};
		await readLocalManifest({ spawn, readFile });
		expect(readPaths[0]).toBe(`${FAKE_GIT_ROOT}/scriptor.yaml`);
	});
});

describe("readLocalManifest — not in a git repo", () => {
	it("throws LocalRepoError when git root cannot be found", async () => {
		const spawn = makeSpawn({ exitCode: 128, stdout: "" });
		const readFile = makeReadFile({ content: FAKE_MANIFEST });
		await expect(readLocalManifest({ spawn, readFile })).rejects.toThrow(
			LocalRepoError,
		);
	});
});

describe("readLocalManifest — scriptor.yaml missing", () => {
	it("throws LocalRepoError when scriptor.yaml is not found", async () => {
		const spawn = makeSpawn({ exitCode: 0, stdout: `${FAKE_GIT_ROOT}\n` });
		const readFile = makeReadFile({
			throws: new LocalRepoError("File not found"),
		});
		await expect(readLocalManifest({ spawn, readFile })).rejects.toThrow(
			LocalRepoError,
		);
	});

	it("includes git root in the error message", async () => {
		const spawn = makeSpawn({ exitCode: 0, stdout: `${FAKE_GIT_ROOT}\n` });
		const readFile = makeReadFile({
			throws: new LocalRepoError("File not found"),
		});
		await expect(readLocalManifest({ spawn, readFile })).rejects.toThrow(
			FAKE_GIT_ROOT,
		);
	});
});
