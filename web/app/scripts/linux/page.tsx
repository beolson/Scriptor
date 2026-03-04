import { getScriptsByPlatform, loadScripts } from "../../../lib/loadScripts";
import Breadcrumb from "../../components/Breadcrumb/Breadcrumb";
import CodeBlock from "../../components/CodeBlock/CodeBlock";
import DistroGroupHeader from "../../components/DistroGroupHeader/DistroGroupHeader";
import ScriptRow from "../../components/ScriptRow/ScriptRow";
import styles from "../platform-listing.module.css";

export default function LinuxScriptsPage() {
	const allScripts = loadScripts();
	const scripts = getScriptsByPlatform(allScripts, "linux").sort((a, b) =>
		a.name.localeCompare(b.name),
	);

	// Group by distro
	const groups = new Map<string, typeof scripts>();
	for (const script of scripts) {
		const distro = script.distro ?? "other";
		const group = groups.get(distro) ?? [];
		group.push(script);
		groups.set(distro, group);
	}

	return (
		<main>
			<div className={styles.pageHeader} data-testid="platform-header">
				<Breadcrumb
					segments={[
						{ label: "home", href: "/" },
						{ label: "scripts" },
						{ label: "linux" },
					]}
				/>
				<h1 className={styles.heading}>&gt; linux scripts</h1>
				<div className={styles.installRow}>
					<CodeBlock
						wide
						language="// install all linux scripts"
						command="$ curl -fsSL https://scriptor.dev/install.sh | sh"
					/>
				</div>
				<div className={styles.filterRow}>
					<span className={styles.filterLabel}>{"// arch:"}</span>
					<span className={styles.filterTab}>[any]</span>
					<span className={styles.filterTabActive}>[x86_64]</span>
					<span className={styles.filterTab}>[arm64]</span>
				</div>
				<div className={styles.filterRow}>
					<span className={styles.filterLabel}>{"// distro:"}</span>
					<span className={styles.filterTab}>[any]</span>
					<span className={styles.filterTabActive}>[debian / ubuntu]</span>
					<span className={styles.filterTab}>[arch]</span>
					<span className={styles.filterTab}>[fedora]</span>
				</div>
				<div className={styles.filterRow}>
					<span className={styles.filterLabel}>{"// version:"}</span>
					<span className={styles.filterTab}>[any]</span>
					<span className={styles.filterTabActive}>[22.04 lts]</span>
					<span className={styles.filterTab}>[20.04 lts]</span>
					<span className={styles.filterTab}>[24.04 lts]</span>
				</div>
				<span className={styles.count}>
					{"// "}
					{scripts.length} scripts available
				</span>
			</div>

			<div className={styles.scriptList} data-testid="script-list">
				{Array.from(groups.entries()).map(([distro, groupScripts]) => (
					<div key={distro}>
						<DistroGroupHeader distro={distro} />
						{groupScripts.map((script) => (
							<ScriptRow
								key={script.id}
								name={script.name}
								description={script.description}
								arch={script.arch}
								href={`/scripts/${script.id}`}
							/>
						))}
					</div>
				))}
			</div>
		</main>
	);
}
