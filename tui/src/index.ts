import path from "node:path";
import { render } from "ink";
import React from "react";
import pkg from "../package.json";
import { CacheService } from "./cache/cacheService.js";
import { parseCli } from "./cli/parseCli.js";
import { readConfig, writeConfig } from "./config/config.js";
import type { ProgressEvent } from "./execution/scriptRunner.js";
import { ScriptRunner } from "./execution/scriptRunner.js";
import { GitHubClient } from "./github/githubClient.js";
import { startOAuthFlow } from "./github/oauth.js";
import { checkIsAdmin, detectHost } from "./host/detectHost.js";
import type { ScriptInputs } from "./inputs/inputSchema.js";
import { LogService } from "./log/logService.js";
import { parseManifest, type ScriptEntry } from "./manifest/parseManifest.js";
import type { FetchDeps } from "./startup/startup.js";
import { runStartup } from "./startup/startup.js";
import {
	checkSudoCached,
	invalidateSudo,
	startKeepalive,
	validateSudoWithPassword,
} from "./sudo/sudoManager.js";
import { App } from "./tui/App.js";
import { applyUpdate } from "./updater/applyUpdate.js";
import { checkForUpdate } from "./updater/checkForUpdate.js";

const DEFAULT_REPO = "beolson/Scriptor";
const OAUTH_CLIENT_ID = "Ov23liczBZbFw43X0aFI"; // TODO: replace with real OAuth App client ID

async function main() {
	const cliArgs = parseCli(process.argv.slice(2));

	const [config, hostInfo] = await Promise.all([readConfig(), detectHost()]);

	// Determine active repo: CLI arg > saved config > default.
	let repoUrl: string;
	if (cliArgs.repo !== null) {
		repoUrl = cliArgs.repo;
		// Persist the override for future runs.
		await writeConfig({ ...config, repo: cliArgs.repo });
	} else {
		repoUrl = config.repo ?? DEFAULT_REPO;
	}

	// Start admin check immediately in the background on Windows. By the time
	// the user reaches the confirmation screen (after a 1-3s GitHub fetch), the
	// promise will already be resolved and the await in handleExecute is free.
	const isAdminPromise: Promise<boolean | undefined> =
		hostInfo.platform === "windows"
			? checkIsAdmin()
			: Promise.resolve(undefined);

	// Shared client for both startup and update check.
	const client = new GitHubClient();

	const cache = new CacheService();
	const logService = new LogService();

	// Update check adapter: silent on any error.
	async function checkForUpdateForApp() {
		try {
			return await checkForUpdate(pkg.version, hostInfo, {
				getLatestRelease: (repo: string) => client.getLatestRelease(repo),
			});
		} catch {
			return null;
		}
	}

	// Apply update adapter: only available for compiled binaries.
	async function applyUpdateForApp(downloadUrl: string) {
		if (!path.basename(process.execPath).startsWith("scriptor")) {
			throw new Error("Self-update only available for installed binaries.");
		}
		await applyUpdate(downloadUrl, process.execPath, hostInfo.platform);
	}

	// Script content fetched during startup, keyed by the repo-relative path.
	// Populated by runStartupForApp and consumed by runExecutionForApp.
	let fetchedScripts: Record<string, string> = {};

	// Sudo keepalive cleanup function, set when sudo is validated.
	let stopKeepalive: (() => void) | null = null;

	// On-demand sudo validation: called from the TUI when the user
	// selects a script that requires sudo.
	async function validateSudoForApp(
		password: string,
	): Promise<{ ok: true } | { ok: false; reason: string }> {
		// Check if sudo credentials are already cached
		const cached = await checkSudoCached();
		if (cached) {
			if (!stopKeepalive) {
				stopKeepalive = startKeepalive();
			}
			return { ok: true };
		}

		// Empty password means we were just checking the cache
		if (password === "") {
			return { ok: false, reason: "Password required" };
		}

		const result = await validateSudoWithPassword(password);
		if (result.ok && !stopKeepalive) {
			stopKeepalive = startKeepalive();
		}
		return result;
	}

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
		let startupClient = new GitHubClient();

		const deps: FetchDeps = {
			getLatestCommitHash: (r: string) => startupClient.getLatestCommitHash(r),
			fetchFile: (r: string, p: string) => startupClient.fetchFile(r, p),
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
				startupClient = new GitHubClient({ token });
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
		scriptInputs?: ScriptInputs,
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
		try {
			return await runner.runScripts(withContent, logFile, scriptInputs);
		} finally {
			if (stopKeepalive) {
				stopKeepalive();
				stopKeepalive = null;
			}
			await invalidateSudo();
		}
	}

	let executionTarget: {
		scripts: ScriptEntry[];
		inputs: ScriptInputs;
	} | null = null;

	const { waitUntilExit } = render(
		React.createElement(App, {
			hostInfo,
			repoUrl,
			runStartup: runStartupForApp,
			onReadyToExecute(scripts, inputs) {
				executionTarget = { scripts, inputs };
			},
			validateSudo: validateSudoForApp,
			version: pkg.version,
			checkForUpdate: checkForUpdateForApp,
			applyUpdate: applyUpdateForApp,
			isAdminPromise,
		}),
	);

	await waitUntilExit();

	if (executionTarget !== null) {
		const target = executionTarget as {
			scripts: ScriptEntry[];
			inputs: ScriptInputs;
		};
		const nameById = new Map(target.scripts.map((s) => [s.id, s.name]));

		const result = await runExecutionForApp(
			target.scripts,
			(event) => {
				if (event.status === "running") {
					process.stdout.write(
						`\n› ${nameById.get(event.scriptId) ?? event.scriptId}\n`,
					);
				} else if (event.status === "output") {
					process.stdout.write(`  ${event.line}\n`);
				} else if (event.status === "done") {
					process.stdout.write(
						`✓ ${nameById.get(event.scriptId) ?? event.scriptId}\n`,
					);
				} else if (event.status === "failed") {
					process.stdout.write(
						`✗ ${nameById.get(event.scriptId) ?? event.scriptId} (exit code ${event.exitCode})\n`,
					);
				}
			},
			target.inputs,
		);

		process.stdout.write(`\nLog file: ${result.logFile}\n`);
	}
}

main().catch((err: unknown) => {
	process.stderr.write(
		`Error: ${err instanceof Error ? err.message : String(err)}\n`,
		() => {
			process.exit(1);
		},
	);
});
