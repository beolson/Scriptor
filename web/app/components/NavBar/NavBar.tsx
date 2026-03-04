import styles from "./NavBar.module.css";

export default function NavBar() {
	return (
		<nav className={styles.navbar} data-testid="navbar">
			<span className={styles.logo}>&gt; scriptor</span>
			<div className={styles.navLinks}>
				<a
					className={styles.githubLink}
					href="https://github.com/beolson/Scriptor"
					target="_blank"
					rel="noopener noreferrer"
				>
					github
				</a>
			</div>
		</nav>
	);
}
