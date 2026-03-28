#!/usr/bin/env bun
/**
 * @clack/prompts — script output demo
 *
 * Exercises all output APIs and surfaces limitations relevant to
 * displaying script execution output in Scriptor.
 *
 * Run: bun demo.ts
 */
import {
	cancel,
	intro,
	log,
	note,
	outro,
	spinner,
	stream,
	tasks,
} from "@clack/prompts";
import pc from "picocolors";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Subprocess → AsyncIterable bridge ───────────────────────────────────────
// Bun.spawn({ stdout: "pipe" }) returns a ReadableStream<Uint8Array> which is
// natively async-iterable. This bridge decodes chunks as they arrive.
async function* spawnOutput(cmd: string[]): AsyncGenerator<string> {
	const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "inherit" });
	const decoder = new TextDecoder();
	for await (const chunk of proc.stdout) {
		yield decoder.decode(chunk);
	}
	await proc.exited;
}

// ── Demo ─────────────────────────────────────────────────────────────────────
async function main() {
	// ── 1. Session framing ────────────────────────────────────────────────────
	intro("@clack/prompts — script output demo");

	// ── 2. log.*() variants ───────────────────────────────────────────────────
	note(
		"All 6 variants (info, success, step, warn, error, message).\n" +
			"Multi-line with \\n shows │   indent continuation.\n" +
			"Long single lines are NOT wrapped — they overflow the terminal.",
		"log.*()",
	);

	log.info("Short info message");
	log.success("Short success message");
	log.step("Short step message");
	log.warn("Short warning message");
	log.error("Short error message");
	log.message("Custom symbol (cyan ~)", { symbol: pc.cyan("~") });

	log.info(
		"LONG LINE (no wrap): " +
			"Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod " +
			"tempor incididunt ut labore et dolore magna aliqua ut enim ad minim " +
			"veniam quis nostrud exercitation ullamco laboris nisi ut aliquip.",
	);

	log.success(
		"Multi-line success:\n" +
			"  Line 2 — gets │   prefix\n" +
			"  Line 3\n" +
			"  Line 4",
	);

	// ── 3. note() ─────────────────────────────────────────────────────────────
	note(
		"note() draws a Unicode box.\n" +
			"Box width = max(longest content line, title length) + padding.\n" +
			"No max-width enforcement — long lines make a very wide box.",
		"note()",
	);

	note(
		"This line is intentionally very long to show box expansion:\n" +
			"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
		"note() wide box",
	);

	// ── 4. spinner() ──────────────────────────────────────────────────────────
	note(
		"dots (default): animated spinning dots.\n" +
			"timer: shows elapsed time [Xs].\n" +
			"stop(msg, 0) → green ✔   stop(msg, 1) → red ✖",
		"spinner()",
	);

	const s1 = spinner();
	s1.start("Simulating work (dots)…");
	await sleep(800);
	s1.message("Still working…");
	await sleep(800);
	s1.stop("Done (success)", 0);

	const s2 = spinner({ indicator: "timer" });
	s2.start("Simulating work (timer)…");
	await sleep(1500);
	s2.stop("Done (timer elapsed shown)", 0);

	const s3 = spinner();
	s3.start("Simulating a failure…");
	await sleep(600);
	s3.stop("Failed", 1);

	// ── 5. stream.*() — simulated output ──────────────────────────────────────
	note(
		"stream.*() accepts Iterable<string> | AsyncIterable<string>.\n" +
			"Wraps at process.stdout.columns (ANSI-aware).\n" +
			"\\n within chunks → indented continuation with │   prefix.",
		"stream.*() — simulated",
	);

	// Normal case: short lines via async generator
	async function* shortLines() {
		const lines = [
			"Installing base packages...",
			"Resolving dependencies...",
			"Fetching from registry...",
			"Extracting archives...",
			"Done.",
		];
		for (const line of lines) {
			await sleep(80);
			yield `${line}\n`;
		}
	}
	log.step("stream.step() — short lines:");
	await stream.step(shortLines());

	// Long lines — auto-wrap at terminal width
	async function* longLines() {
		const wide =
			"This output line is intentionally very long. " +
			"stream.*() tracks column position and wraps at stdout.columns=" +
			String(process.stdout.columns) +
			". " +
			"Notice how wrapped content stays indented with the │   prefix. " +
			"This is the key advantage over log.*() for variable-length output.";
		yield `${wide}\n`;
		yield "Short follow-up line.\n";
		yield `${wide.toUpperCase()}\n`;
	}
	log.step("stream.info() — long lines (auto-wrap):");
	await stream.info(longLines());

	// Word-at-a-time: no newlines within stream (LLM-style chunked output)
	async function* wordByWord() {
		const sentence =
			"The quick brown fox jumps over the lazy dog. " +
			"Each word arrives as a separate chunk with no newline. " +
			"stream.message() accumulates column position and wraps at the terminal boundary.";
		for (const word of sentence.split(" ")) {
			await sleep(50);
			yield `${word} `;
		}
	}
	log.step("stream.message() — word-at-a-time (no newlines):");
	await stream.message(wordByWord());

	// Many lines: shows natural terminal scroll (no special handling needed)
	async function* manyLines() {
		for (let i = 1; i <= 30; i++) {
			yield `Line ${String(i).padStart(2, "0")}: output from a long-running script\n`;
		}
	}
	log.step("stream.step() — 30 lines (terminal scrolls naturally):");
	await stream.step(manyLines());

	// ── 6. stream.*() — real subprocess via Bun.spawn ─────────────────────────
	note(
		"Bun.spawn({ stdout: 'pipe' }) returns ReadableStream<Uint8Array>.\n" +
			"ReadableStream is natively async-iterable in Bun.\n" +
			"Wrap with TextDecoder to yield string chunks.",
		"stream.*() + subprocess",
	);

	log.step("stream.step() — ls -la /usr/bin | head -20:");
	await stream.step(spawnOutput(["bash", "-c", "ls -la /usr/bin | head -20"]));

	log.step("stream.step() — bash echo loop (20 lines):");
	await stream.step(
		spawnOutput([
			"bash",
			"-c",
			"for i in $(seq 1 20); do echo \"Script output line $i\"; done",
		]),
	);

	// ── 7. tasks() ────────────────────────────────────────────────────────────
	note(
		"tasks() runs each task sequentially with an individual spinner.\n" +
			"The string returned from task() becomes the spinner stop message.\n" +
			"The message() callback allows mid-task status updates.\n" +
			"Directly applicable to Scriptor's multi-script execution display.",
		"tasks()",
	);

	await tasks([
		{
			title: "Installing base packages",
			task: async (message) => {
				await sleep(400);
				message("Resolving dependencies…");
				await sleep(600);
				message("Downloading…");
				await sleep(400);
				return "base packages installed";
			},
		},
		{
			title: "Configuring system settings",
			task: async (_message) => {
				await sleep(900);
				return "system configured";
			},
		},
		{
			title: "Running post-install hooks",
			task: async (_message) => {
				await sleep(500);
				return "hooks complete";
			},
		},
	]);

	// ── 8. \r carriage return — edge case ─────────────────────────────────────
	note(
		"stream.*() replaces \\n with indented continuation but does NOT handle \\r.\n" +
			"Scripts using \\r for in-place progress bars (apt-get, curl, wget)\n" +
			"will return the cursor to column 0, overwriting the │   prefix.\n\n" +
			"The example below demonstrates this corruption deliberately.",
		"Edge case: \\r (carriage return)",
	);

	async function* withCarriageReturn() {
		yield "Before carriage return...";
		await sleep(300);
		yield "\rAFTER \\r (cursor moved to col 0 — prefix overwritten)";
		await sleep(300);
		yield "\n";
	}
	log.warn("stream.warn() with \\r — expect prefix corruption on the line below:");
	await stream.warn(withCarriageReturn());
	log.message(
		"If the │   prefix above was overwritten, \\r corruption is confirmed.\n" +
			"These scripts must use raw stdout pass-through instead.",
	);

	// ── 9. cancel() ───────────────────────────────────────────────────────────
	cancel("This is what cancel() looks like — red text, └ prefix");

	outro("Demo complete. See recommended.md for findings.");
}

main().catch(console.error);
