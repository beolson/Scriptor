"use client";

import { useState } from "react";
import styles from "./CodeBlock.module.css";

interface CodeBlockProps {
	language: string;
	command: string;
	wide?: boolean;
	fullWidth?: boolean;
}

export default function CodeBlock({
	language,
	command,
	wide = false,
	fullWidth = false,
}: CodeBlockProps) {
	const [copied, setCopied] = useState(false);

	const PROMPT_PREFIX = "$ ";
	const hasPrompt = command.startsWith(PROMPT_PREFIX);
	const displayCommand = hasPrompt
		? command.slice(PROMPT_PREFIX.length)
		: command;

	function handleCopy() {
		navigator.clipboard.writeText(displayCommand);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}

	const widthClass = fullWidth
		? styles.fullWidth
		: wide
			? styles.wide
			: styles.default;

	return (
		<div
			className={`${styles.codeBlock} ${widthClass}`}
			data-testid="code-block"
		>
			<div className={styles.header}>
				<span className={styles.language}>{language}</span>
				<button
					type="button"
					className={styles.copyButton}
					onClick={handleCopy}
					data-testid="copy-button"
				>
					{copied ? "[copied]" : "[copy]"}
				</button>
			</div>
			<div className={styles.command} data-testid="command-text">
				{hasPrompt && <span className={styles.prompt}>$ </span>}
				{displayCommand}
			</div>
		</div>
	);
}
