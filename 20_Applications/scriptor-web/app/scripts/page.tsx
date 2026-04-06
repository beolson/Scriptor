import { loadScripts } from "@/lib/loadScripts";

import { ScriptsBrowser } from "./ScriptsBrowser";

export default async function ScriptsPage() {
	const scripts = await loadScripts();
	return (
		<main>
			<h1>Browse Scripts</h1>
			<ScriptsBrowser scripts={scripts} />
		</main>
	);
}
