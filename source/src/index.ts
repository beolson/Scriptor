import { render } from "ink";
import React from "react";
import { parseCli } from "./cli/parseCli.js";
import { readConfig, writeConfig } from "./config/config.js";
import { detectHost } from "./host/detectHost.js";
import { App } from "./tui/App.js";

const DEFAULT_REPO = "owner/scriptor-scripts";

async function main() {
	const cliArgs = parseCli(process.argv.slice(2));

	const config = await readConfig();

	// Determine active repo: CLI arg > saved config > default.
	let repoUrl: string;
	if (cliArgs.repo !== null) {
		repoUrl = cliArgs.repo;
		// Persist the override for future runs.
		await writeConfig({ ...config, repo: cliArgs.repo });
	} else {
		repoUrl = config.repo ?? DEFAULT_REPO;
	}

	const hostInfo = await detectHost();

	render(React.createElement(App, { hostInfo, repoUrl }));
}

main().catch((err: unknown) => {
	console.error(err);
	process.exit(1);
});
