import type { Metadata } from "next";
import { IBM_Plex_Mono, JetBrains_Mono } from "next/font/google";

import { Footer } from "@/components/Footer";
import { NavBar } from "@/components/NavBar";
import { loadVersion } from "@/lib/loadVersion";

import "./globals.css";

const ibmPlexMono = IBM_Plex_Mono({
	subsets: ["latin"],
	weight: ["400", "500", "600", "700"],
	variable: "--font-ibmplex",
});

const jetbrainsMono = JetBrains_Mono({
	subsets: ["latin"],
	weight: ["400", "500", "600", "700"],
	variable: "--font-jetbrains",
});

export const metadata: Metadata = {
	title: "Scriptor",
	description: "Script Index",
};

export default async function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const version = await loadVersion();

	return (
		<html
			lang="en"
			className={`${ibmPlexMono.variable} ${jetbrainsMono.variable}`}
			suppressHydrationWarning
		>
			<body
				style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}
			>
				<NavBar />
				<main style={{ flex: 1 }}>{children}</main>
				<Footer version={version} />
			</body>
		</html>
	);
}
