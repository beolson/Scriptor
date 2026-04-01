import { describe, expect, it } from "bun:test";
import { fetchContent } from "./githubClient.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type FetchResponse = {
	ok: boolean;
	status: number;
	text: () => Promise<string>;
};

function makeResponse(status: number, body: string): FetchResponse {
	return {
		ok: status >= 200 && status < 300,
		status,
		text: async () => body,
	};
}

function makeFetchFn(responses: FetchResponse[]): {
	calls: Array<{ url: string; init: RequestInit }>;
	fn: (url: string, init: RequestInit) => Promise<FetchResponse>;
} {
	const calls: Array<{ url: string; init: RequestInit }> = [];
	let index = 0;
	return {
		calls,
		fn: async (url: string, init: RequestInit) => {
			calls.push({ url, init });
			const response = responses[index];
			index++;
			if (!response) throw new Error("No more mock responses");
			return response;
		},
	};
}

function _makeThrowingFetchFn(
	error: Error,
	succeedAfter?: FetchResponse,
): {
	calls: number;
	fn: (url: string, init: RequestInit) => Promise<FetchResponse>;
} {
	let calls = 0;
	let count = 0;
	return {
		get calls() {
			return calls;
		},
		fn: async (_url: string, _init: RequestInit) => {
			calls++;
			count++;
			if (succeedAfter && count > 1) return succeedAfter;
			throw error;
		},
	};
}

const REPO = "owner/repo";
const TOKEN = "ghp_test_token";
const PATH = "scriptor.yaml";

// ---------------------------------------------------------------------------
// Successful 200 response
// ---------------------------------------------------------------------------

describe("fetchContent — success", () => {
	it("returns the response body string on 200", async () => {
		const { fn } = makeFetchFn([makeResponse(200, "manifest content")]);
		const result = await fetchContent(PATH, REPO, TOKEN, {
			fetchFn: fn as never,
			runDeviceFlowFn: async () => "new_token",
			setTokenFn: () => {},
			sleepFn: async () => {},
		});
		expect(result).toBe("manifest content");
	});

	it("includes Accept: application/vnd.github.raw+json header", async () => {
		const { fn, calls } = makeFetchFn([makeResponse(200, "ok")]);
		await fetchContent(PATH, REPO, TOKEN, {
			fetchFn: fn as never,
			runDeviceFlowFn: async () => "new_token",
			setTokenFn: () => {},
			sleepFn: async () => {},
		});
		const headers = calls[0]?.init?.headers as Record<string, string>;
		expect(headers?.Accept).toBe("application/vnd.github.raw+json");
	});

	it("includes Authorization: Bearer <token> when token is provided", async () => {
		const { fn, calls } = makeFetchFn([makeResponse(200, "ok")]);
		await fetchContent(PATH, REPO, "my_token", {
			fetchFn: fn as never,
			runDeviceFlowFn: async () => "new_token",
			setTokenFn: () => {},
			sleepFn: async () => {},
		});
		const headers = calls[0]?.init?.headers as Record<string, string>;
		expect(headers?.Authorization).toBe("Bearer my_token");
	});

	it("omits Authorization header when token is undefined", async () => {
		const { fn, calls } = makeFetchFn([makeResponse(200, "ok")]);
		await fetchContent(PATH, REPO, undefined, {
			fetchFn: fn as never,
			runDeviceFlowFn: async () => "new_token",
			setTokenFn: () => {},
			sleepFn: async () => {},
		});
		const headers = calls[0]?.init?.headers as Record<string, string>;
		expect(headers?.Authorization).toBeUndefined();
	});

	it("builds the correct URL with owner, repo name, and path", async () => {
		const { fn, calls } = makeFetchFn([makeResponse(200, "ok")]);
		await fetchContent("scripts/foo.sh", "myowner/myrepo", TOKEN, {
			fetchFn: fn as never,
			runDeviceFlowFn: async () => "new_token",
			setTokenFn: () => {},
			sleepFn: async () => {},
		});
		expect(calls[0]?.url).toBe(
			"https://api.github.com/repos/myowner/myrepo/contents/scripts/foo.sh",
		);
	});
});

// ---------------------------------------------------------------------------
// Retry logic on network errors
// ---------------------------------------------------------------------------

describe("fetchContent — retry on network failure", () => {
	it("retries after a network error and succeeds on second attempt", async () => {
		let callCount = 0;
		const fn = async (_url: string, _init: RequestInit) => {
			callCount++;
			if (callCount === 1) throw new Error("Network error");
			return makeResponse(200, "success after retry");
		};
		const sleepDelays: number[] = [];
		const result = await fetchContent(PATH, REPO, TOKEN, {
			fetchFn: fn as never,
			runDeviceFlowFn: async () => "new_token",
			setTokenFn: () => {},
			sleepFn: async (ms: number) => {
				sleepDelays.push(ms);
			},
		});
		expect(result).toBe("success after retry");
		expect(callCount).toBe(2);
		expect(sleepDelays[0]).toBe(1000);
	});

	it("uses delay sequence [1000, 2000, 4000] ms between retries", async () => {
		let callCount = 0;
		const fn = async (_url: string, _init: RequestInit) => {
			callCount++;
			if (callCount < 4) throw new Error("Network error");
			return makeResponse(200, "ok");
		};
		const sleepDelays: number[] = [];
		await fetchContent(PATH, REPO, TOKEN, {
			fetchFn: fn as never,
			runDeviceFlowFn: async () => "new_token",
			setTokenFn: () => {},
			sleepFn: async (ms: number) => {
				sleepDelays.push(ms);
			},
		});
		expect(sleepDelays).toEqual([1000, 2000, 4000]);
	});

	it("throws after three consecutive network failures", async () => {
		const fn = async (_url: string, _init: RequestInit) => {
			throw new Error("Network error");
		};
		await expect(
			fetchContent(PATH, REPO, TOKEN, {
				fetchFn: fn as never,
				runDeviceFlowFn: async () => "new_token",
				setTokenFn: () => {},
				sleepFn: async () => {},
			}),
		).rejects.toThrow();
	});

	it("calls fetch exactly 4 times total (1 initial + 3 retries) before throwing", async () => {
		let callCount = 0;
		const fn = async (_url: string, _init: RequestInit) => {
			callCount++;
			throw new Error("Network error");
		};
		await expect(
			fetchContent(PATH, REPO, TOKEN, {
				fetchFn: fn as never,
				runDeviceFlowFn: async () => "new_token",
				setTokenFn: () => {},
				sleepFn: async () => {},
			}),
		).rejects.toThrow();
		expect(callCount).toBe(4);
	});
});

// ---------------------------------------------------------------------------
// Auth handling — 401 response
// ---------------------------------------------------------------------------

describe("fetchContent — 401 triggers re-auth", () => {
	it("calls runDeviceFlowFn on 401 response", async () => {
		let devFlowCalled = false;
		const { fn } = makeFetchFn([
			makeResponse(401, "Unauthorized"),
			makeResponse(200, "ok after auth"),
		]);
		await fetchContent(PATH, REPO, TOKEN, {
			fetchFn: fn as never,
			runDeviceFlowFn: async () => {
				devFlowCalled = true;
				return "new_token";
			},
			setTokenFn: () => {},
			sleepFn: async () => {},
		});
		expect(devFlowCalled).toBe(true);
	});

	it("stores new token via setTokenFn after re-auth on 401", async () => {
		const storedTokens: string[] = [];
		const { fn } = makeFetchFn([
			makeResponse(401, "Unauthorized"),
			makeResponse(200, "ok"),
		]);
		await fetchContent(PATH, REPO, TOKEN, {
			fetchFn: fn as never,
			runDeviceFlowFn: async () => "fresh_token",
			setTokenFn: (t: string) => {
				storedTokens.push(t);
			},
			sleepFn: async () => {},
		});
		expect(storedTokens).toContain("fresh_token");
	});

	it("retries the request with the new token after re-auth on 401", async () => {
		const { fn, calls } = makeFetchFn([
			makeResponse(401, "Unauthorized"),
			makeResponse(200, "ok"),
		]);
		await fetchContent(PATH, REPO, TOKEN, {
			fetchFn: fn as never,
			runDeviceFlowFn: async () => "new_bearer_token",
			setTokenFn: () => {},
			sleepFn: async () => {},
		});
		// Second call should use the new token
		const secondCallHeaders = calls[1]?.init?.headers as Record<string, string>;
		expect(secondCallHeaders?.Authorization).toBe("Bearer new_bearer_token");
	});

	it("returns the body string after successful re-auth retry on 401", async () => {
		const { fn } = makeFetchFn([
			makeResponse(401, "Unauthorized"),
			makeResponse(200, "body after reauth"),
		]);
		const result = await fetchContent(PATH, REPO, TOKEN, {
			fetchFn: fn as never,
			runDeviceFlowFn: async () => "new_token",
			setTokenFn: () => {},
			sleepFn: async () => {},
		});
		expect(result).toBe("body after reauth");
	});

	it("throws when re-auth retry also returns 401", async () => {
		const { fn } = makeFetchFn([
			makeResponse(401, "Unauthorized"),
			makeResponse(401, "Still unauthorized"),
		]);
		await expect(
			fetchContent(PATH, REPO, TOKEN, {
				fetchFn: fn as never,
				runDeviceFlowFn: async () => "new_token",
				setTokenFn: () => {},
				sleepFn: async () => {},
			}),
		).rejects.toThrow();
	});
});

// ---------------------------------------------------------------------------
// Auth handling — 403 response
// ---------------------------------------------------------------------------

describe("fetchContent — 403 triggers re-auth", () => {
	it("calls runDeviceFlowFn on 403 response", async () => {
		let devFlowCalled = false;
		const { fn } = makeFetchFn([
			makeResponse(403, "Forbidden"),
			makeResponse(200, "ok"),
		]);
		await fetchContent(PATH, REPO, TOKEN, {
			fetchFn: fn as never,
			runDeviceFlowFn: async () => {
				devFlowCalled = true;
				return "new_token";
			},
			setTokenFn: () => {},
			sleepFn: async () => {},
		});
		expect(devFlowCalled).toBe(true);
	});

	it("returns the body string after successful re-auth retry on 403", async () => {
		const { fn } = makeFetchFn([
			makeResponse(403, "Forbidden"),
			makeResponse(200, "body after 403 reauth"),
		]);
		const result = await fetchContent(PATH, REPO, TOKEN, {
			fetchFn: fn as never,
			runDeviceFlowFn: async () => "new_token",
			setTokenFn: () => {},
			sleepFn: async () => {},
		});
		expect(result).toBe("body after 403 reauth");
	});

	it("throws when re-auth retry also fails on 403", async () => {
		const { fn } = makeFetchFn([
			makeResponse(403, "Forbidden"),
			makeResponse(403, "Still forbidden"),
		]);
		await expect(
			fetchContent(PATH, REPO, TOKEN, {
				fetchFn: fn as never,
				runDeviceFlowFn: async () => "new_token",
				setTokenFn: () => {},
				sleepFn: async () => {},
			}),
		).rejects.toThrow();
	});
});

// ---------------------------------------------------------------------------
// Auth handling — 404 response
// ---------------------------------------------------------------------------

describe("fetchContent — 404 behavior", () => {
	it("triggers re-auth flow on 404 when no token present", async () => {
		let devFlowCalled = false;
		const { fn } = makeFetchFn([
			makeResponse(404, "Not Found"),
			makeResponse(200, "ok after auth"),
		]);
		await fetchContent(PATH, REPO, undefined, {
			fetchFn: fn as never,
			runDeviceFlowFn: async () => {
				devFlowCalled = true;
				return "new_token";
			},
			setTokenFn: () => {},
			sleepFn: async () => {},
		});
		expect(devFlowCalled).toBe(true);
	});

	it("throws immediately on 404 when a token is present (no retry, no re-auth)", async () => {
		let devFlowCalled = false;
		let callCount = 0;
		const fn = async (_url: string, _init: RequestInit) => {
			callCount++;
			return makeResponse(404, "Not Found");
		};
		await expect(
			fetchContent(PATH, REPO, TOKEN, {
				fetchFn: fn as never,
				runDeviceFlowFn: async () => {
					devFlowCalled = true;
					return "new_token";
				},
				setTokenFn: () => {},
				sleepFn: async () => {},
			}),
		).rejects.toThrow();
		expect(devFlowCalled).toBe(false);
		expect(callCount).toBe(1);
	});
});
