import { Box, Text } from "ink";

export interface FooterBinding {
	/** Key label shown to the user, e.g. "↑↓" or "Space" */
	key: string;
	/** Description of the action, e.g. "Navigate" */
	description: string;
}

export interface FooterProps {
	bindings: FooterBinding[];
}

/**
 * Persistent footer bar showing contextual key binding hints.
 */
export function Footer({ bindings }: FooterProps) {
	return (
		<Box
			borderStyle="single"
			borderTop={true}
			borderBottom={false}
			borderLeft={false}
			borderRight={false}
			paddingX={1}
			gap={2}
		>
			{bindings.map((binding, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: static binding list, order never changes
				<Text key={i}>
					<Text bold={true}>{binding.key}</Text>
					<Text dimColor={true}>{` ${binding.description}`}</Text>
				</Text>
			))}
		</Box>
	);
}

/** Default key bindings used by most screens. */
export const DEFAULT_BINDINGS: FooterBinding[] = [
	{ key: "↑↓", description: "Navigate" },
	{ key: "Space", description: "Select" },
	{ key: "Enter", description: "Confirm" },
	{ key: "Q", description: "Quit" },
];
