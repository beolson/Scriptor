import Link from "next/link";

import { loadPlatforms } from "@/lib/loadPlatforms";

import styles from "./page.module.css";

export default async function Page() {
	const platforms = await loadPlatforms();

	return (
		<div className={styles.platforms}>
			<div className={styles.platformCards}>
				{Object.entries(platforms).map(([value, displayName]) => (
					<Link
						key={value}
						href={`/scripts/${value}`}
						className={styles.platformCard}
					>
						<span className={styles.platformName}>{displayName}</span>
						<span className={styles.viewLink}>&gt; view scripts</span>
					</Link>
				))}
			</div>
		</div>
	);
}
