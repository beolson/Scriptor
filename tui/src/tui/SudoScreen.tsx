import { Box, Text, useInput } from "ink";
import { useEffect, useState } from "react";

export interface SudoScreenProps {
	validateSudo: (
		password: string,
	) => Promise<{ ok: true } | { ok: false; reason: string }>;
	onValidated: () => void;
	onBack: () => void;
}

type Phase = "checking" | "prompt" | "validating";

/**
 * Screen that handles sudo authentication within the TUI.
 *
 * On mount, checks whether sudo credentials are already cached (empty password).
 * If not, renders a masked password input. On Enter, validates the password.
 */
export function SudoScreen({
	validateSudo,
	onValidated,
	onBack,
}: SudoScreenProps) {
	const [phase, setPhase] = useState<Phase>("checking");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);

	// On mount, check if sudo is already cached
	useEffect(() => {
		let cancelled = false;
		validateSudo("").then((result) => {
			if (cancelled) return;
			if (result.ok) {
				onValidated();
			} else {
				setPhase("prompt");
			}
		});
		return () => {
			cancelled = true;
		};
	}, [validateSudo, onValidated]);

	useInput(
		(input, key) => {
			if (key.escape) {
				onBack();
				return;
			}

			if (key.return) {
				setPhase("validating");
				setError(null);
				validateSudo(password).then((result) => {
					if (result.ok) {
						onValidated();
					} else {
						setError(result.reason);
						setPhase("prompt");
					}
				});
				return;
			}

			if (key.backspace || key.delete) {
				setPassword((v) => v.slice(0, -1));
				setError(null);
				return;
			}

			if (input.length > 0 && !key.ctrl && !key.meta) {
				setPassword((v) => v + input);
				setError(null);
			}
		},
		{ isActive: phase === "prompt" },
	);

	if (phase === "checking") {
		return (
			<Box flexDirection="column">
				<Text>Checking sudo credentials…</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" gap={0}>
			<Text bold>Sudo authentication required</Text>

			{phase === "validating" ? (
				<Text color="yellow">Validating…</Text>
			) : (
				<Box flexDirection="row">
					<Text>Password: </Text>
					<Text>{"*".repeat(password.length)}</Text>
					<Text inverse> </Text>
				</Box>
			)}

			{error !== null && <Text color="red">{error}</Text>}
		</Box>
	);
}
