import { render } from "ink";
import React from "react";
import { CacheService } from "./cache/cacheService.js";
import { parseCli } from "./cli/parseCli.js";
import { readConfig, writeConfig } from "./config/config.js";
import type { ProgressEvent } from "./execution/scriptRunner.js";
import { ScriptRunner } from "./execution/scriptRunner.js";
import { GitHubClient } from "./github/githubClient.js";
import { startOAuthFlow } from "./github/oauth.js";
import { detectHost } from "./host/detectHost.js";
import { LogService } from "./log/logService.js";
import type { ScriptEntry } from "./manifest/parseManifest.js";
import type { FetchDeps } from "./startup/startup.js";
import { runStartup } from "./startup/startup.js";
import { App } from "./tui/App.js";

const DEFAULT_REPO = "owner/scriptor-scripts";
const OAUTH_CLIENT_ID = "Ov23liXXXXXXXXXXXXXX"; // TODO: replace with real OAuth App client ID

async function main() {
	const cliArgs = parseCli(process.argv.slice(2));

	const config = await readConfig();

	// Determine active repo: CLI arg > saved config > default.
	let repoUrl: string;
	if (cliArgs.repo !== null) {
		repoUrl = cliArgs.repo;
		// Persist the override for future runs.
		await writeConfig({ ...config, repo: cliArgs.repo });
	} else {
		repoUrl = config.repo ?? DEFAULT_REPO;
	}

	const hostInfo = await detectHost();

	const cache = new CacheService();
	const logService = new LogService();

	// Build the runStartup adapter that wires the real GitHubClient and
	// CacheService into the startup orchestration logic.
	// The GitHubClient is recreated with a token after OAuth completes.
	async function runStartupForApp(
		repo: string,
		onEvent: Parameters<typeof runStartup>[1]["onEvent"],
	) {
		// We start without a token; the startup logic will trigger OAuth if needed
		// and call startOAuthFlow to obtain one.
		let client = new GitHubClient();

		const deps: FetchDeps = {
			getLatestCommitHash: (r: string) => client.getLatestCommitHash(r),
			fetchFile: (r: string, path: string) => client.fetchFile(r, path),
			getStoredCommitHash: () => cache.getStoredCommitHash(),
			saveCommitHash: (hash: string) => cache.saveCommitHash(hash),
			getCachedManifest: () => cache.getCachedManifest(),
			saveManifest: (yaml: string) => cache.saveManifest(yaml),
			getCachedScript: (id: string) => cache.getCachedScript(id),
			saveScript: (id: string, content: string) =>
				cache.saveScript(id, content),
			isCacheStale: (latestHash: string) => cache.isCacheStale(latestHash),
			startOAuthFlow: async (clientId: string) => {
				const token = await startOAuthFlow(clientId);
				// Recreate the client with the obtained token so subsequent requests
				// in the same startup pass are authenticated.
				client = new GitHubClient({ token });
				return token;
			},
			oauthClientId: OAUTH_CLIENT_ID,
			onEvent,
		};

		return runStartup(repo, deps);
	}

	// Build the runExecution adapter that wires LogService and ScriptRunner
	// into the execution orchestration logic.
	async function runExecutionForApp(
		scripts: ScriptEntry[],
		onProgress: (event: ProgressEvent) => void,
	) {
		const logFile = await logService.createLogFile();
		const runner = new ScriptRunner({ logService });
		runner.on("progress", onProgress);
		return runner.runScripts(scripts, logFile);
	}

	render(
		React.createElement(App, {
			hostInfo,
			repoUrl,
			runStartup: runStartupForApp,
			runExecution: runExecutionForApp,
		}),
	);
}

main().catch((err: unknown) => {
	console.error(err);
	process.exit(1);
});
