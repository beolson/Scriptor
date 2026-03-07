import { render } from "ink";
import path from "node:path";
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
import { parseManifest, type ScriptEntry } from "./manifest/parseManifest.js";
import type { FetchDeps } from "./startup/startup.js";
import { runStartup } from "./startup/startup.js";
import { App } from "./tui/App.js";

const DEFAULT_REPO = "beolson/Scriptor";
const OAUTH_CLIENT_ID = "Ov23liczBZbFw43X0aFI"; // TODO: replace with real OAuth App client ID

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

	// Script content fetched during startup, keyed by the repo-relative path.
	// Populated by runStartupForApp and consumed by runExecutionForApp.
	let fetchedScripts: Record<string, string> = {};

	// Build the runStartup adapter that wires the real GitHubClient and
	// CacheService into the startup orchestration logic.
	// The GitHubClient is recreated with a token after OAuth completes.
	async function runStartupForApp(
		repo: string,
		onEvent: Parameters<typeof runStartup>[1]["onEvent"],
	) {
		// Local mode: if scriptor.yaml exists in cwd or parent dir, use it directly.
		let localManifestPath = path.join(process.cwd(), "scriptor.yaml");
		let localDir = process.cwd();

		if (!(await Bun.file(localManifestPath).exists())) {
			const parentPath = path.join(process.cwd(), "..", "scriptor.yaml");
			if (await Bun.file(parentPath).exists()) {
				localManifestPath = parentPath;
				localDir = path.join(process.cwd(), "..");
			}
		}

		if (await Bun.file(localManifestPath).exists()) {
			onEvent({ type: "local-mode", cwd: localDir });
			const manifestYaml = await Bun.file(localManifestPath).text();
			let entries: ReturnType<typeof parseManifest> = [];
			try {
				entries = parseManifest(manifestYaml);
			} catch {
				// invalid manifest — return empty scripts
			}
			const scripts: Record<string, string> = {};
			for (const entry of entries) {
				const scriptFile = Bun.file(path.join(localDir, entry.script));
				if (await scriptFile.exists()) {
					scripts[entry.script] = await scriptFile.text();
				}
			}
			fetchedScripts = scripts;
			return { manifestYaml, scripts, offline: false };
		}

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
				const token = await startOAuthFlow(clientId, {
					onDeviceCode: (userCode, verificationUri) => {
						onEvent({ type: "oauth-device-code", userCode, verificationUri });
					},
				});
				// Recreate the client with the obtained token so subsequent requests
				// in the same startup pass are authenticated.
				client = new GitHubClient({ token });
				return token;
			},
			oauthClientId: OAUTH_CLIENT_ID,
			onEvent,
		};

		const result = await runStartup(repo, deps);
		fetchedScripts = result.scripts;
		return result;
	}

	// Build the runExecution adapter that wires LogService and ScriptRunner
	// into the execution orchestration logic.
	async function runExecutionForApp(
		scripts: ScriptEntry[],
		onProgress: (event: ProgressEvent) => void,
	) {
		// Replace each entry's repo-relative script path with the fetched content
		// so the runner executes the actual script, not a missing local file.
		const withContent = scripts.map((entry) => ({
			...entry,
			script: fetchedScripts[entry.script] ?? entry.script,
		}));

		const logFile = await logService.createLogFile();
		const runner = new ScriptRunner({ logService });
		runner.on("progress", onProgress);
		return runner.runScripts(withContent, logFile);
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
