#!/usr/bin/env bun
/**
 * Proof of concept: sudo elevation via @clack/prompts.password()
 *
 * Run: bun 15_Research/clack-sudo-elevation/test.ts
 * Requires: unix (linux/mac), bun runtime
 */
import {
	cancel,
	intro,
	isCancel,
	log,
	outro,
	password,
	spinner,
} from "@clack/prompts";

async function checkCached(): Promise<boolean> {
	const proc = Bun.spawn(["sudo", "-n", "-v"], {
		stdout: "ignore",
		stderr: "ignore",
	});
	return (await proc.exited) === 0;
}

async function validate(passwd: string): Promise<boolean> {
	const proc = Bun.spawn(["sudo", "-S", "-v"], {
		stdin: "pipe",
		stdout: "ignore",
		stderr: "ignore",
	});
	proc.stdin.write(`${passwd}\n`);
	proc.stdin.end();
	return (await proc.exited) === 0;
}

async function main() {
	intro("Clack sudo elevation — proof of concept");

	const s = spinner();
	s.start("Checking for cached sudo credentials…");
	const cached = await checkCached();

	if (cached) {
		s.stop("Credentials already cached — no password needed.");
		outro("Done.");
		return;
	}

	s.stop("No cached credentials. Password required.");

	let attempts = 0;

	while (true) {
		attempts++;

		const passwd = await password({
			message:
				attempts === 1
					? "Enter your sudo password:"
					: "Incorrect password. Try again:",
			mask: "*",
		});

		if (isCancel(passwd)) {
			cancel("Cancelled.");
			process.exit(0);
		}

		const ok = await validate(passwd);

		if (ok) {
			log.success("Sudo credentials validated.");
			break;
		}

		log.error("Incorrect password.");
	}

	outro(
		`Elevation successful (${attempts} attempt${attempts === 1 ? "" : "s"}).`,
	);
}

main().catch(console.error);
