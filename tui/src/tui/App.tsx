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
import { ConfirmationScreen } from "./ConfirmationScreen.js";
import { ExecutionScreen } from "./ExecutionScreen.js";
import { FetchScreen } from "./FetchScreen.js";
import type { FooterBinding } from "./Footer.js";
import { DEFAULT_BINDINGS, Footer } from "./Footer.js";
import { Header } from "./Header.js";
import { ScriptListScreen } from "./ScriptListScreen.js";
import { SudoScreen } from "./SudoScreen.js";

export type Screen =
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
}: AppProps) {
	const { exit } = useApp();
	const [screen, setScreen] = useState<Screen>("fetch");
	const [footerBindings, setFooterBindings] =
		useState<FooterBinding[]>(DEFAULT_BINDINGS);

	// Startup fetch state
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

	// Run the startup sequence once on mount.
	useEffect(() => {
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
	}, [repoUrl, runStartup]);

	// Auto-advance to script list as soon as the fetch/startup completes.
	useEffect(() => {
		if (fetchDone) {
			setScreen("script-list");
			setFooterBindings(DEFAULT_BINDINGS);
		}
	}, [fetchDone]);

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

	const sourceLabel =
		currentEvent?.type === "local-mode" ? "local" : repoUrl;

	return (
		<Box flexDirection="column" height="100%">
			<Header hostInfo={hostInfo} sourceLabel={sourceLabel} />
			<Box flexDirection="column" flexGrow={1} paddingX={1} paddingY={1}>
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
