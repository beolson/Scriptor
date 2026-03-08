"use client";

import hljs from "highlight.js";
import { useState } from "react";
import styles from "./ScriptViewer.module.css";

interface ScriptViewerProps {
	scriptSource: string | undefined;
	scriptPath: string;
}

/**
 * Map a script file extension to a highlight.js language identifier.
 */
function getLanguage(scriptPath: string): string {
	if (scriptPath.endsWith(".sh")) return "bash";
	if (scriptPath.endsWith(".ps1")) return "powershell";
	if (scriptPath.endsWith(".zsh")) return "zsh";
	if (scriptPath.endsWith(".py")) return "python";
	if (scriptPath.endsWith(".js")) return "javascript";
	return "plaintext";
}

export default function ScriptViewer({
	scriptSource,
	scriptPath,
}: ScriptViewerProps) {
	const [expanded, setExpanded] = useState(false);

	if (!scriptSource) {
		return null;
	}

	const language = getLanguage(scriptPath);
	const highlighted = hljs.highlight(scriptSource, { language }).value;

	return (
		<div className={styles.section}>
			<button
				type="button"
				className={styles.toggle}
				onClick={() => setExpanded((prev) => !prev)}
				aria-expanded={expanded}
			>
				<span className={styles.label}>{"// script"}</span>
				<span className={styles.chevron}>{expanded ? "[-]" : "[+]"}</span>
			</button>
			{expanded && (
				<div className={styles.codeWrapper}>
					<pre className={styles.pre}>
						<code
							className={`hljs ${styles.code}`}
							// biome-ignore lint/security/noDangerouslySetInnerHtml: highlighted HTML from hljs
							dangerouslySetInnerHTML={{ __html: highlighted }}
						/>
					</pre>
				</div>
			)}
		</div>
	);
}
