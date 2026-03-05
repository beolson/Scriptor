"use client";

import { useMemo, useState } from "react";
import type { Script } from "../../../lib/types";
import Breadcrumb from "../Breadcrumb/Breadcrumb";
import CodeBlock from "../CodeBlock/CodeBlock";
import DistroGroupHeader from "../DistroGroupHeader/DistroGroupHeader";
import ScriptRow from "../ScriptRow/ScriptRow";
import styles from "./ScriptFilter.module.css";

type Props = {
	scripts: Script[];
	platform: "linux" | "windows" | "mac";
	heading: string;
	installLanguage: string;
	installCommand: string;
	breadcrumbs: Array<{ label: string; href?: string }>;
};

function archLabel(arch: string): string {
	if (arch === "any") return "[any]";
	if (arch === "x86") return "[x86_64]";
	if (arch === "arm") return "[arm64]";
	return `[${arch}]`;
}

function distroLabel(distro: string): string {
	if (distro === "any") return "[any]";
	return `[${distro.toLowerCase()}]`;
}

function versionLabel(version: string): string {
	if (version === "any") return "[any]";
	return `[${version}]`;
}

export default function ScriptFilter({
	scripts,
	platform,
	heading,
	installLanguage,
	installCommand,
	breadcrumbs,
}: Props) {
	const [selectedArch, setSelectedArch] = useState<string>("any");
	const [selectedDistro, setSelectedDistro] = useState<string>("any");
	const [selectedVersion, setSelectedVersion] = useState<string>("any");

	const arches = useMemo(
		() => ["any", ...Array.from(new Set(scripts.map((s) => s.arch))).sort()],
		[scripts],
	);

	const distros = useMemo(() => {
		const unique = Array.from(
			new Set(scripts.flatMap((s) => (s.distro ? [s.distro] : []))),
		).sort();
		return ["any", ...unique];
	}, [scripts]);

	const versions = useMemo(() => {
		const relevant =
			selectedDistro === "any"
				? scripts
				: scripts.filter((s) => s.distro === selectedDistro);
		const unique = Array.from(
			new Set(relevant.flatMap((s) => (s.version ? [s.version] : []))),
		).sort();
		return ["any", ...unique];
	}, [scripts, selectedDistro]);

	const filteredScripts = useMemo(
		() =>
			scripts
				.filter((s) => {
					if (selectedArch !== "any" && s.arch !== selectedArch) return false;
					if (
						selectedDistro !== "any" &&
						s.distro !== undefined &&
						s.distro !== selectedDistro
					)
						return false;
					if (
						selectedVersion !== "any" &&
						s.version !== undefined &&
						s.version !== selectedVersion
					)
						return false;
					return true;
				})
				.sort((a, b) => a.name.localeCompare(b.name)),
		[scripts, selectedArch, selectedDistro, selectedVersion],
	);

	function handleDistroChange(distro: string) {
		setSelectedDistro(distro);
		if (selectedVersion !== "any") {
			const versionStillValid = scripts.some(
				(s) =>
					(distro === "any" || s.distro === distro) &&
					s.version === selectedVersion,
			);
			if (!versionStillValid) setSelectedVersion("any");
		}
	}

	const groups = useMemo(() => {
		if (platform !== "linux") return null;
		const map = new Map<string, Script[]>();
		for (const script of filteredScripts) {
			const key = script.distro ?? "other";
			const group = map.get(key) ?? [];
			group.push(script);
			map.set(key, group);
		}
		return map;
	}, [filteredScripts, platform]);

	return (
		<>
			<div className={styles.pageHeader} data-testid="platform-header">
				<Breadcrumb segments={breadcrumbs} />
				<h1 className={styles.heading}>{heading}</h1>
				<div className={styles.installRow}>
					<CodeBlock wide language={installLanguage} command={installCommand} />
				</div>
				{arches.length > 2 && (
					<div className={styles.filterRow}>
						<span className={styles.filterLabel}>{"// arch:"}</span>
						{arches.map((arch) => (
							<button
								key={arch}
								type="button"
								className={
									arch === selectedArch
										? styles.filterTabActive
										: styles.filterTab
								}
								onClick={() => setSelectedArch(arch)}
							>
								{archLabel(arch)}
							</button>
						))}
					</div>
				)}
				{distros.length > 2 && (
					<div className={styles.filterRow}>
						<span className={styles.filterLabel}>{"// distro:"}</span>
						{distros.map((distro) => (
							<button
								key={distro}
								type="button"
								className={
									distro === selectedDistro
										? styles.filterTabActive
										: styles.filterTab
								}
								onClick={() => handleDistroChange(distro)}
							>
								{distroLabel(distro)}
							</button>
						))}
					</div>
				)}
				{versions.length > 2 && (
					<div className={styles.filterRow}>
						<span className={styles.filterLabel}>{"// version:"}</span>
						{versions.map((version) => (
							<button
								key={version}
								type="button"
								className={
									version === selectedVersion
										? styles.filterTabActive
										: styles.filterTab
								}
								onClick={() => setSelectedVersion(version)}
							>
								{versionLabel(version)}
							</button>
						))}
					</div>
				)}
				<span className={styles.count}>
					{"// "}
					{filteredScripts.length} scripts available
				</span>
			</div>
			<div className={styles.scriptList} data-testid="script-list">
				{platform === "linux" && groups !== null
					? Array.from(groups.entries()).map(([distro, groupScripts]) => (
							<div key={distro}>
								<DistroGroupHeader distro={distro} />
								{groupScripts.map((script) => (
									<ScriptRow
										key={script.id}
										name={script.name}
										description={script.description}
										arch={script.arch}
										distro={script.distro}
										version={script.version}
										href={`/scripts/${script.id}`}
									/>
								))}
							</div>
						))
					: filteredScripts.map((script) => (
							<ScriptRow
								key={script.id}
								name={script.name}
								description={script.description}
								arch={script.arch}
								distro={script.distro}
								version={script.version}
								href={`/scripts/${script.id}`}
							/>
						))}
			</div>
		</>
	);
}
