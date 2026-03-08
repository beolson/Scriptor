const version = process.env.NEXT_PUBLIC_VERSION;
const label = version ?? "dev";

export default function VersionBadge() {
	return (
		<span
			data-testid="version-badge"
			style={{
				fontFamily: "var(--font-jetbrains), monospace",
				fontSize: "var(--text-caption)",
				color: "var(--color-text-muted)",
			}}
		>
			{label}
		</span>
	);
}
