import styles from "./DistroGroupHeader.module.css";

interface DistroGroupHeaderProps {
	distro: string;
}

export default function DistroGroupHeader({ distro }: DistroGroupHeaderProps) {
	return (
		<div className={styles.header} data-testid="distro-group-header">
			{"// "}
			{distro}
		</div>
	);
}
