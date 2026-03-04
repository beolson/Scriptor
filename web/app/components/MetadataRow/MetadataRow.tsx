import styles from "./MetadataRow.module.css";

interface MetadataRowProps {
	label: string;
	value: string;
}

export default function MetadataRow({ label, value }: MetadataRowProps) {
	return (
		<div className={styles.row} data-testid="metadata-row">
			<span className={styles.label}>{label}</span>
			<span className={styles.value}>{value}</span>
		</div>
	);
}
