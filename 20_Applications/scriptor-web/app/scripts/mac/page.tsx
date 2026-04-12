import { Breadcrumb } from "@/components/Breadcrumb";
import { CodeBlock } from "@/components/CodeBlock";
import { GroupRow } from "@/components/GroupRow";
import { ScriptRow } from "@/components/ScriptRow";
import { loadGroups } from "@/lib/loadGroups";
import { loadScripts } from "@/lib/loadScripts";

import styles from "./page.module.css";

export default async function MacPage() {
	const allScripts = await loadScripts();
	const platformScripts = allScripts.filter((s) => s.id.startsWith("mac/"));

	const groups = await loadGroups(platformScripts);

	// Build a set of group IDs that have at least one member in platformScripts
	const groupMemberIds = new Set(
		platformScripts
			.filter((s) => s.group !== undefined)
			.map((s) => s.group as string),
	);

	// A group is displayed only if it has members among platformScripts
	const activeGroups = groups.filter((g) => groupMemberIds.has(g.id));

	// Scripts that belong to an active group are excluded from the ungrouped list
	const activeGroupIdSet = new Set(activeGroups.map((g) => g.id));
	const ungroupedScripts = platformScripts.filter(
		(s) => s.group === undefined || !activeGroupIdSet.has(s.group),
	);

	return (
		<div>
			<div className={styles.pageHeader}>
				<Breadcrumb
					items={[
						{ label: "home", href: "/" },
						{ label: "scripts", href: "/" },
						{ label: "mac" },
					]}
				/>
				<h1 className={styles.heading}>&gt; macos scripts</h1>
				<div className={styles.codeRow}>
					<div className={styles.codeBlockWrapper}>
						<CodeBlock
							label="// zsh"
							command="$ curl -fsSL https://scriptor.dev/install.sh | sh"
						/>
					</div>
				</div>
				<span className={styles.count}>
					{"// "}
					{platformScripts.length} scripts available
				</span>
			</div>

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
