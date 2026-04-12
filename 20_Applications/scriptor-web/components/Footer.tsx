import styles from "./Footer.module.css";

interface FooterProps {
	version?: string;
}

export function Footer({ version }: FooterProps = {}) {
	return (
		<footer className={styles.footer}>
			<span className={styles.tagline}>
				{">"} scriptor {"// manage your scripts"}
			</span>
			<div className={styles.right}>
				{version !== undefined && (
					<span className={styles.version}>v{version}</span>
				)}
				<a
					href="https://github.com/beolson/Scriptor"
					className={styles.github}
					target="_blank"
					rel="noopener noreferrer"
				>
					github
				</a>
			</div>
		</footer>
	);
}
