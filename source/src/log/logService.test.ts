import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LogService } from "./logService";

let testDir: string;
let log: LogService;

beforeEach(() => {
	testDir = join(tmpdir(), `scriptor-log-test-${Date.now()}`);
	mkdirSync(testDir, { recursive: true });
	log = new LogService(testDir);
});

afterEach(() => {
	rmSync(testDir, { recursive: true, force: true });
});

describe("createLogFile", () => {
	test("creates a file in the logs directory", async () => {
		const filePath = await log.createLogFile();

		expect(existsSync(filePath)).toBe(true);
	});

	test("returns an absolute path inside the logs subdirectory", async () => {
		const filePath = await log.createLogFile();

		const expectedLogsDir = join(testDir, ".scriptor", "logs");
		expect(filePath.startsWith(expectedLogsDir)).toBe(true);
	});

	test("file name matches ISO timestamp pattern (YYYY-MM-DDTHH-MM-SS.log)", async () => {
		const filePath = await log.createLogFile();

		const fileName = filePath.split("/").at(-1) ?? "";
		// Allow optional disambiguation suffix (-N) for same-second calls
		expect(fileName).toMatch(
			/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}(-\d+)?\.log$/,
		);
	});

	test("creates the logs directory automatically if it does not exist", async () => {
		const newBase = join(testDir, "fresh");
		const freshLog = new LogService(newBase);

		const filePath = await freshLog.createLogFile();

		expect(existsSync(filePath)).toBe(true);
	});

	test("each call creates a distinct file path", async () => {
		const path1 = await log.createLogFile();
		// Ensure at least 1ms passes so timestamps differ
		await Bun.sleep(1);
		const path2 = await log.createLogFile();

		expect(path1).not.toBe(path2);
	});
});

describe("writeScriptBanner", () => {
	test("writes a line containing the script name to the log file", async () => {
		const filePath = await log.createLogFile();

		await log.writeScriptBanner(filePath, "install-deps", new Date());

		const content = readFileSync(filePath, "utf8");
		expect(content).toContain("install-deps");
	});

	test("writes a separator line to the log file", async () => {
		const filePath = await log.createLogFile();

		await log.writeScriptBanner(filePath, "setup", new Date());

		const content = readFileSync(filePath, "utf8");
		// Should contain some kind of separator (at least 5 repeated chars)
		expect(content).toMatch(/[=\-#*]{5,}/);
	});

	test("includes the start time in the banner", async () => {
		const filePath = await log.createLogFile();
		const startTime = new Date("2026-02-28T14:32:00.000Z");

		await log.writeScriptBanner(filePath, "configure", startTime);

		const content = readFileSync(filePath, "utf8");
		// Should contain some representation of the time
		expect(content).toContain("2026");
	});
});

describe("appendOutput", () => {
	test("appends raw text content to the log file", async () => {
		const filePath = await log.createLogFile();

		await log.appendOutput(filePath, "Hello from stdout\n");

		const content = readFileSync(filePath, "utf8");
		expect(content).toContain("Hello from stdout\n");
	});

	test("appends multiple times without overwriting previous content", async () => {
		const filePath = await log.createLogFile();

		await log.appendOutput(filePath, "first line\n");
		await log.appendOutput(filePath, "second line\n");

		const content = readFileSync(filePath, "utf8");
		expect(content).toContain("first line\n");
		expect(content).toContain("second line\n");
	});

	test("appends empty string without error", async () => {
		const filePath = await log.createLogFile();

		await expect(log.appendOutput(filePath, "")).resolves.toBeUndefined();
	});

	test("appends stderr content correctly", async () => {
		const filePath = await log.createLogFile();

		await log.appendOutput(filePath, "Error: something went wrong\n");

		const content = readFileSync(filePath, "utf8");
		expect(content).toContain("Error: something went wrong\n");
	});
});

describe("writeScriptFooter", () => {
	test("writes the exit code to the log file", async () => {
		const filePath = await log.createLogFile();

		await log.writeScriptFooter(filePath, 0, new Date());

		const content = readFileSync(filePath, "utf8");
		expect(content).toContain("0");
	});

	test("writes a non-zero exit code to the log file", async () => {
		const filePath = await log.createLogFile();

		await log.writeScriptFooter(filePath, 1, new Date());

		const content = readFileSync(filePath, "utf8");
		expect(content).toContain("1");
	});

	test("writes a closing separator to the log file", async () => {
		const filePath = await log.createLogFile();

		await log.writeScriptFooter(filePath, 0, new Date());

		const content = readFileSync(filePath, "utf8");
		expect(content).toMatch(/[=\-#*]{5,}/);
	});

	test("includes the end time in the footer", async () => {
		const filePath = await log.createLogFile();
		const endTime = new Date("2026-02-28T15:00:00.000Z");

		await log.writeScriptFooter(filePath, 0, endTime);

		const content = readFileSync(filePath, "utf8");
		expect(content).toContain("2026");
	});

	test("banner and footer both appear in the file when called together", async () => {
		const filePath = await log.createLogFile();
		const start = new Date("2026-02-28T14:32:00.000Z");
		const end = new Date("2026-02-28T14:33:05.000Z");

		await log.writeScriptBanner(filePath, "build", start);
		await log.appendOutput(filePath, "Building...\n");
		await log.writeScriptFooter(filePath, 0, end);

		const content = readFileSync(filePath, "utf8");
		expect(content).toContain("build");
		expect(content).toContain("Building...\n");
		// exit code present
		expect(content).toContain("0");
	});
});
