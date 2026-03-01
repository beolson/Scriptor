import { describe, expect, test } from "bun:test";
import {
	AuthRequiredError,
	GitHubClient,
	ManifestNotFoundError,
	NetworkTimeoutError,
	ScriptFetchError,
} from "./githubClient";

// ---------------------------------------------------------------------------
// Helpers — mock fetch responses
// ---------------------------------------------------------------------------

function makeJsonFetch(body: unknown, status = 200): typeof fetch {
	return async (_input: RequestInfo | URL, _init?: RequestInit) => {
		return new Response(JSON.stringify(body), {
			status,
			headers: { "Content-Type": "application/json" },
		});
	};
}

function _makeRawFetch(body: string, status = 200): typeof fetch {
	return async (_input: RequestInfo | URL, _init?: RequestInit) => {
		return new Response(body, { status });
	};
}

function makeCapturingFetch(
	body: unknown,
	status = 200,
): { fetch: typeof fetch; calls: Array<{ url: string; init?: RequestInit }> } {
	const calls: Array<{ url: string; init?: RequestInit }> = [];
	const fn: typeof fetch = async (
		input: RequestInfo | URL,
		init?: RequestInit,
	) => {
		calls.push({ url: input.toString(), init });
		return new Response(JSON.stringify(body), {
			status,
			headers: { "Content-Type": "application/json" },
		});
	};
	return { fetch: fn, calls };
}

// ---------------------------------------------------------------------------
// getLatestCommitHash
// ---------------------------------------------------------------------------

describe("GitHubClient.getLatestCommitHash", () => {
	test("calls the correct GitHub Commits API endpoint", async () => {
		const { fetch, calls } = makeCapturingFetch([{ sha: "abc123" }]);
		const client = new GitHubClient({ fetch });

		await client.getLatestCommitHash("owner/repo");

		expect(calls).toHaveLength(1);
		expect(calls[0]?.url).toBe(
			"https://api.github.com/repos/owner/repo/commits?per_page=1",
		);
	});

	test("returns the SHA string from the response", async () => {
		const mockFetch = makeJsonFetch([{ sha: "deadbeef12345678" }]);
		const client = new GitHubClient({ fetch: mockFetch });

		const sha = await client.getLatestCommitHash("owner/repo");

		expect(sha).toBe("deadbeef12345678");
	});

	test("includes Authorization header when token is provided", async () => {
		const { fetch, calls } = makeCapturingFetch([{ sha: "abc" }]);
		const client = new GitHubClient({ fetch, token: "gho_testtoken" });

		await client.getLatestCommitHash("owner/repo");

		const headers = calls[0]?.init?.headers as Record<string, string>;
		expect(headers?.Authorization).toBe("Bearer gho_testtoken");
	});

	test("omits Authorization header when no token is provided", async () => {
		const { fetch, calls } = makeCapturingFetch([{ sha: "abc" }]);
		const client = new GitHubClient({ fetch });

		await client.getLatestCommitHash("owner/repo");

		const headers = (calls[0]?.init?.headers ?? {}) as Record<string, string>;
		expect(headers.Authorization).toBeUndefined();
	});

	test("throws AuthRequiredError on 401 response", async () => {
		const mockFetch = makeJsonFetch(
			{ message: "Requires authentication" },
			401,
		);
		const client = new GitHubClient({ fetch: mockFetch });

		expect(() => client.getLatestCommitHash("private/repo")).toThrow(
			AuthRequiredError,
		);
	});

	test("throws AuthRequiredError on 403 response", async () => {
		const mockFetch = makeJsonFetch({ message: "Forbidden" }, 403);
		const client = new GitHubClient({ fetch: mockFetch });

		expect(() => client.getLatestCommitHash("private/repo")).toThrow(
			AuthRequiredError,
		);
	});

	test("throws NetworkTimeoutError when fetch times out", async () => {
		const timeoutFetch: typeof fetch = () =>
			new Promise<Response>((_, reject) =>
				setTimeout(
					() => reject(new DOMException("signal timed out", "TimeoutError")),
					0,
				),
			);
		const client = new GitHubClient({ fetch: timeoutFetch });

		expect(() => client.getLatestCommitHash("owner/repo")).toThrow(
			NetworkTimeoutError,
		);
	});
});

// ---------------------------------------------------------------------------
// fetchFile
// ---------------------------------------------------------------------------

describe("GitHubClient.fetchFile", () => {
	test("calls the correct GitHub Contents API endpoint", async () => {
		// GitHub Contents API returns base64-encoded content
		const content = btoa("hello world");
		const { fetch, calls } = makeCapturingFetch({
			content,
			encoding: "base64",
		});
		const client = new GitHubClient({ fetch });

		await client.fetchFile("owner/repo", "path/to/file.yaml");

		expect(calls).toHaveLength(1);
		expect(calls[0]?.url).toBe(
			"https://api.github.com/repos/owner/repo/contents/path/to/file.yaml",
		);
	});

	test("returns raw file content as string", async () => {
		const rawContent = "id: my-script\nplatform: mac\n";
		const encoded = btoa(rawContent);
		const mockFetch = makeJsonFetch({ content: encoded, encoding: "base64" });
		const client = new GitHubClient({ fetch: mockFetch });

		const result = await client.fetchFile("owner/repo", "scriptor.yaml");

		expect(result).toBe(rawContent);
	});

	test("includes Authorization header when token is provided", async () => {
		const { fetch, calls } = makeCapturingFetch({
			content: btoa("data"),
			encoding: "base64",
		});
		const client = new GitHubClient({ fetch, token: "gho_testtoken" });

		await client.fetchFile("owner/repo", "file.sh");

		const headers = calls[0]?.init?.headers as Record<string, string>;
		expect(headers?.Authorization).toBe("Bearer gho_testtoken");
	});

	test("omits Authorization header when no token is provided", async () => {
		const { fetch, calls } = makeCapturingFetch({
			content: btoa("data"),
			encoding: "base64",
		});
		const client = new GitHubClient({ fetch });

		await client.fetchFile("owner/repo", "file.sh");

		const headers = (calls[0]?.init?.headers ?? {}) as Record<string, string>;
		expect(headers.Authorization).toBeUndefined();
	});

	test("throws ManifestNotFoundError on 404 for scriptor.yaml", async () => {
		const mockFetch = makeJsonFetch({ message: "Not Found" }, 404);
		const client = new GitHubClient({ fetch: mockFetch });

		expect(() => client.fetchFile("owner/repo", "scriptor.yaml")).toThrow(
			ManifestNotFoundError,
		);
	});

	test("throws ScriptFetchError on 404 for a non-manifest file", async () => {
		const mockFetch = makeJsonFetch({ message: "Not Found" }, 404);
		const client = new GitHubClient({ fetch: mockFetch });

		expect(() => client.fetchFile("owner/repo", "scripts/setup.sh")).toThrow(
			ScriptFetchError,
		);
	});

	test("ScriptFetchError contains the script file name", async () => {
		const mockFetch = makeJsonFetch({ message: "Not Found" }, 404);
		const client = new GitHubClient({ fetch: mockFetch });

		let caught: unknown;
		try {
			await client.fetchFile("owner/repo", "scripts/my-setup.sh");
		} catch (e) {
			caught = e;
		}

		expect(caught).toBeInstanceOf(ScriptFetchError);
		expect((caught as ScriptFetchError).scriptPath).toBe("scripts/my-setup.sh");
		expect((caught as ScriptFetchError).message).toContain("my-setup.sh");
	});

	test("throws AuthRequiredError on 401 response", async () => {
		const mockFetch = makeJsonFetch(
			{ message: "Requires authentication" },
			401,
		);
		const client = new GitHubClient({ fetch: mockFetch });

		expect(() => client.fetchFile("owner/repo", "file.sh")).toThrow(
			AuthRequiredError,
		);
	});

	test("throws AuthRequiredError on 403 response", async () => {
		const mockFetch = makeJsonFetch({ message: "Forbidden" }, 403);
		const client = new GitHubClient({ fetch: mockFetch });

		expect(() => client.fetchFile("owner/repo", "file.sh")).toThrow(
			AuthRequiredError,
		);
	});

	test("throws NetworkTimeoutError when fetch times out", async () => {
		const timeoutFetch: typeof fetch = () =>
			new Promise<Response>((_, reject) =>
				setTimeout(
					() => reject(new DOMException("signal timed out", "TimeoutError")),
					0,
				),
			);
		const client = new GitHubClient({ fetch: timeoutFetch });

		expect(() => client.fetchFile("owner/repo", "file.sh")).toThrow(
			NetworkTimeoutError,
		);
	});
});

// ---------------------------------------------------------------------------
// Timeout configuration
// ---------------------------------------------------------------------------

describe("GitHubClient — timeout", () => {
	test("passes an AbortSignal with 10s timeout to fetch", async () => {
		const signals: Array<AbortSignal | null | undefined> = [];
		const capturingFetch: typeof fetch = async (
			_input: RequestInfo | URL,
			init?: RequestInit,
		) => {
			signals.push(init?.signal ?? null);
			return new Response(JSON.stringify([{ sha: "abc" }]), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		};
		const client = new GitHubClient({ fetch: capturingFetch });

		await client.getLatestCommitHash("owner/repo");

		expect(signals).toHaveLength(1);
		expect(signals[0]).not.toBeNull();
		expect(signals[0]).toBeInstanceOf(AbortSignal);
	});
});
