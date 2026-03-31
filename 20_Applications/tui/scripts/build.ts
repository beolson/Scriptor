import { copyFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export interface BuildTarget {
	target: string;
	outfile: string;
}

export const TARGETS: BuildTarget[] = [
	{ target: "bun-linux-x64", outfile: "scriptor-linux-x64" },
	{ target: "bun-linux-arm64", outfile: "scriptor-linux-arm64" },
	{ target: "bun-darwin-x64", outfile: "scriptor-darwin-x64" },
	{ target: "bun-darwin-arm64", outfile: "scriptor-darwin-arm64" },
	{ target: "bun-windows-x64", outfile: "scriptor-windows-x64.exe" },
	{ target: "bun-windows-arm64", outfile: "scriptor-windows-arm64.exe" },
];

export interface BuildRunner {
	compile(args: string[]): Promise<void>;
	copyFile(src: string, dest: string): Promise<void>;
	chmod(path: string, mode: string): Promise<void>;
}

// Root of the repo relative to this script's location (tui/scripts/ → ../../)
const repoRoot = resolve(import.meta.dir, "..", "..", "..");
const distDir = join(repoRoot, "dist");
const srcDir = join(import.meta.dir, "..", "src");
const installDir = join(import.meta.dir, "..", "install");
const entrypoint = join(srcDir, "index.ts");

export async function build(
	runner: BuildRunner = productionRunner,
): Promise<void> {
	// 1. Cross-compile all 6 platform binaries
	for (const { target, outfile } of TARGETS) {
		await runner.compile([
			"build",
			"--compile",
			`--target=${target}`,
			`--outfile=${join(distDir, outfile)}`,
			entrypoint,
		]);
	}

	// 2. Copy install scripts to dist/
	const installSrc = join(installDir, "install");
	const installDest = join(distDir, "install");
	await runner.copyFile(installSrc, installDest);
	await runner.chmod(installDest, "+x");

	const installWinSrc = join(installDir, "install-win");
	const installWinDest = join(distDir, "install-win");
	await runner.copyFile(installWinSrc, installWinDest);
	await runner.chmod(installWinDest, "+x");
}

const productionRunner: BuildRunner = {
	async compile(args: string[]): Promise<void> {
		const proc = Bun.spawn(["bun", ...args], {
			stdout: "inherit",
			stderr: "inherit",
		});
		const exitCode = await proc.exited;
		if (exitCode !== 0) {
			throw new Error(`bun ${args.join(" ")} exited with code ${exitCode}`);
		}
	},

	async copyFile(src: string, dest: string): Promise<void> {
		await copyFile(src, dest);
	},

	async chmod(path: string, mode: string): Promise<void> {
		const proc = Bun.spawn(["chmod", mode, path], {
			stdout: "inherit",
			stderr: "inherit",
		});
		await proc.exited;
	},
};

// Run when executed directly
if (import.meta.main) {
	await build();
}
