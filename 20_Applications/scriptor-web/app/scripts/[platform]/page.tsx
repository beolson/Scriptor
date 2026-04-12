import { notFound } from "next/navigation";

import { GroupRow } from "@/components/GroupRow";
import { ScriptRow } from "@/components/ScriptRow";
import { loadGroups } from "@/lib/loadGroups";
import { loadPlatforms } from "@/lib/loadPlatforms";
import { loadScripts } from "@/lib/loadScripts";

import styles from "./page.module.css";

export async function generateStaticParams(): Promise<{ platform: string }[]> {
	const platforms = await loadPlatforms();
	return Object.keys(platforms).map((platform) => ({ platform }));
}

interface PageProps {
	params: Promise<{ platform: string }>;
}

export default async function PlatformPage({ params }: PageProps) {
	const { platform } = await params;

	const [platforms, allScripts] = await Promise.all([
		loadPlatforms(),
		loadScripts(),
	]);

	const displayName = platforms[platform];
	if (!displayName) notFound();

	const platformScripts = allScripts.filter((s) => s.platform === platform);
	const groups = await loadGroups(platformScripts);

	const groupMemberIds = new Set(
		platformScripts
			.filter((s) => s.group !== undefined)
			.map((s) => s.group as string),
	);
	const activeGroups = groups.filter((g) => groupMemberIds.has(g.id));
	const activeGroupIdSet = new Set(activeGroups.map((g) => g.id));
	const ungroupedScripts = platformScripts.filter(
		(s) => s.group === undefined || !activeGroupIdSet.has(s.group),
	);

	return (
		<div>
			<h1 className={styles.heading}>&gt; {displayName}</h1>
			{activeGroups.length > 0 && (
				<div className={styles.groupList}>
					{activeGroups.map((group) => {
						const members = platformScripts
							.filter((s) => s.group === group.id)
							.sort((a, b) => {
								const aOrder = a.groupOrder ?? Number.POSITIVE_INFINITY;
								const bOrder = b.groupOrder ?? Number.POSITIVE_INFINITY;
								if (aOrder !== bOrder) return aOrder - bOrder;
								return a.id.localeCompare(b.id);
							});
						return <GroupRow key={group.id} group={group} members={members} />;
					})}
				</div>
			)}
			<div className={styles.scriptList}>
				{ungroupedScripts.map((script) => (
					<ScriptRow key={script.id} script={script} />
				))}
			</div>
		</div>
	);
}
