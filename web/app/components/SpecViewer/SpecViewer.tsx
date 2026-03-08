"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import styles from "./SpecViewer.module.css";

interface SpecViewerProps {
	spec: string | undefined;
}

export default function SpecViewer({ spec }: SpecViewerProps) {
	const [expanded, setExpanded] = useState(false);

	if (!spec) {
		return null;
	}

	return (
		<div className={styles.section}>
			<button
				type="button"
				className={styles.toggle}
				onClick={() => setExpanded((prev) => !prev)}
				aria-expanded={expanded}
			>
				<span className={styles.label}>{"// spec"}</span>
				<span className={styles.chevron}>
					{expanded ? "[-]" : "[+]"}
				</span>
			</button>
			{expanded && (
				<div className={styles.content} data-testid="spec-content">
					<ReactMarkdown rehypePlugins={[rehypeHighlight]}>
						{spec}
					</ReactMarkdown>
				</div>
			)}
		</div>
	);
}
