import Link from "next/link";
import styles from "./PlatformCard.module.css";

interface PlatformCardProps {
	prompt: string;
	name: string;
	description: string;
	href: string;
}

export default function PlatformCard({
	prompt,
	name,
	description,
	href,
}: PlatformCardProps) {
	return (
		<Link href={href} className={styles.card} data-testid="platform-card">
			<span className={styles.prompt}>{prompt}</span>
			<span className={styles.name}>{name}</span>
			<div className={styles.descWrapper}>
				<p className={styles.desc}>
					{"// "}
					{description}
				</p>
			</div>
			<span className={styles.viewLink}>&gt; view scripts</span>
		</Link>
	);
}
