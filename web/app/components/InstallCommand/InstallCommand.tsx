"use client";

import { useEffect, useState } from "react";
import CodeBlock from "../CodeBlock/CodeBlock";

const PROD_ORIGIN = "https://scriptor.hero4hire.com";

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
	// Default to bash + prod origin (SSR-safe; prevents hydration mismatch)
	const [os, setOs] = useState<"windows" | "other">("other");
	const [origin, setOrigin] = useState(PROD_ORIGIN);

	useEffect(() => {
		setOs(detectOS());
		setOrigin(window.location.origin);
	}, []);

	const isWindows = os === "windows";
	const language = isWindows ? "// detected: windows" : "// detected: linux";
	const command = isWindows
		? `iwr ${origin}/install.ps1 | iex`
		: `curl -fsSL ${origin}/install.sh | bash`;

	return <CodeBlock language={language} command={command} wide />;
}
