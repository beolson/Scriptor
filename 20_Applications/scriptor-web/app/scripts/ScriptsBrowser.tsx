"use client";

import Link from "next/link";
import { useState } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { FilterButton } from "@/components/ui/filter-button";
import { PLATFORMS } from "@/lib/platforms";
import type { Platform, Script } from "@/lib/types";

import styles from "./ScriptsBrowser.module.css";

export interface ScriptsBrowserProps {
	scripts: Script[];
}

export function ScriptsBrowser({ scripts }: ScriptsBrowserProps) {
	const [platform, setPlatform] = useState<Platform | null>(null);
	const [os, setOs] = useState<string | null>(null);

	// ─── Derived filter logic ────────────────────────────────────────────────

	/** Unique platforms present in the loaded script list */
	const presentPlatforms = Array.from(
		new Set(scripts.map((s) => s.platform)),
	).sort() as Platform[];

	/** Unique OS values present for a given platform */
	function osValuesForPlatform(p: Platform): string[] {
		return Array.from(
			new Set(scripts.filter((s) => s.platform === p).map((s) => s.os)),
		).sort();
	}

	/**
	 * Returns true if selecting the given platform would yield at least one
	 * result, given the current `os` filter (ignoring the current platform filter).
	 */
	function isPlatformEnabled(p: Platform): boolean {
		return scripts.some((s) => {
			const platformMatch = s.platform === p;
			const osMatch = os === null || s.os === os;
			return platformMatch && osMatch;
		});
	}

	/**
	 * Returns true if selecting the given OS would yield at least one result,
	 * given the current `platform` filter (ignoring the current os filter).
	 */
	function isOsEnabled(o: string): boolean {
		return scripts.some((s) => {
			const platformMatch = platform === null || s.platform === platform;
			const osMatch = s.os === o;
			return platformMatch && osMatch;
		});
	}

	/** The filtered script list based on active filters */
	const filtered = scripts.filter((s) => {
		const platformMatch = platform === null || s.platform === platform;
		const osMatch = os === null || s.os === os;
		return platformMatch && osMatch;
	});

	// ─── Handlers ────────────────────────────────────────────────────────────

	function handlePlatformClick(p: Platform) {
		if (platform === p) {
			setPlatform(null);
		} else {
			setPlatform(p);
			// Reset OS filter when platform changes
			setOs(null);
		}
	}

	function handleOsClick(o: string) {
		if (os === o) {
			setOs(null);
		} else {
			setOs(o);
		}
	}

	// ─── Render ───────────────────────────────────────────────────────────────

	const osValues = platform !== null ? osValuesForPlatform(platform) : [];

	return (
		<div className={styles.browser}>
			{/* Platform filter row */}
			<div className={styles.filterRow}>
				{presentPlatforms.map((p) => (
					<FilterButton
						key={p}
						label={PLATFORMS[p].label}
						active={platform === p}
						disabled={!isPlatformEnabled(p)}
						onClick={() => handlePlatformClick(p)}
					/>
				))}
			</div>

			{/* OS filter row — only shown when a platform is selected */}
			{platform !== null && osValues.length > 0 && (
				<div className={styles.filterRow}>
					{osValues.map((o) => (
						<FilterButton
							key={o}
							label={o}
							active={os === o}
							disabled={!isOsEnabled(o)}
							onClick={() => handleOsClick(o)}
						/>
					))}
				</div>
			)}

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
