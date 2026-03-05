"use client";

import { useEffect, useState } from "react";
import CodeBlock from "../CodeBlock/CodeBlock";

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
	// Default to empty origin (SSR-safe; useEffect sets window.location.origin after hydration)
	const [os, setOs] = useState<"windows" | "other">("other");
	const [origin, setOrigin] = useState("");

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
