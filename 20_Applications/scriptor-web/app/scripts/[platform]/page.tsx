import { notFound } from "next/navigation";

import { ScriptRow } from "@/components/ScriptRow";
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

	const scripts = allScripts.filter((s) => s.platform === platform);

	return (
		<div>
			<h1 className={styles.heading}>&gt; {displayName}</h1>
			<div className={styles.scriptList}>
				{scripts.map((script) => (
					<ScriptRow key={script.id} script={script} />
				))}
			</div>
		</div>
	);
}
