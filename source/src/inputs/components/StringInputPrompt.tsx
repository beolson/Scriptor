import { Box, Text, useInput } from "ink";
import { useState } from "react";
import type { StringInputDef } from "../inputSchema.js";

export interface StringInputPromptProps {
	inputDef: StringInputDef;
	scriptName: string;
	onSubmit: (value: string) => void;
}

/**
 * Prompts the user for a single string value.
 *
 * - Displays the owning script's name as a context label (FR-3-003).
 * - Pre-fills `default` when declared (FR-3-021).
 * - If `required` and the field is blank, shows an inline error without
 *   calling `onSubmit` (FR-3-020).
 */
export function StringInputPrompt({
	inputDef,
	scriptName,
	onSubmit,
}: StringInputPromptProps) {
	const [value, setValue] = useState(
		inputDef.default !== undefined ? String(inputDef.default) : "",
	);
	const [error, setError] = useState<string | null>(null);

	useInput((input, key) => {
		if (key.return) {
			if (inputDef.required && value.trim() === "") {
				setError("This field is required.");
				return;
			}
			setError(null);
			onSubmit(value);
			return;
		}

		if (key.backspace || key.delete) {
			setValue((v) => v.slice(0, -1));
			setError(null);
			return;
		}

		// Ignore non-printable / control sequences
		if (input.length > 0 && !key.ctrl && !key.meta) {
			setValue((v) => v + input);
			setError(null);
		}
	});

	return (
		<Box flexDirection="column" gap={0}>
			{/* Script context label (FR-3-003) */}
			<Text dimColor={true}>{scriptName}</Text>

			{/* Prompt line */}
			<Box flexDirection="row" gap={1}>
				<Text>{inputDef.label}:</Text>
				<Text>{value}</Text>
				<Text inverse={true}> </Text>
			</Box>

			{/* Inline validation error */}
			{error !== null && (
				<Box marginTop={0}>
					<Text color="red">{error}</Text>
				</Box>
			)}
		</Box>
	);
}
