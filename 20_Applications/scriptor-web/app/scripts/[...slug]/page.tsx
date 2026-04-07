import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";

import { CopyButton } from "@/components/ui/copy-button";
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

	const scripts = await loadScripts();
	const script = scripts.find((s) => s.id === id);

	if (!script) {
		notFound();
	}

	return (
		<main className={styles.detail}>
			<h1>{script.title}</h1>

			<div className={styles.metadata}>
				<span className={styles.metaTag}>{script.platform}</span>
				<span className={styles.metaTag}>{script.os}</span>
				{script.arch && <span className={styles.metaTag}>{script.arch}</span>}
			</div>

			<section className={styles.section}>
				<ReactMarkdown>{script.body}</ReactMarkdown>
			</section>

			<section className={styles.section}>
				<h2 className={styles.sectionHeading}>Source</h2>
				{script.source ? (
					<pre className={styles.sourceBlock}>
						<code>{script.source}</code>
					</pre>
				) : (
					<p>Source unavailable.</p>
				)}
			</section>

			<section className={styles.section}>
				<h2 className={styles.sectionHeading}>Run Command</h2>
				<div className={styles.runCommandWrapper}>
					<pre className={styles.runCommand}>{script.runCommand}</pre>
					<CopyButton text={script.runCommand} />
				</div>
			</section>
		</main>
	);
}
