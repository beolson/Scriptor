import { getScriptsByPlatform, loadScripts } from "../../../lib/loadScripts";
import ScriptFilter from "../../components/ScriptFilter/ScriptFilter";

export default function MacScriptsPage() {
	const scripts = getScriptsByPlatform(loadScripts(), "mac");
	return (
		<main>
			<ScriptFilter
				scripts={scripts}
				platform="mac"
				heading="> macos scripts"
				installLanguage="// install all macos scripts"
				installCommand="$ curl -fsSL https://scriptor.dev/install.sh | sh"
				breadcrumbs={[
					{ label: "home", href: "/" },
					{ label: "scripts" },
					{ label: "macos" },
				]}
			/>
		</main>
	);
}
