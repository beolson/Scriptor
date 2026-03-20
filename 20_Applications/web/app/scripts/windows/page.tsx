import { getScriptsByPlatform, loadScripts } from "../../../lib/loadScripts";
import ScriptFilter from "../../components/ScriptFilter/ScriptFilter";

export default function WindowsScriptsPage() {
	const scripts = getScriptsByPlatform(loadScripts(), "windows");
	return (
		<main>
			<ScriptFilter
				scripts={scripts}
				platform="windows"
				heading="> windows scripts"
				installLanguage="// install all windows scripts"
				installCommand="$ irm https://scriptor.dev/install-win | iex"
				breadcrumbs={[
					{ label: "home", href: "/" },
					{ label: "scripts" },
					{ label: "windows" },
				]}
			/>
		</main>
	);
}
