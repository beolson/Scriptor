import { Box, Text, useApp, useInput } from "ink";
import { useState } from "react";
import type { UpdateInfo } from "../updater/checkForUpdate.js";

export interface UpdateScreenProps {
	updateInfo: UpdateInfo;
	applyUpdate: (downloadUrl: string) => Promise<void>;
	onSkip: () => void;
}

type Phase = "prompt" | "downloading" | "done" | "error";

/**
 * Screen shown when a newer Scriptor version is available.
 *
 * Prompts the user to update or skip. Handles download progress and error states.
 */
export function UpdateScreen({
	updateInfo,
	applyUpdate,
	onSkip,
}: UpdateScreenProps) {
	const { exit } = useApp();
	const [phase, setPhase] = useState<Phase>("prompt");
	const [errorMessage, setErrorMessage] = useState<string>("");

	useInput(
		(input, key) => {
			if (input === "y" || input === "Y") {
				setPhase("downloading");
				applyUpdate(updateInfo.downloadUrl)
					.then(() => {
						setPhase("done");
					})
					.catch((err: unknown) => {
						setErrorMessage(err instanceof Error ? err.message : String(err));
						setPhase("error");
					});
				return;
			}

			if (input === "n" || input === "N" || key.escape) {
				onSkip();
			}
		},
		{ isActive: phase === "prompt" || phase === "error" },
	);

	// Auto-exit after showing "done" message
	if (phase === "done") {
		// Give Ink one render cycle to show the message, then exit
		setTimeout(() => exit(), 80);
	}

	return (
		<Box flexDirection="column" gap={1}>
			{phase === "prompt" && (
				<>
					<Text bold>Update available</Text>
					<Text>
						v{updateInfo.currentVersion} → v{updateInfo.latestVersion}
					</Text>
					<Text>
						<Text color="green">[Y]</Text> Update{"  "}
						<Text color="yellow">[N]</Text> Skip
					</Text>
				</>
			)}

			{phase === "downloading" && (
				<Text>Downloading {updateInfo.assetName}…</Text>
			)}

			{phase === "done" && (
				<Text color="green">Update applied. Please restart Scriptor.</Text>
			)}

			{phase === "error" && (
				<>
					<Text color="red">{errorMessage}</Text>
					<Text>
						<Text color="yellow">[N]</Text> Skip
					</Text>
				</>
			)}
		</Box>
	);
}
