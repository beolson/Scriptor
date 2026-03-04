import { getScriptsByPlatform, loadScripts } from "../../../lib/loadScripts";
import Breadcrumb from "../../components/Breadcrumb/Breadcrumb";
import CodeBlock from "../../components/CodeBlock/CodeBlock";
import ScriptRow from "../../components/ScriptRow/ScriptRow";
import styles from "../platform-listing.module.css";

export default function WindowsScriptsPage() {
	const allScripts = loadScripts();
	const scripts = getScriptsByPlatform(allScripts, "windows").sort((a, b) =>
		a.name.localeCompare(b.name),
	);

	return (
		<main>
			<div className={styles.pageHeader} data-testid="platform-header">
				<Breadcrumb
					segments={[
						{ label: "home", href: "/" },
						{ label: "scripts" },
						{ label: "windows" },
					]}
				/>
				<h1 className={styles.heading}>&gt; windows scripts</h1>
				<div className={styles.installRow}>
					<CodeBlock
						wide
						language="// install all windows scripts"
						command="$ irm https://scriptor.dev/install.ps1 | iex"
					/>
				</div>
				<div className={styles.filterRow}>
					<span className={styles.filterLabel}>{"// arch:"}</span>
					<span className={styles.filterTab}>[any]</span>
					<span className={styles.filterTabActive}>[x86_64]</span>
					<span className={styles.filterTab}>[arm64]</span>
				</div>
				<span className={styles.count}>
					{"// "}
					{scripts.length} scripts available
				</span>
			</div>

			<div className={styles.scriptList} data-testid="script-list">
				{scripts.map((script) => (
					<ScriptRow
						key={script.id}
						name={script.name}
						description={script.description}
						arch={script.arch}
						href={`/scripts/${script.id}`}
					/>
				))}
			</div>
		</main>
	);
}
