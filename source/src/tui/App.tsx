import { Box, Text, useApp, useInput } from "ink";
import { useState } from "react";
import type { HostInfo } from "../host/detectHost.js";
import type { FooterBinding } from "./Footer.js";
import { DEFAULT_BINDINGS, Footer } from "./Footer.js";
import { Header } from "./Header.js";

export type Screen = "placeholder";

export interface AppProps {
	hostInfo: HostInfo;
	repoUrl: string;
}

/**
 * Top-level Ink application component.
 *
 * Renders the persistent Header and Footer around a content area that
 * switches between screens based on app state.
 *
 * Currently displays a placeholder content area; future tasks will wire in
 * FetchScreen, ScriptListScreen, ConfirmationScreen, and ExecutionScreen.
 */
export function App({ hostInfo, repoUrl }: AppProps) {
	const { exit } = useApp();
	const [_screen, _setScreen] = useState<Screen>("placeholder");
	const [footerBindings, _setFooterBindings] =
		useState<FooterBinding[]>(DEFAULT_BINDINGS);

	// Handle global quit keys.
	useInput((input, key) => {
		if (input === "q" || (key.ctrl && input === "c")) {
			exit();
		}
	});

	return (
		<Box flexDirection="column" height="100%">
			<Header hostInfo={hostInfo} repoUrl={repoUrl} />
			<Box flexDirection="column" flexGrow={1} paddingX={1} paddingY={1}>
				<PlaceholderScreen />
			</Box>
			<Footer bindings={footerBindings} />
		</Box>
	);
}

/**
 * Temporary placeholder shown until the fetch/script-list screens are built
 * in later tasks.
 */
function PlaceholderScreen() {
	return (
		<Box flexDirection="column" gap={1}>
			<Text bold={true}>Scriptor is starting up…</Text>
			<Text dimColor={true}>
				Press <Text bold={true}>Q</Text> to quit.
			</Text>
		</Box>
	);
}
