import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";

import { CodeBlock } from "@/components/CodeBlock";
import { loadPlatforms } from "@/lib/loadPlatforms";
import { loadScripts } from "@/lib/loadScripts";

import styles from "./detail-page.module.css";

// ─── Static params ────────────────────────────────────────────────────────────

export async function generateStaticParams(): Promise<{ slug: string[] }[]> {
	const scripts = await loadScripts();
	return scripts.map((script) => ({ slug: script.id.split("/") }));
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface PageProps {
	params: Promise<{ slug: string[] }>;
}

export default async function ScriptDetailPage({ params }: PageProps) {
	const { slug } = await params;
	const id = slug.join("/");

	const [scripts, platforms] = await Promise.all([
		loadScripts(),
		loadPlatforms(),
	]);
	const script = scripts.find((s) => s.id === id);

	if (!script) {
		notFound();
	}

	const platformLabel =
		platforms[script.platform]?.displayName ?? script.platform;

	return (
		<div className={styles.detail}>
			<header className={styles.detailHeader}>
				<h1 className={styles.heading}>
					&gt; {script.title} - {platformLabel}
				</h1>
			</header>

			{script.runCommand && (
				<div className={styles.runSection}>
					<CodeBlock label="// run command" command={script.runCommand} />
				</div>
			)}

			<div className={styles.detailBody}>
				<main className={styles.mainCol}>
					<div className={styles.specContent}>
						<span className={styles.boxLabel}>{"// spec"}</span>
						<ReactMarkdown>{script.body}</ReactMarkdown>
					</div>

					{script.source && (
						<pre className={styles.sourceBlock}>
							<span className={styles.boxLabel}>{"// source"}</span>
							{script.source}
						</pre>
					)}
				</main>

				<aside className={styles.sidebar}>
					<div className={styles.metadataCard}>
						<div className={styles.metaRow}>
							<span className={styles.metaKey}>platform</span>
							<span className={styles.metaValue}>{slug[0]}</span>
						</div>
						<div className={styles.metaRow}>
							<span className={styles.metaKey}>target</span>
							<span className={styles.metaValue}>{script.platform}</span>
						</div>
					</div>
				</aside>
			</div>
		</div>
	);
}
