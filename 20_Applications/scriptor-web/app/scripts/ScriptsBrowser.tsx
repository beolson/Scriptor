"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { FilterButton } from "@/components/ui/filter-button";
import { formatTarget } from "@/lib/formatTarget";
import type { Script } from "@/lib/types";

import styles from "./ScriptsBrowser.module.css";

export interface ScriptsBrowserProps {
	scripts: Script[];
}

export function ScriptsBrowser({ scripts }: ScriptsBrowserProps) {
	const [target, setTarget] = useState<string | null>(null);

	// ─── Derived filter logic ────────────────────────────────────────────────

	/** Unique targets present in the loaded script list, sorted alphabetically */
	const presentTargets = useMemo(
		() => [...new Set(scripts.map((s) => s.platform))].sort(),
		[scripts],
	);

	/** The filtered script list based on active target */
	const filtered = target
		? scripts.filter((s) => s.platform === target)
		: scripts;

	// ─── Handler ────────────────────────────────────────────────────────────

	function handleTargetClick(t: string) {
		if (target === t) {
			setTarget(null);
		} else {
			setTarget(t);
		}
	}

	// ─── Render ───────────────────────────────────────────────────────────────

	return (
		<div className={styles.browser}>
			{/* Flat target filter row */}
			<div className={styles.filterRow}>
				{presentTargets.map((t) => (
					<FilterButton
						key={t}
						label={formatTarget(t)}
						active={target === t}
						disabled={false}
						onClick={() => handleTargetClick(t)}
					/>
				))}
			</div>

			{/* Script list */}
			{filtered.length === 0 ? (
				<EmptyState />
			) : (
				<ul className={styles.scriptList}>
					{filtered.map((script) => (
						<li key={script.id} className={styles.scriptItem}>
							<Link
								href={`/scripts/${script.id}`}
								className={styles.scriptLink}
							>
								{script.title}
							</Link>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
