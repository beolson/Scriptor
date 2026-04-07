"use client";

import { useState } from "react";

import styles from "./copy-button.module.css";

export interface CopyButtonProps {
	text: string;
	label?: string;
}

export function CopyButton({ text, label = "Copy" }: CopyButtonProps) {
	const [copied, setCopied] = useState(false);

	async function handleClick() {
		if (navigator.clipboard) {
			await navigator.clipboard.writeText(text);
		} else {
			const textarea = document.createElement("textarea");
			textarea.value = text;
			textarea.style.position = "fixed";
			textarea.style.opacity = "0";
			document.body.appendChild(textarea);
			textarea.select();
			document.execCommand("copy");
			document.body.removeChild(textarea);
		}
		setCopied(true);
		setTimeout(() => {
			setCopied(false);
		}, 1500);
	}

	return (
		<button type="button" className={styles.copyButton} onClick={handleClick}>
			{copied ? "Copied!" : label}
		</button>
	);
}
