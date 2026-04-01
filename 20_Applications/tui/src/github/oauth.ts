import { log } from "@clack/prompts";
import type { OAuthAppStrategyOptions } from "@octokit/auth-oauth-device";
import { createOAuthDeviceAuth } from "@octokit/auth-oauth-device";
import { GITHUB_CLIENT_ID } from "../config.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Verification = {
	device_code: string;
	user_code: string;
	verification_uri: string;
	expires_in: number;
	interval: number;
};

export interface OAuthDeps {
	createAuthFn?: (
		opts: OAuthAppStrategyOptions,
	) => (authOpts: { type: "oauth" }) => Promise<{ token: string }>;
	logNoteFn?: (message: string) => void | Promise<void>;
}

// ---------------------------------------------------------------------------
// runDeviceFlow
// ---------------------------------------------------------------------------

export async function runDeviceFlow(deps?: OAuthDeps): Promise<string> {
	const createAuthFn = (deps?.createAuthFn ?? createOAuthDeviceAuth) as (
		opts: OAuthAppStrategyOptions,
	) => (authOpts: { type: "oauth" }) => Promise<{ token: string }>;
	const logNoteFn = deps?.logNoteFn ?? ((message: string) => log.info(message));

	const auth = createAuthFn({
		clientType: "oauth-app",
		clientId: GITHUB_CLIENT_ID,
		scopes: ["repo"],
		onVerification: async (verification: Verification) => {
			await logNoteFn(
				`Open ${verification.verification_uri} and enter code: ${verification.user_code}`,
			);
		},
	});

	const result = await auth({ type: "oauth" });
	return result.token;
}
