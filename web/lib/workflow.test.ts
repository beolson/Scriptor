import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import * as path from "node:path";
import yaml from "js-yaml";

const WORKFLOW_PATH = path.resolve(
	process.cwd(),
	"../.github/workflows/deploy-web.yml",
);

async function loadWorkflow(): Promise<unknown> {
	const text = await readFile(WORKFLOW_PATH, "utf-8");
	return yaml.load(text);
}

test("workflow trigger paths include scriptor.yaml", async () => {
	const workflow = (await loadWorkflow()) as {
		on: { push: { paths: string[] } };
	};
	const paths = workflow.on.push.paths;
	expect(Array.isArray(paths)).toBe(true);
	expect(paths).toContain("scriptor.yaml");
});

test("workflow trigger paths include web/**", async () => {
	const workflow = (await loadWorkflow()) as {
		on: { push: { paths: string[] } };
	};
	const paths = workflow.on.push.paths;
	expect(paths).toContain("web/**");
});

test("workflow has a step that runs bun run build", async () => {
	const workflow = (await loadWorkflow()) as {
		jobs: Record<string, { steps: Array<{ run?: string }> }>;
	};
	const allSteps = Object.values(workflow.jobs).flatMap((job) => job.steps);
	const hasBuild = allSteps.some((step) => step.run?.includes("bun run build"));
	expect(hasBuild).toBe(true);
});

test("workflow has a step that references bun run lint", async () => {
	const workflow = (await loadWorkflow()) as {
		jobs: Record<string, { steps: Array<{ run?: string }> }>;
	};
	const allSteps = Object.values(workflow.jobs).flatMap((job) => job.steps);
	const hasLint = allSteps.some((step) => step.run?.includes("bun run lint"));
	expect(hasLint).toBe(true);
});

test("workflow has a step that references actions/deploy-pages", async () => {
	const workflow = (await loadWorkflow()) as {
		jobs: Record<string, { steps: Array<{ uses?: string }> }>;
	};
	const allSteps = Object.values(workflow.jobs).flatMap((job) => job.steps);
	const hasDeployPages = allSteps.some((step) =>
		step.uses?.startsWith("actions/deploy-pages"),
	);
	expect(hasDeployPages).toBe(true);
});

test("deploy job depends on build job", async () => {
	const workflow = (await loadWorkflow()) as {
		jobs: Record<string, { needs?: string | string[] }>;
	};
	const jobs = workflow.jobs;
	const deployJob = Object.values(jobs).find((job) => {
		const needs = job.needs;
		if (!needs) return false;
		const needsArr = Array.isArray(needs) ? needs : [needs];
		return needsArr.some((n) => {
			const otherJobNames = Object.keys(jobs).filter((k) => jobs[k] !== job);
			return otherJobNames.includes(n);
		});
	});
	expect(deployJob).toBeDefined();
});
