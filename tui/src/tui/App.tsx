import { Box, useApp, useInput } from "ink";
import { useEffect, useState } from "react";
import type {
	ProgressEvent,
	ScriptRunResult,
} from "../execution/scriptRunner.js";
import type { HostInfo } from "../host/detectHost.js";
import { InputCollectionScreen } from "../inputs/components/InputCollectionScreen.js";
import type { ScriptInputs } from "../inputs/inputSchema.js";
import type { CertFetcher } from "../inputs/sslCert/certFetcher.js";
import { TlsCertFetcher } from "../inputs/sslCert/certFetcher.js";
import type { ScriptEntry } from "../manifest/parseManifest.js";
import type { StartupEvent, StartupResult } from "../startup/startup.js";
import type { UpdateInfo } from "../updater/checkForUpdate.js";
import { ConfirmationScreen } from "./ConfirmationScreen.js";
import { ExecutionScreen } from "./ExecutionScreen.js";
import { FetchScreen } from "./FetchScreen.js";
import type { FooterBinding } from "./Footer.js";
import { DEFAULT_BINDINGS, Footer } from "./Footer.js";
import { Header } from "./Header.js";
import { ScriptListScreen } from "./ScriptListScreen.js";
import { SudoScreen } from "./SudoScreen.js";
import { UpdateScreen } from "./UpdateScreen.js";

export type Screen =
	| "update"
	| "fetch"
	| "script-list"
	| "input-collection"
	| "confirmation"
	| "sudo"
	| "execution";

export interface AppProps {
	hostInfo: HostInfo;
	repoUrl: string;
	/**
	 * A function that kicks off the startup fetch sequence and calls the
	 * provided `onEvent` callback as events arrive.  It resolves with the
	 * final `StartupResult`.
	 *
	 * Injectable so the component can be exercised in isolation without a real
	 * GitHub connection.
	 */
	runStartup: (
		repo: string,
		onEvent: (event: StartupEvent) => void,
	) => Promise<StartupResult>;
	/**
	 * A function that creates a log file, runs the given scripts via
	 * ScriptRunner, and calls `onProgress` for each ProgressEvent.
	 * Resolves with the final ScriptRunResult (containing the log file path).
	 *
	 * Injectable so the component can be exercised in isolation.
	 */
	runExecution: (
		scripts: ScriptEntry[],
		onProgress: (event: ProgressEvent) => void,
		scriptInputs?: ScriptInputs,
	) => Promise<ScriptRunResult>;
	/**
	 * Certificate fetcher used by the SSL cert input prompt.
	 * Defaults to a real TlsCertFetcher when not provided.
	 */
	fetcher?: CertFetcher;
	/**
	 * Validates sudo credentials with the given password.
	 * When provided, scripts requiring sudo will trigger a password prompt
	 * after the confirmation screen.
	 */
	validateSudo?: (
		password: string,
	) => Promise<{ ok: true } | { ok: false; reason: string }>;
	/** Version string from package.json, shown in the header. */
	version?: string;
	/**
	 * Called once on startup to check for a newer binary release.
	 * Returns `UpdateInfo` if an update is available, `null` otherwise.
	 * When absent, the update phase is skipped entirely.
	 */
	checkForUpdate?: () => Promise<UpdateInfo | null>;
	/**
	 * Downloads and applies the update binary at `downloadUrl`.
	 * When absent, the update screen's apply action is a no-op.
	 */
	applyUpdate?: (downloadUrl: string) => Promise<void>;
}

/**
 * Top-level Ink application component.
 *
 * Renders the persistent Header and Footer around a content area that
 * switches between screens based on app state.
 */
export function App({
	hostInfo,
	repoUrl,
	runStartup,
	runExecution,
	fetcher,
	validateSudo,
	version,
	checkForUpdate,
	applyUpdate,
}: AppProps) {
	const { exit } = useApp();
	// Start on "fetch" if no update check is provided; otherwise wait for Phase 1.
	const [screen, setScreen] = useState<Screen>(
		checkForUpdate ? "fetch" : "fetch",
	);
	const [footerBindings, setFooterBindings] =
		useState<FooterBinding[]>(DEFAULT_BINDINGS);

	// Update check state (Phase 1)
	const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
	const [startupEnabled, setStartupEnabled] = useState(!checkForUpdate);

	// Startup fetch state (Phase 2)
	const [currentEvent, setCurrentEvent] = useState<StartupEvent | null>(null);
	const [fetchDone, setFetchDone] = useState(false);
	const [offline, setOffline] = useState(false);
	const [startupResult, setStartupResult] = useState<StartupResult | null>(
		null,
	);

	// Script list state
	const [resolvedScripts, setResolvedScripts] = useState<ScriptEntry[]>([]);

	// Collected inputs (populated by the input-collection phase; empty map until then)
	const [scriptInputs, setScriptInputs] = useState<ScriptInputs>(
		() => new Map(),
	);

	// Sudo validation state — once validated, skip re-prompting on back-navigation
	const [sudoValidated, setSudoValidated] = useState(false);

	// Cert fetcher — use injected one or fall back to the real TLS fetcher
	const [certFetcher] = useState<CertFetcher>(
		() => fetcher ?? new TlsCertFetcher(),
	);

	// Phase 1: update check. Runs once if checkForUpdate is provided.
	// On update found → show UpdateScreen; on no update or error → enable Phase 2.
	useEffect(() => {
		if (!checkForUpdate) return;
		checkForUpdate()
			.then((info) => {
				if (info !== null) {
					setUpdateInfo(info);
					setScreen("update");
				} else {
					setStartupEnabled(true);
				}
			})
			.catch(() => {
				// Update check failures are silent — proceed normally.
				setStartupEnabled(true);
			});
	}, [checkForUpdate]);

	// Phase 2: run the startup fetch sequence once startupEnabled becomes true.
	useEffect(() => {
		if (!startupEnabled) return;
		runStartup(repoUrl, (event) => {
			setCurrentEvent(event);
		})
			.then((result) => {
				setStartupResult(result);
				setOffline(result.offline);
				setFetchDone(true);
			})
			.catch(() => {
				setFetchDone(true);
				setOffline(true);
			});
	}, [startupEnabled, repoUrl, runStartup]);

	// Auto-advance to script list as soon as the fetch/startup completes.
	useEffect(() => {
		if (fetchDone) {
			setScreen("script-list");
			setFooterBindings(DEFAULT_BINDINGS);
		}
	}, [fetchDone]);

	function handleSkipUpdate() {
		setScreen("fetch");
		setStartupEnabled(true);
	}

	// Handle global quit keys (only when not on input-collection or execution screens).
	// input-collection manages its own Q/Ctrl+C with a cancel confirmation.
	// execution blocks quit while running.
	useInput(
		(input, key) => {
			if (input === "q" || (key.ctrl && input === "c")) {
				exit();
			}
		},
		{
			isActive:
				screen !== "update" &&
				screen !== "input-collection" &&
				screen !== "execution" &&
				screen !== "sudo",
		},
	);

	function handleConfirm(scripts: ScriptEntry[]) {
		setResolvedScripts(scripts);

		// Check if any selected script has inputs to collect (FR-3-050).
		const hasInputs = scripts.some((s) => s.inputs.length > 0);
		if (hasInputs) {
			setScreen("input-collection");
			setFooterBindings([]);
		} else {
			setScreen("confirmation");
			setFooterBindings([
				{ key: "Y / Enter", description: "Run scripts" },
				{ key: "N / Esc", description: "Back" },
				{ key: "Q", description: "Quit" },
			]);
		}
	}

	function handleInputCollectionComplete(collected: ScriptInputs) {
		setScriptInputs(collected);
		setScreen("confirmation");
		setFooterBindings([
			{ key: "Y / Enter", description: "Run scripts" },
			{ key: "N / Esc", description: "Back" },
			{ key: "Q", description: "Quit" },
		]);
	}

	function handleInputCollectionCancel() {
		// FR-3-052: cancel exits cleanly with no scripts run
		exit();
	}

	function handleBack() {
		setScreen("script-list");
		setFooterBindings(DEFAULT_BINDINGS);
	}

	function handleExecute() {
		const needsSudoPrompt =
			validateSudo &&
			!sudoValidated &&
			resolvedScripts.some((s) => s.requires_sudo);

		if (needsSudoPrompt) {
			setScreen("sudo");
			setFooterBindings([{ key: "Esc", description: "Back" }]);
			return;
		}

		setScreen("execution");
		setFooterBindings([]);
	}

	function handleSudoValidated() {
		setSudoValidated(true);
		setScreen("execution");
		setFooterBindings([]);
	}

	function handleSudoBack() {
		setScreen("confirmation");
		setFooterBindings([
			{ key: "Y / Enter", description: "Run scripts" },
			{ key: "N / Esc", description: "Back" },
			{ key: "Q", description: "Quit" },
		]);
	}

	const sourceLabel = currentEvent?.type === "local-mode" ? "local" : repoUrl;

	return (
		<Box flexDirection="column" height="100%">
			<Header hostInfo={hostInfo} sourceLabel={sourceLabel} version={version} />
			<Box flexDirection="column" flexGrow={1} paddingX={1} paddingY={1}>
				{screen === "update" && updateInfo !== null && (
					<UpdateScreen
						updateInfo={updateInfo}
						applyUpdate={applyUpdate ?? (() => Promise.resolve())}
						onSkip={handleSkipUpdate}
					/>
				)}
				{screen === "fetch" && (
					<FetchScreen
						currentEvent={currentEvent}
						done={fetchDone}
						offline={offline}
					/>
				)}
				{screen === "script-list" && startupResult !== null && (
					<ScriptListScreen
						hostInfo={hostInfo}
						startupResult={startupResult}
						onConfirm={handleConfirm}
					/>
				)}
				{screen === "input-collection" && (
					<InputCollectionScreen
						scripts={resolvedScripts.map((s) => ({
							id: s.id,
							name: s.name,
							inputs: s.inputs,
						}))}
						fetcher={certFetcher}
						onComplete={handleInputCollectionComplete}
						onCancel={handleInputCollectionCancel}
					/>
				)}
				{screen === "confirmation" && (
					<ConfirmationScreen
						scripts={resolvedScripts}
						scriptInputs={scriptInputs}
						onConfirm={handleExecute}
						onBack={handleBack}
					/>
				)}
				{screen === "sudo" && validateSudo && (
					<SudoScreen
						validateSudo={validateSudo}
						onValidated={handleSudoValidated}
						onBack={handleSudoBack}
					/>
				)}
				{screen === "execution" && (
					<ExecutionScreen
						scripts={resolvedScripts}
						runExecution={(onProgress) =>
							runExecution(resolvedScripts, onProgress, scriptInputs)
						}
					/>
				)}
			</Box>
			<Footer bindings={footerBindings} />
		</Box>
	);
}
