import { Box, Text, useInput } from "ink";

export function AdminRequiredScreen({ onBack }: { onBack: () => void }) {
	useInput((_input, key) => {
		if (key.escape) onBack();
	});

	return (
		<Box flexDirection="column" gap={1}>
			<Text bold color="yellow">
				Administrator Privileges Required
			</Text>
			<Text>This script requires Administrator privileges.</Text>
			<Text>Scriptor is not currently running as Administrator.</Text>
			<Box marginTop={1} flexDirection="column">
				<Text>To fix this:</Text>
				<Text>{"  1. Close Scriptor"}</Text>
				<Text>{"  2. Right-click scriptor.exe"}</Text>
				<Text>{'  3. Select "Run as administrator"'}</Text>
			</Box>
		</Box>
	);
}
