// ---------------------------------------------------------------------------
// OAuth Service
//
// Runs the GitHub OAuth device flow via @octokit/auth-oauth-device and
// displays the user code and verification URL using @clack/prompts.
//
// After successful authentication the access token is returned to the caller.
// ---------------------------------------------------------------------------

import * as clackPrompts from "@clack/prompts";
import type { OAuthAppStrategyOptions } from "@octokit/auth-oauth-device";
import { createOAuthDeviceAuth } from "@octokit/auth-oauth-device";

// ---------------------------------------------------------------------------
// The GitHub OAuth App client ID for Scriptor.
// This is a public identifier — not a secret.
// ---------------------------------------------------------------------------

const SCRIPTOR_CLIENT_ID = "Ov23liczBZbFw43X0aFI";

// ---------------------------------------------------------------------------
// Injectable deps
// ---------------------------------------------------------------------------

/** Minimal subset of @clack/prompts used by this module. */
export interface ClackDeps {
	note: (message: string, title?: string) => void;
	spinner: () => {
		start: (message: string) => void;
		stop: (message?: string) => void;
	};
}

/**
 * Factory function compatible with `createOAuthDeviceAuth` from
 * `@octokit/auth-oauth-device`. Accepts the options object and returns an
 * auth callable.
 */
export type CreateDeviceFlowFn = (
	options: OAuthAppStrategyOptions,
) => (authOptions: { type: "oauth" }) => Promise<{ token: string }>;

export interface OAuthServiceDeps {
	clack: ClackDeps;
	createDeviceFlow: CreateDeviceFlowFn;
}

const defaultDeps: OAuthServiceDeps = {
	clack: {
		note: clackPrompts.note,
		spinner: clackPrompts.spinner,
	},
	createDeviceFlow: createOAuthDeviceAuth as unknown as CreateDeviceFlowFn,
};

// ---------------------------------------------------------------------------
// runDeviceFlow
// ---------------------------------------------------------------------------

/**
 * Runs the GitHub OAuth device flow.
 *
 * 1. Registers an `onVerification` callback that displays the user code and
 *    verification URL via `@clack/prompts` `note()`.
 * 2. Starts a spinner with "Waiting for authorization…" during polling.
 * 3. On success: stops the spinner and returns the access token.
 * 4. On failure: stops the spinner and rethrows the error.
 *
 * @returns The OAuth access token as a plain string.
 */
export async function runDeviceFlow(
	deps?: Partial<OAuthServiceDeps>,
): Promise<string> {
	const resolved: OAuthServiceDeps = { ...defaultDeps, ...deps };
	const { clack, createDeviceFlow } = resolved;

	let spinnerStarted = false;
	const spin = clack.spinner();

	const auth = createDeviceFlow({
		clientId: SCRIPTOR_CLIENT_ID,
		clientType: "oauth-app",
		scopes: ["repo"],
		onVerification: (verification) => {
			clack.note(
				[
					`Open: ${verification.verification_uri}`,
					`Enter code: ${verification.user_code}`,
				].join("\n"),
				"GitHub Authentication",
			);
			spin.start("Waiting for authorization…");
			spinnerStarted = true;
		},
	} as OAuthAppStrategyOptions);

	try {
		const result = await auth({ type: "oauth" });
		spin.stop("Authorized");
		return result.token;
	} catch (err) {
		if (spinnerStarted) spin.stop();
		throw err;
	}
}
