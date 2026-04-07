import styles from "./empty-state.module.css";

export interface EmptyStateProps {
	message?: string;
}

export function EmptyState({
	message = "No scripts found for this combination.",
}: EmptyStateProps) {
	return (
		<div className={styles.emptyState}>
			<p className={styles.message}>{message}</p>
		</div>
	);
}
