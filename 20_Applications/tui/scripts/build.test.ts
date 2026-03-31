import { describe, expect, it } from "bun:test";

// Import the module under test — will fail if build.ts doesn't exist yet
import { build, TARGETS } from "./build.ts";

describe("build.ts TARGETS", () => {
	it("exports exactly 6 targets", () => {
		expect(TARGETS).toHaveLength(6);
	});

	it("includes bun-linux-x64 → scriptor-linux-x64", () => {
		const t = TARGETS.find((t) => t.target === "bun-linux-x64");
		expect(t).toBeDefined();
		expect(t?.outfile).toBe("scriptor-linux-x64");
	});

	it("includes bun-linux-arm64 → scriptor-linux-arm64", () => {
		const t = TARGETS.find((t) => t.target === "bun-linux-arm64");
		expect(t).toBeDefined();
		expect(t?.outfile).toBe("scriptor-linux-arm64");
	});

	it("includes bun-darwin-x64 → scriptor-darwin-x64", () => {
		const t = TARGETS.find((t) => t.target === "bun-darwin-x64");
		expect(t).toBeDefined();
		expect(t?.outfile).toBe("scriptor-darwin-x64");
	});

	it("includes bun-darwin-arm64 → scriptor-darwin-arm64", () => {
		const t = TARGETS.find((t) => t.target === "bun-darwin-arm64");
		expect(t).toBeDefined();
		expect(t?.outfile).toBe("scriptor-darwin-arm64");
	});

	it("includes bun-windows-x64 → scriptor-windows-x64.exe", () => {
		const t = TARGETS.find((t) => t.target === "bun-windows-x64");
		expect(t).toBeDefined();
		expect(t?.outfile).toBe("scriptor-windows-x64.exe");
	});

	it("includes bun-windows-arm64 → scriptor-windows-arm64.exe", () => {
		const t = TARGETS.find((t) => t.target === "bun-windows-arm64");
		expect(t).toBeDefined();
		expect(t?.outfile).toBe("scriptor-windows-arm64.exe");
	});
});

describe("build() function — injected mock runner", () => {
	it("calls compile for all 6 targets with correct --compile --target --outfile args", async () => {
		const calls: string[][] = [];
		const mockRunner = {
			compile: async (args: string[]) => {
				calls.push(args);
			},
			copyFile: async (_src: string, _dest: string) => {},
			chmod: async (_path: string, _mode: string) => {},
		};

		await build(mockRunner);

		expect(calls).toHaveLength(6);
		for (const target of TARGETS) {
			const call = calls.find((c) => c.includes(`--target=${target.target}`));
			expect(call).toBeDefined();
			expect(call).toContain("--compile");
			expect(call?.find((a) => a.startsWith("--outfile="))).toContain(
				target.outfile,
			);
		}
	});

	it("copies src/install to ../../dist/install", async () => {
		const copies: [string, string][] = [];
		const mockRunner = {
			compile: async (_args: string[]) => {},
			copyFile: async (src: string, dest: string) => {
				copies.push([src, dest]);
			},
			chmod: async (_path: string, _mode: string) => {},
		};

		await build(mockRunner);

		const installCopy = copies.find(([, d]) => d.endsWith("dist/install"));
		expect(installCopy).toBeDefined();
		expect(installCopy?.[0]).toContain("install/install");
	});

	it("copies src/install-win to ../../dist/install-win", async () => {
		const copies: [string, string][] = [];
		const mockRunner = {
			compile: async (_args: string[]) => {},
			copyFile: async (src: string, dest: string) => {
				copies.push([src, dest]);
			},
			chmod: async (_path: string, _mode: string) => {},
		};

		await build(mockRunner);

		const installWinCopy = copies.find(([, d]) =>
			d.endsWith("dist/install-win"),
		);
		expect(installWinCopy).toBeDefined();
		expect(installWinCopy?.[0]).toContain("install/install-win");
	});

	it("calls chmod +x on dist/install", async () => {
		const chmods: [string, string][] = [];
		const mockRunner = {
			compile: async (_args: string[]) => {},
			copyFile: async (_src: string, _dest: string) => {},
			chmod: async (path: string, mode: string) => {
				chmods.push([path, mode]);
			},
		};

		await build(mockRunner);

		const installChmod = chmods.find(([p]) => p.endsWith("dist/install"));
		expect(installChmod).toBeDefined();
		expect(installChmod?.[1]).toBe("+x");
	});

	it("calls chmod +x on dist/install-win", async () => {
		const chmods: [string, string][] = [];
		const mockRunner = {
			compile: async (_args: string[]) => {},
			copyFile: async (_src: string, _dest: string) => {},
			chmod: async (path: string, mode: string) => {
				chmods.push([path, mode]);
			},
		};

		await build(mockRunner);

		const installWinChmod = chmods.find(([p]) =>
			p.endsWith("dist/install-win"),
		);
		expect(installWinChmod).toBeDefined();
		expect(installWinChmod?.[1]).toBe("+x");
	});
});
