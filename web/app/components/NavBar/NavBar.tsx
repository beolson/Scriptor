import Link from "next/link";
import ThemeToggle from "../ThemeToggle/ThemeToggle";
import styles from "./NavBar.module.css";

export default function NavBar() {
	return (
		<nav className={styles.navbar} data-testid="navbar">
			<Link href="/" className={styles.logo}>
				&gt; scriptor
			</Link>
			<div className={styles.navLinks}>
				<a
					className={styles.githubLink}
					href="https://github.com/beolson/Scriptor"
					target="_blank"
					rel="noopener noreferrer"
				>
					github
				</a>
				<ThemeToggle />
			</div>
		</nav>
	);
}
