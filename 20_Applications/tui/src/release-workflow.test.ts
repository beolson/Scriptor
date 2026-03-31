import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as yaml from "js-yaml";

const releasePath = join(
	import.meta.dir,
	"../../../.github/workflows/release.yml",
);
let workflow: Record<string, unknown>;

try {
	const raw = readFileSync(releasePath, "utf-8");
	workflow = yaml.load(raw) as Record<string, unknown>;
} catch {
	workflow = {};
}

type Step = Record<string, unknown>;
type Job = { steps?: Step[] };
type Jobs = Record<string, Job>;

describe(".github/workflows/release.yml", () => {
	it("parses successfully", () => {
		expect(workflow).toBeTruthy();
		expect(typeof workflow).toBe("object");
	});

	it("changesets job VERSION command references 20_Applications/tui/package.json", () => {
		const jobs = (workflow.jobs as Jobs) ?? {};
		const changesets = jobs.changesets;
		const steps = changesets?.steps ?? [];
		const tagStep = steps.find(
			(s) =>
				typeof s.run === "string" && (s.run as string).includes("VERSION=$(jq"),
		);
		expect(tagStep).toBeTruthy();
		expect(tagStep?.run as string).toContain(
			"20_Applications/tui/package.json",
		);
	});

	it("tui-release job has no working-directory: tui", () => {
		const jobs = (workflow.jobs as Jobs) ?? {};
		const tuiRelease = jobs["tui-release"];
		for (const step of tuiRelease?.steps ?? []) {
			expect(step["working-directory"]).not.toBe("tui");
		}
	});

	it("tui-release job has a bun run build step", () => {
		const jobs = (workflow.jobs as Jobs) ?? {};
		const tuiRelease = jobs["tui-release"];
		const buildStep = (tuiRelease?.steps ?? []).find(
			(s) =>
				typeof s.run === "string" &&
				(s.run as string).trim() === "bun run build",
		);
		expect(buildStep).toBeTruthy();
	});

	it("tui-release release assets include all 6 binaries plus install scripts", () => {
		const jobs = (workflow.jobs as Jobs) ?? {};
		const tuiRelease = jobs["tui-release"];
		const releaseStep = (tuiRelease?.steps ?? []).find(
			(s) =>
				typeof s.uses === "string" &&
				(s.uses as string).includes("action-gh-release"),
		);
		expect(releaseStep).toBeTruthy();
		const files = ((releaseStep?.with as Record<string, string>)?.files ??
			"") as string;
		expect(files).toContain("scriptor-linux-x64");
		expect(files).toContain("scriptor-linux-arm64");
		expect(files).toContain("scriptor-darwin-x64");
		expect(files).toContain("scriptor-darwin-arm64");
		expect(files).toContain("scriptor-windows-x64.exe");
		expect(files).toContain("scriptor-windows-arm64.exe");
		expect(files).toContain("dist/install");
		expect(files).toContain("dist/install-win");
	});

	it("no step in any job has bare working-directory: web", () => {
		const jobs = (workflow.jobs as Jobs) ?? {};
		for (const [, job] of Object.entries(jobs)) {
			for (const step of job?.steps ?? []) {
				expect(step["working-directory"]).not.toBe("web");
			}
		}
	});

	it("web-release Playwright install step uses working-directory: 20_Applications/web", () => {
		const jobs = (workflow.jobs as Jobs) ?? {};
		const webRelease = jobs["web-release"];
		const playwrightStep = (webRelease?.steps ?? []).find(
			(s) =>
				typeof s.name === "string" && (s.name as string).includes("Playwright"),
		);
		expect(playwrightStep).toBeTruthy();
		expect(playwrightStep?.["working-directory"]).toBe("20_Applications/web");
	});

	it("web-release Pages artifact path is 20_Applications/web/out", () => {
		const jobs = (workflow.jobs as Jobs) ?? {};
		const webRelease = jobs["web-release"];
		const uploadStep = (webRelease?.steps ?? []).find(
			(s) =>
				typeof s.uses === "string" &&
				(s.uses as string).includes("upload-pages-artifact"),
		);
		expect(uploadStep).toBeTruthy();
		const path = (uploadStep?.with as Record<string, string>)?.path;
		expect(path).toBe("20_Applications/web/out");
	});
});
