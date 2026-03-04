"use client";

import { useEffect, useState } from "react";
import CodeBlock from "../CodeBlock/CodeBlock";

const WINDOWS_COMMAND =
	'$tmp = "$env:TEMP\\scriptor.exe"; Invoke-WebRequest -Uri "https://github.com/beolson/Scriptor/releases/latest/download/scriptor-windows-x64.exe" -OutFile $tmp; & $tmp';

const BASH_COMMAND =
	"sudo curl -fsSL \"https://github.com/beolson/Scriptor/releases/latest/download/scriptor-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m | sed 's/x86_64/x64/;s/aarch64/arm64/')\" -o /usr/local/bin/scriptor && sudo chmod +x /usr/local/bin/scriptor && scriptor";

function detectOS(): "windows" | "other" {
	if (typeof navigator === "undefined") return "other";
	const ua = navigator.userAgent.toLowerCase();
	const platform =
		"userAgentData" in navigator
			? ""
			: (navigator.platform ?? "").toLowerCase();
	if (ua.includes("windows") || platform.includes("win")) return "windows";
	return "other";
}

export default function InstallCommand() {
	// Default to bash (SSR-safe; prevents hydration mismatch)
	const [os, setOs] = useState<"windows" | "other">("other");

	useEffect(() => {
		setOs(detectOS());
	}, []);

	const isWindows = os === "windows";
	const language = isWindows ? "// detected: windows" : "// detected: linux";
	const command = isWindows ? WINDOWS_COMMAND : BASH_COMMAND;

	return <CodeBlock language={language} command={command} wide />;
}
