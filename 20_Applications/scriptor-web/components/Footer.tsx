import styles from "./Footer.module.css";

export function Footer() {
	return (
		<footer className={styles.footer}>
			<span className={styles.tagline}>
				{">"} scriptor {"// manage your scripts"}
			</span>
			<a
				href="https://github.com/beolson/Scriptor"
				className={styles.github}
				target="_blank"
				rel="noopener noreferrer"
			>
				github
			</a>
		</footer>
	);
}
