import { getScriptsByPlatform, loadScripts } from "../../../lib/loadScripts";
import ScriptFilter from "../../components/ScriptFilter/ScriptFilter";

export default function LinuxScriptsPage() {
	const scripts = getScriptsByPlatform(loadScripts(), "linux");
	return (
		<main>
			<ScriptFilter
				scripts={scripts}
				platform="linux"
				heading="> linux scripts"
				installLanguage="// install all linux scripts"
				installCommand="$ curl -fsSL https://scriptor.dev/install | sh"
				breadcrumbs={[
					{ label: "home", href: "/" },
					{ label: "scripts" },
					{ label: "linux" },
				]}
			/>
		</main>
	);
}
