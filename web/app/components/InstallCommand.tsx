"use client";

import { useEffect, useState } from "react";

const BASH_COMMAND =
	"sudo curl -fsSL \"https://github.com/beolson/Scriptor/releases/latest/download/scriptor-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m | sed 's/x86_64/x64/;s/aarch64/arm64/')\" -o /usr/local/bin/scriptor && sudo chmod +x /usr/local/bin/scriptor && scriptor";

const POWERSHELL_COMMAND =
	'$tmp = "$env:TEMP\\scriptor.exe"; Invoke-WebRequest -Uri "https://github.com/beolson/Scriptor/releases/latest/download/scriptor-windows-x64.exe" -OutFile $tmp; & $tmp';

export default function InstallCommand() {
	const [command, setCommand] = useState(BASH_COMMAND);
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		if (
			typeof navigator !== "undefined" &&
			/windows/i.test(navigator.userAgent)
		) {
			setCommand(POWERSHELL_COMMAND);
		}
	}, []);

	const handleCopy = () => {
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
		try {
			navigator.clipboard.writeText(command);
		} catch {
			// clipboard API may be unavailable in some contexts
		}
	};

	return (
		<div className="relative rounded-xl border border-zinc-700 bg-zinc-900 p-4 text-left">
			<pre className="overflow-x-auto text-sm leading-relaxed text-zinc-100">
				<code>{command}</code>
			</pre>
			<button
				type="button"
				onClick={handleCopy}
				className="mt-3 rounded-lg bg-zinc-700 px-4 py-1.5 text-xs font-medium text-zinc-100 transition-colors hover:bg-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-500"
			>
				{copied ? "Copied!" : "Copy"}
			</button>
		</div>
	);
}
