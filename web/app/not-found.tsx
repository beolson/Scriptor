import Link from "next/link";

export default function NotFound() {
	return (
		<main
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				minHeight: "60vh",
				gap: "16px",
				fontFamily: "var(--font-ibmplex), monospace",
				color: "var(--color-text-primary)",
			}}
		>
			<span
				style={{
					fontFamily: "var(--font-jetbrains), monospace",
					fontSize: "48px",
					fontWeight: 700,
					color: "var(--color-accent)",
				}}
			>
				404
			</span>
			<p style={{ fontSize: "14px", color: "var(--color-text-muted)" }}>
				Page not found.
			</p>
			<Link
				href="/"
				style={{
					fontSize: "13px",
					color: "var(--color-accent)",
					textDecoration: "underline",
				}}
			>
				← Back to home
			</Link>
		</main>
	);
}
