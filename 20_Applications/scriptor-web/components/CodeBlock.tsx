import { CopyButton } from "@/components/ui/copy-button";

import styles from "./CodeBlock.module.css";

export interface CodeBlockProps {
	label: string;
	command: string;
}

export function CodeBlock({ label, command }: CodeBlockProps) {
	return (
		<div className={styles.codeBlock}>
			<div className={styles.header}>
				<span className={styles.label}>{label}</span>
				<CopyButton text={command} label="[copy]" />
			</div>
			<span className={styles.command}>{command}</span>
		</div>
	);
}
