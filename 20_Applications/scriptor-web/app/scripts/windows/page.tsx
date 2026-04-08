import { Breadcrumb } from "@/components/Breadcrumb";
import { CodeBlock } from "@/components/CodeBlock";
import { ScriptRow } from "@/components/ScriptRow";
import { loadScripts } from "@/lib/loadScripts";

import styles from "./page.module.css";

export default async function WindowsPage() {
	const allScripts = await loadScripts();
	const scripts = allScripts.filter((s) => s.id.startsWith("windows/"));

	return (
		<div>
			<div className={styles.pageHeader}>
				<Breadcrumb
					items={[
						{ label: "home", href: "/" },
						{ label: "scripts", href: "/" },
						{ label: "windows" },
					]}
				/>
				<h1 className={styles.heading}>&gt; windows scripts</h1>
				<div className={styles.codeRow}>
					<div className={styles.codeBlockWrapper}>
						<CodeBlock
							label="// powershell"
							command="$ irm https://scriptor.dev/install.ps1 | iex"
						/>
					</div>
				</div>
				<span className={styles.count}>
					{"// "}
					{scripts.length} scripts available
				</span>
			</div>

			<div className={styles.scriptList}>
				{scripts.map((script) => (
					<ScriptRow key={script.id} script={script} />
				))}
			</div>
		</div>
	);
}
