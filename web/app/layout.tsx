import type { Metadata } from "next";
import "highlight.js/styles/github.css";
import "./globals.css";

export const metadata: Metadata = {
	title: "Scriptor",
	description: "Host-specific setup scripts runner",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body>{children}</body>
		</html>
	);
}
