import pkg from "../package.json";

const version: string = pkg.version;

const proc = Bun.spawn(
	[
		"bun",
		"build",
		"src/index.ts",
		"--compile",
		"--define",
		`VERSION="${version}"`,
		"--outfile",
		"../dist/scriptor",
	],
	{
		cwd: `${import.meta.dir}/..`,
		stdout: "inherit",
		stderr: "inherit",
	},
);

const exitCode = await proc.exited;
process.exit(exitCode);
