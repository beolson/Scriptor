import Link from "next/link";

import type { Script } from "@/lib/types";

import styles from "./ScriptRow.module.css";

export interface ScriptRowProps {
	script: Script;
}

export function ScriptRow({ script }: ScriptRowProps) {
	return (
		<div className={styles.row}>
			<Link href={`/scripts/${script.id}`} className={styles.scriptName}>
				{script.title}
			</Link>
			{script.description && (
				<span className={styles.scriptDesc}>
					{"// "}
					{script.description}
				</span>
			)}
		</div>
	);
}
