import { readFile as fsReadFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CodeBlock } from "@/components/CodeBlock";
import { loadGroups } from "@/lib/loadGroups";
import { loadScripts } from "@/lib/loadScripts";
import type { Script } from "@/lib/types";

import styles from "./detail-page.module.css";

// ─── Constants ────────────────────────────────────────────────────────────────

const RAW_BASE =
	"https://raw.githubusercontent.com/beolson/Scriptor/main/scripts";

// Repo root resolved from this file's location
// app/groups/[...slug]/ → groups/ → app/ → scriptor-web/ → 20_Applications/ → repo root
const repoRoot = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../../../../..",
);
const scriptsRoot = process.env.SCRIPTS_DIR
	? resolve(repoRoot, process.env.SCRIPTS_DIR)
	: resolve(repoRoot, "scripts");

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Sort comparator for group members: ascending by groupOrder (undefined last),
 * then by id as tiebreaker.
 */
function compareMemberScripts(a: Script, b: Script): number {
	const aOrder = a.groupOrder ?? Number.POSITIVE_INFINITY;
	const bOrder = b.groupOrder ?? Number.POSITIVE_INFINITY;
	if (aOrder !== bOrder) return aOrder - bOrder;
	return a.id.localeCompare(b.id);
}

/**
 * Determine the runner file extension based on the member's run command.
 */
function runnerExtension(member: Script): ".sh" | ".ps1" {
	if (member.runCommand.startsWith("irm ")) return ".ps1";
	return ".sh";
}

/**
 * Read the generated run-all runner source from disk. Returns undefined if the
 * file does not exist yet (e.g. group has no members and runner was skipped).
 */
async function readRunnerSource(
	platformPrefix: string,
	groupId: string,
	ext: ".sh" | ".ps1",
): Promise<string | undefined> {
	const runnerPath = join(scriptsRoot, platformPrefix, groupId, `run-all${ext}`);
	try {
		if (typeof Bun !== "undefined") {
			return await Bun.file(runnerPath).text();
		}
		return await fsReadFile(runnerPath, "utf8");
	} catch {
		return undefined;
	}
}

/**
 * Build the one-liner run command for a group runner script.
 */
function buildOneLiner(
	platform: string,
	groupId: string,
	ext: ".sh" | ".ps1",
): string {
	const url = `${RAW_BASE}/${platform}/${groupId}/run-all${ext}`;
	if (ext === ".ps1") {
		return `irm ${url} | iex`;
	}
	return `curl -fsSL ${url} | bash`;
}

// ─── Static params ────────────────────────────────────────────────────────────

export async function generateStaticParams(): Promise<{ slug: string[] }[]> {
	const scripts = await loadScripts();
	const groups = await loadGroups(scripts);

	const params: { slug: string[] }[] = [];

	for (const group of groups) {
		const members = scripts.filter((s) => s.group === group.id);
		if (members.length === 0) continue;

		// Platform prefix is derived from the first member's id
		const platformPrefix = members[0].id.split("/")[0] ?? "linux";
		params.push({ slug: [platformPrefix, group.id] });
	}

	return params;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface PageProps {
	params: Promise<{ slug: string[] }>;
}

export default async function GroupDetailPage({ params }: PageProps) {
	const { slug } = await params;
	// slug is [platform, group-id]
	const groupId = slug[slug.length - 1] ?? "";
	const platformSlug = slug[0] ?? "";

	const scripts = await loadScripts();
	const groups = await loadGroups(scripts);

	const group = groups.find((g) => g.id === groupId);

	if (!group) {
		notFound();
	}

	// Collect and sort member scripts for this group
	const members = scripts
		.filter((s) => s.group === groupId)
		.sort(compareMemberScripts);

	if (members.length === 0) {
		notFound();
	}

	// Derive platform info from the first member
	const platformValue = members[0].platform;
	const ext = runnerExtension(members[0]);
	const oneLiner = buildOneLiner(platformSlug, groupId, ext);
	const runnerSource = await readRunnerSource(platformSlug, groupId, ext);

	return (
		<div className={styles.detail}>
			<header className={styles.detailHeader}>
				<h1 className={styles.heading}>
					&gt; {group.name} - {platformSlug}
				</h1>
			</header>

			<div className={styles.runSection}>
				<CodeBlock label="// run command" command={oneLiner} />
			</div>

			<div className={styles.detailBody}>
				<main className={styles.mainCol}>
					{group.description && (
						<div className={styles.specContent}>
							<span className={styles.boxLabel}>{"// spec"}</span>
							<p className={styles.specDescription}>{group.description}</p>
						</div>
					)}

					<div className={styles.memberSection}>
						<span className={styles.boxLabel}>{"// members"}</span>
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
										<span className={styles.memberDesc}>
											{member.description}
										</span>
									)}
								</li>
							))}
						</ul>
					</div>

					{runnerSource && (
						<pre className={styles.sourceBlock}>
							<span className={styles.boxLabel}>{"// source"}</span>
							{runnerSource}
						</pre>
					)}
				</main>

				<aside className={styles.sidebar}>
					<div className={styles.metadataCard}>
						<div className={styles.metaRow}>
							<span className={styles.metaKey}>platform</span>
							<span className={styles.metaValue}>{platformSlug}</span>
						</div>
						<div className={styles.metaRow}>
							<span className={styles.metaKey}>target</span>
							<span className={styles.metaValue}>{platformValue}</span>
						</div>
						<div className={styles.metaRow}>
							<span className={styles.metaKey}>scripts</span>
							<span className={styles.metaValue}>{members.length}</span>
						</div>
					</div>
				</aside>
			</div>
		</div>
	);
}
