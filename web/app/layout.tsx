import type { Metadata } from "next";
import { IBM_Plex_Mono, JetBrains_Mono } from "next/font/google";
import "highlight.js/styles/github.css";
import Footer from "./components/Footer/Footer";
import NavBar from "./components/NavBar/NavBar";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
	subsets: ["latin"],
	variable: "--font-jetbrains",
	display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
	subsets: ["latin"],
	weight: ["400", "500", "700"],
	variable: "--font-ibmplex",
	display: "swap",
});

export const metadata: Metadata = {
	title: "Scriptor",
	description: "Host-specific setup scripts runner",
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html
			lang="en"
			className={`${jetbrainsMono.variable} ${ibmPlexMono.variable}`}
		>
			<head>
				<meta name="viewport" content="width=device-width, initial-scale=1" />
			</head>
			<body>
				<NavBar />
				{children}
				<Footer />
			</body>
		</html>
	);
}
