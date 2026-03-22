import { describe, expect, it } from "bun:test";
import type { Repo } from "../repo/types.js";
import type { GitHubClientDeps } from "./githubClient.js";
import {
	AuthRequired,
	downloadBinary,
	fetchLatestRelease,
	fetchManifest,
	NetworkError,
} from "./githubClient.js";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const REPO: Repo = { owner: "beolson", name: "Scriptor" };
const MANIFEST_YAML =
	"scripts:\n  - id: test\n    platform: linux\n    arch: x86\n";
const RELEASE_TAG = "v1.2.3";
const RELEASE_ASSET_URL =
	"https://github.com/beolson/Scriptor/releases/download/v1.2.3/scriptor-linux-x64";

// ---------------------------------------------------------------------------
// Fake fetch helpers
// ---------------------------------------------------------------------------

function makeOkFetch(
	body: string,
	contentType = "text/plain",
): GitHubClientDeps["fetch"] {
	return async (_url: string, _init?: RequestInit) => {
		return new Response(body, {
			status: 200,
			headers: { "Content-Type": contentType },
		});
	};
}

function makeStatusFetch(status: number): GitHubClientDeps["fetch"] {
	return async (_url: string, _init?: RequestInit) => {
		return new Response("", { status });
	};
}

function makeThrowingFetch(message: string): GitHubClientDeps["fetch"] {
	return async (_url: string, _init?: RequestInit) => {
		throw new Error(message);
	};
}

function makeReleaseFetch(
	tag: string,
	assets: Array<{ name: string; browser_download_url: string }>,
): GitHubClientDeps["fetch"] {
	const body = JSON.stringify({ tag_name: tag, assets });
	return async (_url: string, _init?: RequestInit) => {
		return new Response(body, {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	};
}

function makeBinaryFetch(bytes: Uint8Array): GitHubClientDeps["fetch"] {
	return async (_url: string, _init?: RequestInit) => {
		return new Response(bytes, {
			status: 200,
			headers: { "Content-Type": "application/octet-stream" },
		});
	};
}

// ---------------------------------------------------------------------------
// fetchManifest — success
// ---------------------------------------------------------------------------

describe("fetchManifest — success", () => {
	it("returns raw YAML string on 200", async () => {
		const fakeFetch = makeOkFetch(MANIFEST_YAML);
		const result = await fetchManifest(REPO, undefined, { fetch: fakeFetch });
		expect(result).toBe(MANIFEST_YAML);
	});

	it("fetches from the GitHub Contents API URL", async () => {
		let capturedUrl = "";
		const fakeFetch: GitHubClientDeps["fetch"] = async (url, _init) => {
			capturedUrl = url as string;
			return new Response(MANIFEST_YAML, { status: 200 });
		};
		await fetchManifest(REPO, undefined, { fetch: fakeFetch });
		expect(capturedUrl).toContain("api.github.com");
		expect(capturedUrl).toContain("beolson");
		expect(capturedUrl).toContain("Scriptor");
		expect(capturedUrl).toContain("scriptor.yaml");
	});

	it("sends Authorization header when token is provided", async () => {
		let capturedHeaders: Record<string, string> = {};
		const fakeFetch: GitHubClientDeps["fetch"] = async (_url, init) => {
			capturedHeaders = (init?.headers ?? {}) as Record<string, string>;
			return new Response(MANIFEST_YAML, { status: 200 });
		};
		await fetchManifest(REPO, "gho_testtoken", { fetch: fakeFetch });
		expect(capturedHeaders.Authorization).toContain("gho_testtoken");
	});

	it("does not send Authorization header when no token provided", async () => {
		let capturedHeaders: Record<string, string> = {};
		const fakeFetch: GitHubClientDeps["fetch"] = async (_url, init) => {
			capturedHeaders = (init?.headers ?? {}) as Record<string, string>;
			return new Response(MANIFEST_YAML, { status: 200 });
		};
		await fetchManifest(REPO, undefined, { fetch: fakeFetch });
		expect(capturedHeaders.Authorization).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// fetchManifest — auth errors
// ---------------------------------------------------------------------------

describe("fetchManifest — auth errors", () => {
	it("throws AuthRequired on 401", async () => {
		const fakeFetch = makeStatusFetch(401);
		await expect(
			fetchManifest(REPO, undefined, { fetch: fakeFetch }),
		).rejects.toBeInstanceOf(AuthRequired);
	});

	it("throws AuthRequired on 403", async () => {
		const fakeFetch = makeStatusFetch(403);
		await expect(
			fetchManifest(REPO, undefined, { fetch: fakeFetch }),
		).rejects.toBeInstanceOf(AuthRequired);
	});

	it("throws AuthRequired on 404 when no token provided (private repo)", async () => {
		const fakeFetch = makeStatusFetch(404);
		await expect(
			fetchManifest(REPO, undefined, { fetch: fakeFetch }),
		).rejects.toBeInstanceOf(AuthRequired);
	});
});

// ---------------------------------------------------------------------------
// fetchManifest — network / other errors
// ---------------------------------------------------------------------------

describe("fetchManifest — network errors", () => {
	it("throws NetworkError when fetch throws", async () => {
		const fakeFetch = makeThrowingFetch("Failed to fetch");
		await expect(
			fetchManifest(REPO, undefined, { fetch: fakeFetch }),
		).rejects.toBeInstanceOf(NetworkError);
	});

	it("throws NetworkError on 404 when a token is provided (manifest genuinely missing)", async () => {
		const fakeFetch = makeStatusFetch(404);
		await expect(
			fetchManifest(REPO, "gho_testtoken", { fetch: fakeFetch }),
		).rejects.toBeInstanceOf(NetworkError);
	});

	it("includes the fetched URL in the NetworkError message on 404 with token", async () => {
		const fakeFetch = makeStatusFetch(404);
		let error: Error | undefined;
		try {
			await fetchManifest(REPO, "gho_testtoken", { fetch: fakeFetch });
		} catch (e) {
			error = e as Error;
		}
		expect(error?.message).toContain("beolson");
		expect(error?.message).toContain("Scriptor");
		expect(error?.message).toContain("scriptor.yaml");
	});

	it("throws NetworkError on 500", async () => {
		const fakeFetch = makeStatusFetch(500);
		await expect(
			fetchManifest(REPO, undefined, { fetch: fakeFetch }),
		).rejects.toBeInstanceOf(NetworkError);
	});
});

// ---------------------------------------------------------------------------
// fetchLatestRelease — success
// ---------------------------------------------------------------------------

describe("fetchLatestRelease — success", () => {
	it("returns the tag and assets on 200", async () => {
		const assets = [
			{ name: "scriptor-linux-x64", browser_download_url: RELEASE_ASSET_URL },
			{
				name: "scriptor-darwin-arm64",
				browser_download_url: "https://example.com/darwin",
			},
		];
		const fakeFetch = makeReleaseFetch(RELEASE_TAG, assets);
		const result = await fetchLatestRelease({ fetch: fakeFetch });
		expect(result.tag).toBe(RELEASE_TAG);
		expect(result.assets).toHaveLength(2);
		expect(result.assets[0]).toEqual({
			name: "scriptor-linux-x64",
			downloadUrl: RELEASE_ASSET_URL,
		});
	});

	it("fetches from the beolson/Scriptor release endpoint", async () => {
		let capturedUrl = "";
		const fakeFetch: GitHubClientDeps["fetch"] = async (url, _init) => {
			capturedUrl = url as string;
			return new Response(JSON.stringify({ tag_name: "v1.0.0", assets: [] }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		};
		await fetchLatestRelease({ fetch: fakeFetch });
		expect(capturedUrl).toContain("beolson");
		expect(capturedUrl).toContain("Scriptor");
		expect(capturedUrl).toContain("releases");
		expect(capturedUrl).toContain("latest");
	});
});

// ---------------------------------------------------------------------------
// fetchLatestRelease — errors
// ---------------------------------------------------------------------------

describe("fetchLatestRelease — errors", () => {
	it("throws NetworkError when fetch throws", async () => {
		const fakeFetch = makeThrowingFetch("network error");
		await expect(
			fetchLatestRelease({ fetch: fakeFetch }),
		).rejects.toBeInstanceOf(NetworkError);
	});

	it("throws NetworkError on non-2xx response", async () => {
		const fakeFetch = makeStatusFetch(503);
		await expect(
			fetchLatestRelease({ fetch: fakeFetch }),
		).rejects.toBeInstanceOf(NetworkError);
	});
});

// ---------------------------------------------------------------------------
// downloadBinary — success
// ---------------------------------------------------------------------------

describe("downloadBinary — success", () => {
	it("writes bytes to the destination path", async () => {
		const bytes = new Uint8Array([0x7f, 0x45, 0x4c, 0x46]); // ELF magic
		const fakeFetch = makeBinaryFetch(bytes);

		const written = new Map<string, Uint8Array>();
		const fakeWrite: GitHubClientDeps["writeFile"] = async (path, data) => {
			written.set(
				path,
				data instanceof Uint8Array
					? data
					: new Uint8Array(await new Response(data).arrayBuffer()),
			);
		};

		await downloadBinary(RELEASE_ASSET_URL, "/tmp/scriptor.new", {
			fetch: fakeFetch,
			writeFile: fakeWrite,
		});

		expect(written.has("/tmp/scriptor.new")).toBe(true);
		// biome-ignore lint/style/noNonNullAssertion: we just asserted it exists
		const writtenBytes = written.get("/tmp/scriptor.new")!;
		expect(writtenBytes[0]).toBe(0x7f);
		expect(writtenBytes[1]).toBe(0x45);
	});

	it("fetches the binary from the provided URL", async () => {
		let capturedUrl = "";
		const fakeFetch: GitHubClientDeps["fetch"] = async (url, _init) => {
			capturedUrl = url as string;
			return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
		};
		const fakeWrite: GitHubClientDeps["writeFile"] = async (_path, _data) => {};

		await downloadBinary(RELEASE_ASSET_URL, "/tmp/out", {
			fetch: fakeFetch,
			writeFile: fakeWrite,
		});
		expect(capturedUrl).toBe(RELEASE_ASSET_URL);
	});
});

// ---------------------------------------------------------------------------
// downloadBinary — errors
// ---------------------------------------------------------------------------

describe("downloadBinary — errors", () => {
	it("throws NetworkError when fetch throws", async () => {
		const fakeFetch = makeThrowingFetch("connection refused");
		const fakeWrite: GitHubClientDeps["writeFile"] = async (_path, _data) => {};
		await expect(
			downloadBinary(RELEASE_ASSET_URL, "/tmp/out", {
				fetch: fakeFetch,
				writeFile: fakeWrite,
			}),
		).rejects.toBeInstanceOf(NetworkError);
	});

	it("throws NetworkError on non-2xx response", async () => {
		const fakeFetch = makeStatusFetch(404);
		const fakeWrite: GitHubClientDeps["writeFile"] = async (_path, _data) => {};
		await expect(
			downloadBinary(RELEASE_ASSET_URL, "/tmp/out", {
				fetch: fakeFetch,
				writeFile: fakeWrite,
			}),
		).rejects.toBeInstanceOf(NetworkError);
	});
});

// ---------------------------------------------------------------------------
// AuthRequired / NetworkError — custom error class checks
// ---------------------------------------------------------------------------

describe("AuthRequired error", () => {
	it("is an instance of Error", () => {
		const err = new AuthRequired(401);
		expect(err).toBeInstanceOf(Error);
	});

	it("exposes the HTTP status code", () => {
		const err = new AuthRequired(403);
		expect(err.status).toBe(403);
	});

	it("has a descriptive message", () => {
		const err = new AuthRequired(401);
		expect(err.message).toContain("401");
	});
});

describe("NetworkError error", () => {
	it("is an instance of Error", () => {
		const err = new NetworkError("timed out");
		expect(err).toBeInstanceOf(Error);
	});

	it("preserves the message", () => {
		const err = new NetworkError("connection reset");
		expect(err.message).toContain("connection reset");
	});
});
