import type { Metadata } from "next";
import { IBM_Plex_Mono, JetBrains_Mono } from "next/font/google";
import "./hljs-themes.css";
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
			suppressHydrationWarning
		>
			<head>
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<script
					// biome-ignore lint/security/noDangerouslySetInnerHtml: inline script required to prevent theme flash before first paint
					dangerouslySetInnerHTML={{
						__html: `(function(){try{var t=localStorage.getItem("theme");if(t==="dark"||t==="light"){document.documentElement.setAttribute("data-theme",t)}else if(window.matchMedia("(prefers-color-scheme: dark)").matches){document.documentElement.setAttribute("data-theme","dark")}else{document.documentElement.setAttribute("data-theme","light")}}catch(e){document.documentElement.setAttribute("data-theme","light")}})()`,
					}}
				/>
			</head>
			<body>
				<NavBar />
				{children}
				<Footer />
			</body>
		</html>
	);
}
