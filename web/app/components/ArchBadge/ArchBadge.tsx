import styles from "./ArchBadge.module.css";

interface ArchBadgeProps {
	arch: string;
}

export default function ArchBadge({ arch }: ArchBadgeProps) {
	return (
		<span className={styles.badge} data-testid="arch-badge">
			[{arch}]
		</span>
	);
}
