import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as yaml from "js-yaml";

const ciPath = join(import.meta.dir, "../../../.github/workflows/ci.yml");
let workflow: Record<string, unknown>;

try {
	const raw = readFileSync(ciPath, "utf-8");
	workflow = yaml.load(raw) as Record<string, unknown>;
} catch {
	workflow = {};
}

describe(".github/workflows/ci.yml", () => {
	it("parses successfully", () => {
		expect(workflow).toBeTruthy();
		expect(typeof workflow).toBe("object");
	});

	it("e2e job Install Playwright browsers step uses working-directory: 20_Applications/web", () => {
		const jobs = workflow.jobs as Record<string, unknown>;
		const e2e = jobs?.e2e as Record<string, unknown>;
		const steps = e2e?.steps as Array<Record<string, unknown>>;
		const playwrightStep = steps?.find(
			(s) => typeof s.name === "string" && s.name.includes("Playwright"),
		);
		expect(playwrightStep).toBeTruthy();
		expect(playwrightStep?.["working-directory"]).toBe("20_Applications/web");
	});

	it("no step has bare working-directory: web", () => {
		const jobs = workflow.jobs as Record<string, unknown>;
		for (const [, job] of Object.entries(jobs ?? {})) {
			const steps = (job as Record<string, unknown>)?.steps as Array<
				Record<string, unknown>
			>;
			for (const step of steps ?? []) {
				expect(step["working-directory"]).not.toBe("web");
			}
		}
	});
});
