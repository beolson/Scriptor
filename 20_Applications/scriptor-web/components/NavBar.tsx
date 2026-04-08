import Link from "next/link";

import styles from "./NavBar.module.css";

export function NavBar() {
	return (
		<nav className={styles.navbar}>
			<Link href="/" className={styles.brand}>
				&gt; scriptor
			</Link>
			<a
				href="https://github.com/beolson/Scriptor"
				className={styles.github}
				target="_blank"
				rel="noopener noreferrer"
			>
				github
			</a>
		</nav>
	);
}
