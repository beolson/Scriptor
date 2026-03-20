"use client";

import { useEffect, useState } from "react";
import styles from "./ThemeToggle.module.css";

type Theme = "light" | "dark";

function getTheme(): Theme {
	return (
		(document.documentElement.getAttribute("data-theme") as Theme) || "light"
	);
}

export default function ThemeToggle() {
	const [theme, setTheme] = useState<Theme>("light");

	useEffect(() => {
		setTheme(getTheme());
	}, []);

	function toggle() {
		const next: Theme = theme === "light" ? "dark" : "light";
		document.documentElement.setAttribute("data-theme", next);
		localStorage.setItem("theme", next);
		setTheme(next);
	}

	// sun icon for light mode (click to go dark), moon icon for dark mode (click to go light)
	return (
		<button
			type="button"
			className={styles.toggle}
			onClick={toggle}
			aria-label={
				theme === "light" ? "Switch to dark mode" : "Switch to light mode"
			}
			title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
		>
			{theme === "light" ? (
				/* sun icon — currently light, click to go dark */
				<svg
					className={styles.icon}
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
					aria-hidden="true"
					data-testid="icon-sun"
				>
					<circle cx="12" cy="12" r="5" />
					<line x1="12" y1="1" x2="12" y2="3" />
					<line x1="12" y1="21" x2="12" y2="23" />
					<line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
					<line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
					<line x1="1" y1="12" x2="3" y2="12" />
					<line x1="21" y1="12" x2="23" y2="12" />
					<line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
					<line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
				</svg>
			) : (
				/* moon icon — currently dark, click to go light */
				<svg
					className={styles.icon}
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
					aria-hidden="true"
					data-testid="icon-moon"
				>
					<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
				</svg>
			)}
		</button>
	);
}
