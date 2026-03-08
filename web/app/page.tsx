import InstallCommand from "./components/InstallCommand/InstallCommand";
import PlatformCard from "./components/PlatformCard/PlatformCard";
import styles from "./page.module.css";

export default function HomePage() {
	return (
		<main>
			{/* Hero section */}
			<section className={styles.hero}>
				<h1 className={styles.heroHeadline} data-testid="hero-headline">
					&gt; scriptor
				</h1>
				<div className={styles.installWrapper}>
					<InstallCommand />
					<span className={styles.heroNote}>
						{"// not on windows? → select your platform below"}
					</span>
				</div>
			</section>

			{/* Platforms section */}
			<section className={styles.platforms}>
				<span className={styles.sectionLabel}>{"// platforms"}</span>
				<h2 className={styles.sectionHeading}>&gt; browse by platform</h2>
				<div className={styles.cardGrid}>
					<PlatformCard
						prompt="C:\\"
						name="windows"
						description="powershell scripts for windows hosts"
						href="/scripts/windows"
					/>
					<PlatformCard
						prompt="$"
						name="linux"
						description="bash scripts for linux hosts, grouped by distro"
						href="/scripts/linux"
					/>
					<PlatformCard
						prompt="%"
						name="macos"
						description="shell scripts for macos hosts"
						href="/scripts/mac"
					/>
				</div>
			</section>
		</main>
	);
}
