// ---------------------------------------------------------------------------
// Startup TUI Screens
//
// Thin wrappers around @clack/prompts that keep the orchestrator free of
// direct clack calls, enabling the orchestrator to be tested without a TTY.
//
// All clack calls are injectable via `deps` for testability.
// ---------------------------------------------------------------------------

import * as clackPrompts from "@clack/prompts";
import type { HostInfo } from "../host/types.js";

// ---------------------------------------------------------------------------
// Injectable deps type
// ---------------------------------------------------------------------------

/** Minimal subset of @clack/prompts used by this module. */
export interface ClackDeps {
	confirm: (opts: { message: string }) => Promise<boolean | symbol>;
	note: (message: string, title?: string) => void;
	spinner: () => {
		start: (msg?: string) => void;
		stop: (msg?: string, code?: number) => void;
	};
	log: {
		error: (message: string) => void;
		info: (message: string) => void;
	};
}

export interface ScreensDeps {
	clack: ClackDeps;
	/** Defaults to `process.exit`. Injectable for testability. */
	exit?: (code: number) => never;
}

const defaultClack: ClackDeps = {
	confirm: clackPrompts.confirm,
	note: clackPrompts.note,
	spinner: clackPrompts.spinner,
	log: {
		error: clackPrompts.log.error,
		info: clackPrompts.log.info,
	},
};

function resolveClack(deps?: Partial<ScreensDeps>): ClackDeps {
	return deps?.clack ?? defaultClack;
}

// ---------------------------------------------------------------------------
// confirmRepoSwitch
// ---------------------------------------------------------------------------

/**
 * Prompts the user to confirm switching from `oldRepo` to `newRepo`.
 *
 * Returns `true` if confirmed, `false` if declined or cancelled.
 */
export async function confirmRepoSwitch(
	oldRepo: string,
	newRepo: string,
	deps?: Partial<ScreensDeps>,
): Promise<boolean> {
	const clack = resolveClack(deps);
	const result = await clack.confirm({
		message: `Switch repo from ${oldRepo} to ${newRepo}?`,
	});
	// A symbol result means the user cancelled (Ctrl-C); false means explicit "no".
	if (typeof result !== "boolean" || result === false) {
		return false;
	}
	return true;
}

// ---------------------------------------------------------------------------
// promptCheckUpdates
// ---------------------------------------------------------------------------

/**
 * Prompts the user to check for updates (manifest + Scriptor binary).
 *
 * Returns `true` if they accept, `false` if they decline or cancel.
 */
export async function promptCheckUpdates(
	deps?: Partial<ScreensDeps>,
): Promise<boolean> {
	const clack = resolveClack(deps);
	const result = await clack.confirm({ message: "Check for updates?" });
	// A symbol result means the user cancelled (Ctrl-C); false means explicit "no".
	if (typeof result !== "boolean" || result === false) {
		return false;
	}
	return true;
}

// ---------------------------------------------------------------------------
// showFetchProgress
// ---------------------------------------------------------------------------

/**
 * Runs `fn` while displaying a spinner labelled with `label`.
 *
 * Stops the spinner whether `fn` resolves or rejects.
 */
export async function showFetchProgress<T>(
	label: string,
	fn: () => Promise<T>,
	deps?: Partial<ScreensDeps>,
): Promise<T> {
	const clack = resolveClack(deps);
	const spin = clack.spinner();
	spin.start(label);
	try {
		const result = await fn();
		spin.stop();
		return result;
	} catch (err) {
		spin.stop();
		throw err;
	}
}

// ---------------------------------------------------------------------------
// showOAuthPrompt
// ---------------------------------------------------------------------------

/**
 * Displays the OAuth device-flow user code and verification URL using `note()`.
 */
export function showOAuthPrompt(
	userCode: string,
	verificationUrl: string,
	deps?: Partial<ScreensDeps>,
): void {
	const clack = resolveClack(deps);
	clack.note(
		[`Open: ${verificationUrl}`, `Enter code: ${userCode}`].join("\n"),
		"GitHub Authentication",
	);
}

// ---------------------------------------------------------------------------
// showHostInfo
// ---------------------------------------------------------------------------

/**
 * Logs the detected host info as a single info line.
 *
 * Format: [linux / x86 / Debian GNU/Linux 13]
 *         [mac / arm]
 */
export function showHostInfo(
	host: HostInfo,
	deps?: Partial<ScreensDeps>,
): void {
	const clack = resolveClack(deps);
	const parts: string[] = [host.platform, host.arch];
	if (host.distro) {
		parts.push(host.version ? `${host.distro} ${host.version}` : host.distro);
	}
	clack.log.info(`[${parts.join(" / ")}]`);
}

// ---------------------------------------------------------------------------
// showFatalError
// ---------------------------------------------------------------------------

/**
 * Logs a fatal error message and exits with code 1.
 *
 * This function never returns.
 */
export function showFatalError(
	message: string,
	deps?: Partial<ScreensDeps>,
): never {
	const clack = resolveClack(deps);
	const exit = deps?.exit ?? ((code: number) => process.exit(code));
	clack.log.error(message);
	return exit(1) as never;
}
