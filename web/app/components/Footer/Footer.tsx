import VersionBadge from "../VersionBadge/VersionBadge";
import styles from "./Footer.module.css";

export default function Footer() {
	return (
		<footer className={styles.footer} data-testid="footer">
			<span className={styles.brand}>
				&gt; scriptor {"//"} manage your scripts
			</span>
			<div className={styles.footerLinks}>
				<VersionBadge />
				<a
					className={styles.githubLink}
					href="https://github.com/beolson/Scriptor"
					target="_blank"
					rel="noopener noreferrer"
				>
					github
				</a>
			</div>
		</footer>
	);
}
