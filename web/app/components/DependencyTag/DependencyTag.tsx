import styles from "./DependencyTag.module.css";

interface DependencyTagProps {
	dep: string;
}

export default function DependencyTag({ dep }: DependencyTagProps) {
	return (
		<span className={styles.tag} data-testid="dependency-tag">
			[{dep}]
		</span>
	);
}
