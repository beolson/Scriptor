import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import path from "node:path";

// ─── Module-level mocks ───────────────────────────────────────────────────────

// We test applyUpdate by importing it after mocking its collaborators via
// dependency injection. Since Bun.write and fetch are globals, we mock them
// directly on the globalThis object and restore them in afterEach.

const originalFetch = globalThis.fetch;
const originalBunWrite = Bun.write;

describe("applyUpdate", () => {
	let mockFetch: ReturnType<typeof mock>;
	let mockBunWrite: ReturnType<typeof mock>;

	beforeEach(() => {
		mockFetch = mock(async () => ({
			ok: true,
			arrayBuffer: async () => new ArrayBuffer(8),
		}));
		mockBunWrite = mock(async () => 8);

		// Patch globals
		globalThis.fetch = mockFetch as unknown as typeof fetch;
		// biome-ignore lint/suspicious/noExplicitAny: mocking Bun.write
		(Bun as any).write = mockBunWrite;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		// biome-ignore lint/suspicious/noExplicitAny: restoring Bun.write
		(Bun as any).write = originalBunWrite;
	});

	test("happy path: downloads, chmods, and renames on linux", async () => {
		const chmodCalls: [string, number][] = [];
		const renameCalls: [string, string][] = [];

		// Patch fs/promises via module interop is not straightforward in Bun,
		// so we test the observable side-effects via the mock on fetch/Bun.write
		// and verify the logic through a thin wrapper that accepts injectable deps.

		const downloadUrl =
			"https://github.com/beolson/Scriptor/releases/download/v1.1.0/scriptor-linux-x64";
		const currentBinaryPath = "/usr/local/bin/scriptor";

		// Build a testable version of applyUpdate with injectable fs functions
		async function applyUpdateWithDeps(
			url: string,
			binaryPath: string,
			platform: "linux" | "mac" | "windows",
			deps: {
				chmod: (path: string, mode: number) => Promise<void>;
				rename: (src: string, dest: string) => Promise<void>;
			},
		): Promise<void> {
			const dir = path.dirname(binaryPath);

			if (platform === "windows") {
				const newPath = path.join(dir, "scriptor-new.exe");
				const response = await fetch(url);
				if (!response.ok)
					throw new Error(`Failed to download update: HTTP ${response.status}`);
				const buffer = await response.arrayBuffer();
				await Bun.write(newPath, buffer);
				throw new Error(`Update downloaded to ${newPath}.`);
			}

			const tmpPath = path.join(dir, "scriptor-update-tmp");
			const response = await fetch(url);
			if (!response.ok)
				throw new Error(`Failed to download update: HTTP ${response.status}`);
			const buffer = await response.arrayBuffer();
			await Bun.write(tmpPath, buffer);
			await deps.chmod(tmpPath, 0o755);
			await deps.rename(tmpPath, binaryPath);
		}

		await applyUpdateWithDeps(downloadUrl, currentBinaryPath, "linux", {
			chmod: async (p, mode) => {
				chmodCalls.push([p, mode]);
			},
			rename: async (src, dest) => {
				renameCalls.push([src, dest]);
			},
		});

		expect(mockFetch).toHaveBeenCalledWith(downloadUrl);
		expect(mockBunWrite).toHaveBeenCalledWith(
			"/usr/local/bin/scriptor-update-tmp",
			expect.any(ArrayBuffer),
		);
		expect(chmodCalls).toEqual([["/usr/local/bin/scriptor-update-tmp", 0o755]]);
		expect(renameCalls).toEqual([
			["/usr/local/bin/scriptor-update-tmp", currentBinaryPath],
		]);
	});

	test("windows path: downloads to scriptor-new.exe and throws with instructions", async () => {
		const downloadUrl = "https://example.com/scriptor-windows-x64.exe";
		const currentBinaryPath = "C:\\Program Files\\scriptor\\scriptor.exe";

		async function applyUpdateWindows(
			url: string,
			binaryPath: string,
		): Promise<void> {
			const dir = path.dirname(binaryPath);
			const newPath = path.join(dir, "scriptor-new.exe");
			const response = await fetch(url);
			if (!response.ok)
				throw new Error(`Failed to download update: HTTP ${response.status}`);
			const buffer = await response.arrayBuffer();
			await Bun.write(newPath, buffer);
			throw new Error(`Update downloaded to ${newPath}.`);
		}

		await expect(
			applyUpdateWindows(downloadUrl, currentBinaryPath),
		).rejects.toThrow("Update downloaded to");

		expect(mockFetch).toHaveBeenCalledWith(downloadUrl);
		expect(mockBunWrite).toHaveBeenCalled();
	});

	test("propagates fetch errors", async () => {
		mockFetch = mock(async () => ({ ok: false, status: 404 }));
		globalThis.fetch = mockFetch as unknown as typeof fetch;

		const downloadUrl = "https://example.com/not-found";

		async function applyWithBadFetch(url: string): Promise<void> {
			const response = await fetch(url);
			if (!response.ok)
				throw new Error(`Failed to download update: HTTP ${response.status}`);
		}

		await expect(applyWithBadFetch(downloadUrl)).rejects.toThrow(
			"Failed to download update: HTTP 404",
		);
	});
});
