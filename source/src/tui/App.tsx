import { Box, useApp, useInput } from "ink";
import { useEffect, useState } from "react";
import type {
	ProgressEvent,
	ScriptRunResult,
} from "../execution/scriptRunner.js";
import type { HostInfo } from "../host/detectHost.js";
import type { ScriptEntry } from "../manifest/parseManifest.js";
import type { StartupEvent, StartupResult } from "../startup/startup.js";
import { ConfirmationScreen } from "./ConfirmationScreen.js";
import { ExecutionScreen } from "./ExecutionScreen.js";
import { FetchScreen } from "./FetchScreen.js";
import type { FooterBinding } from "./Footer.js";
import { DEFAULT_BINDINGS, Footer } from "./Footer.js";
import { Header } from "./Header.js";
import { ScriptListScreen } from "./ScriptListScreen.js";

export type Screen = "fetch" | "script-list" | "confirmation" | "execution";

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
	) => Promise<ScriptRunResult>;
}

/**
 * Top-level Ink application component.
 *
 * Renders the persistent Header and Footer around a content area that
 * switches between screens based on app state.
 */
export function App({ hostInfo, repoUrl, runStartup, runExecution }: AppProps) {
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

	// Handle global quit keys (only when not executing scripts).
	useInput((input, key) => {
		if (input === "q" || (key.ctrl && input === "c")) {
			exit();
		}
		// On the fetch screen, Enter advances to the script list once loading is done.
		if (screen === "fetch" && fetchDone && key.return) {
			setScreen("script-list");
			setFooterBindings(DEFAULT_BINDINGS);
		}
	});

	function handleConfirm(scripts: ScriptEntry[]) {
		setResolvedScripts(scripts);
		setScreen("confirmation");
		setFooterBindings([
			{ key: "Y / Enter", description: "Run scripts" },
			{ key: "N / Esc", description: "Back" },
			{ key: "Q", description: "Quit" },
		]);
	}

	function handleBack() {
		setScreen("script-list");
		setFooterBindings(DEFAULT_BINDINGS);
	}

	function handleExecute() {
		setScreen("execution");
		setFooterBindings([]);
	}

	return (
		<Box flexDirection="column" height="100%">
			<Header hostInfo={hostInfo} repoUrl={repoUrl} />
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
				{screen === "confirmation" && (
					<ConfirmationScreen
						scripts={resolvedScripts}
						onConfirm={handleExecute}
						onBack={handleBack}
					/>
				)}
				{screen === "execution" && (
					<ExecutionScreen
						scripts={resolvedScripts}
						runExecution={(onProgress) =>
							runExecution(resolvedScripts, onProgress)
						}
					/>
				)}
			</Box>
			<Footer bindings={footerBindings} />
		</Box>
	);
}
