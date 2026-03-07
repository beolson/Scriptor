import { Box, Text } from "ink";
import type { StartupEvent } from "../startup/startup.js";

export interface FetchScreenProps {
	/** The latest startup event emitted by runStartup, or null before the first event. */
	currentEvent: StartupEvent | null;
	/** True when the startup sequence has completed (success or failure). */
	done: boolean;
	/** True when running in offline mode (loaded from cache). */
	offline: boolean;
}

/**
 * Displays step-by-step progress during the startup fetch sequence.
 *
 * Renders one of several states depending on the latest `StartupEvent`:
 * - Fetching manifest
 * - Fetching script N of M: <name>
 * - Error: manifest not found / failed to fetch script <name>
 * - OAuth in progress
 * - Offline warning banner
 * - Loading from cache (done, offline)
 * - Ready (done, online)
 */
export function FetchScreen({ currentEvent, done, offline }: FetchScreenProps) {
	if (done) {
		if (currentEvent?.type === "local-mode") {
			return (
				<Box flexDirection="column" gap={1}>
					<Box>
						<Text color="cyan" bold={true}>
							{"Local mode: "}
						</Text>
						<Text color="cyan">
							{`Using scriptor.yaml from ${currentEvent.cwd}`}
						</Text>
					</Box>
					<Text dimColor={true}>Press Enter to continue.</Text>
				</Box>
			);
		}
		if (offline) {
			return (
				<Box flexDirection="column" gap={1}>
					<Box>
						<Text color="yellow" bold={true}>
							{"Warning: "}
						</Text>
						<Text color="yellow">
							GitHub is unreachable. Running from cached scripts.
						</Text>
					</Box>
					<Text dimColor={true}>Press Enter to continue.</Text>
				</Box>
			);
		}
		return (
			<Box flexDirection="column" gap={1}>
				<Text color="green">Scripts loaded successfully.</Text>
				<Text dimColor={true}>Press Enter to continue.</Text>
			</Box>
		);
	}

	if (currentEvent === null) {
		return (
			<Box>
				<Text dimColor={true}>Connecting to GitHub…</Text>
			</Box>
		);
	}

	switch (currentEvent.type) {
		case "fetching-manifest":
			return (
				<Box>
					<Text>Fetching manifest…</Text>
				</Box>
			);

		case "fetching-script":
			return (
				<Box>
					<Text>
						{`Fetching script ${currentEvent.index} of ${currentEvent.total}: `}
						<Text bold={true}>{currentEvent.scriptName}</Text>
					</Text>
				</Box>
			);

		case "script-error":
			return (
				<Box>
					<Text color="red">
						{`Error: failed to fetch script ${currentEvent.scriptPath}`}
					</Text>
				</Box>
			);

		case "manifest-error":
			return (
				<Box flexDirection="column" gap={1}>
					<Text color="red">Error: manifest not found.</Text>
					<Text dimColor={true}>{currentEvent.error}</Text>
				</Box>
			);

		case "offline-warning":
			return (
				<Box flexDirection="column" gap={1}>
					<Box>
						<Text color="yellow" bold={true}>
							{"Warning: "}
						</Text>
						<Text color="yellow">
							GitHub is unreachable. Falling back to cached scripts.
						</Text>
					</Box>
					<Text dimColor={true}>{currentEvent.reason}</Text>
				</Box>
			);

		case "oauth-started":
			return (
				<Box flexDirection="column" gap={1}>
					<Text>Requesting GitHub device authorization…</Text>
				</Box>
			);

		case "oauth-device-code":
			return (
				<Box flexDirection="column" gap={1}>
					<Text>
						{"Open "}
						<Text bold={true}>{currentEvent.verificationUri}</Text>
						{" and enter this code:"}
					</Text>
					<Text bold={true} color="cyan">
						{currentEvent.userCode}
					</Text>
					<Text dimColor={true}>Waiting for authorization…</Text>
				</Box>
			);

		case "local-mode":
			return (
				<Box>
					<Text>Loading from local directory…</Text>
				</Box>
			);

		default: {
			// Exhaustive check — TypeScript will warn if a new event type is added
			// without updating this switch.
			const _exhaustive: never = currentEvent;
			return (
				<Box>
					<Text dimColor={true}>Working…</Text>
				</Box>
			);
		}
	}
}
