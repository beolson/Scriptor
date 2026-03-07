import { Box, Text, useApp, useInput } from "ink";
import type { CollectedInput, ScriptInputs } from "../inputs/inputSchema.js";
import type { ScriptEntry } from "../manifest/parseManifest.js";

export interface ConfirmationScreenProps {
	/** The fully resolved, ordered list of scripts that will execute. */
	scripts: ScriptEntry[];
	/**
	 * Collected input values for each script, keyed by script id.
	 * Scripts absent from the map (or with an empty array) have no inputs to display.
	 */
	scriptInputs: ScriptInputs;
	/** Called when the user confirms with Enter or Y. */
	onConfirm: () => void;
	/** Called when the user presses Escape or N to go back to the script list. */
	onBack: () => void;
}

/**
 * Displays the complete ordered execution list and asks the user to confirm
 * before any scripts run.
 *
 * - Enter or Y: confirm and proceed to the Execution screen.
 * - Escape or N: return to the Script List screen (selections preserved).
 * - Q / Ctrl+C: quit the application.
 */
/**
 * Renders the collected inputs for a single script beneath its name row.
 * For `ssl-cert` inputs, shows the download path and cert CN (FR-3-041).
 * For all other types, shows `label: value`.
 */
function ScriptInputsList({ inputs }: { inputs: CollectedInput[] }) {
	if (inputs.length === 0) return null;
	return (
		<Box flexDirection="column" paddingLeft={4}>
			{inputs.map((inp) => {
				const valueText =
					inp.certCN !== undefined ? `${inp.value} (${inp.certCN})` : inp.value;
				return (
					<Box key={inp.id} flexDirection="row" gap={1}>
						<Text dimColor={true}>{inp.label}:</Text>
						<Text>{valueText}</Text>
					</Box>
				);
			})}
		</Box>
	);
}

export function ConfirmationScreen({
	scripts,
	scriptInputs,
	onConfirm,
	onBack,
}: ConfirmationScreenProps) {
	const { exit } = useApp();

	useInput((input, key) => {
		// Global quit
		if (input === "q" || (key.ctrl && input === "c")) {
			exit();
			return;
		}

		// Confirm: Enter or Y
		if (key.return || input === "y" || input === "Y") {
			onConfirm();
			return;
		}

		// Back: Escape or N
		if (key.escape || input === "n" || input === "N") {
			onBack();
			return;
		}
	});

	return (
		<Box flexDirection="column" gap={1}>
			<Text bold={true}>The following scripts will run in order:</Text>

			<Box flexDirection="column" gap={0} paddingLeft={2}>
				{scripts.map((entry, index) => {
					const inputs = scriptInputs.get(entry.id) ?? [];
					return (
						<Box key={entry.id} flexDirection="column">
							<Box flexDirection="row" gap={1}>
								<Text dimColor={true}>{`${index + 1}.`}</Text>
								<Text>{entry.name}</Text>
								<Text dimColor={true}>{`— ${entry.description}`}</Text>
							</Box>
							<ScriptInputsList inputs={inputs} />
						</Box>
					);
				})}
			</Box>

			<Box flexDirection="column" gap={0} marginTop={1}>
				<Text>
					<Text bold={true} color="green">
						{"Y / Enter"}
					</Text>
					<Text dimColor={true}>{" — Run these scripts"}</Text>
				</Text>
				<Text>
					<Text bold={true} color="yellow">
						{"N / Esc"}
					</Text>
					<Text dimColor={true}>{" — Go back to the script list"}</Text>
				</Text>
			</Box>
		</Box>
	);
}
