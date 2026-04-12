"use client";

import Link from "next/link";
import { useState } from "react";

import type { GroupEntry } from "@/lib/loadGroups";
import type { Script } from "@/lib/types";

import styles from "./GroupRow.module.css";

export interface GroupRowProps {
	/** The group metadata from loadGroups */
	group: GroupEntry;
	/** Ordered member scripts, passed from the server page */
	members: Script[];
}

/**
 * Derive the platform prefix (first path segment) from a script id.
 * e.g. "linux/ubuntu-24.04-x64/install-bun" → "linux"
 */
function platformPrefix(members: Script[]): string {
	const first = members[0];
	if (!first) return "linux";
	return first.id.split("/")[0] ?? "linux";
}

/**
 * GroupRow renders a single group entry on a browse page.
 * It is a "use client" component because it uses useState for expand/collapse.
 */
export function GroupRow({ group, members }: GroupRowProps) {
	const [expanded, setExpanded] = useState(false);

	const platform = platformPrefix(members);
	const groupHref = `/groups/${platform}/${group.id}`;

	return (
		<div className={styles.row}>
			<div className={styles.header}>
				<div className={styles.titleRow}>
					<Link href={groupHref} className={styles.groupName}>
						{group.name}
					</Link>
					<span className={styles.badge} data-testid="group-badge">
						group
					</span>
				</div>
				<button
					type="button"
					className={styles.toggleButton}
					aria-expanded={expanded}
					aria-label={expanded ? "collapse" : "expand"}
					onClick={() => setExpanded((prev) => !prev)}
				>
					{expanded ? "−" : "+"}
				</button>
			</div>

			{group.description && (
				<span className={styles.description}>{group.description}</span>
			)}

			{expanded && (
				<ul className={styles.memberList}>
					{members.map((member) => (
						<li key={member.id} className={styles.memberItem}>
							<Link
								href={`/scripts/${member.id}`}
								className={styles.memberName}
							>
								{member.title}
							</Link>
							{member.description && (
								<span className={styles.memberDesc}>{member.description}</span>
							)}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
