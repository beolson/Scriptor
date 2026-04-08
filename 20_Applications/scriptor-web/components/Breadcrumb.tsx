import Link from "next/link";

import styles from "./Breadcrumb.module.css";

export interface BreadcrumbItem {
	label: string;
	href?: string;
}

export interface BreadcrumbProps {
	items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
	return (
		<nav className={styles.breadcrumb} aria-label="breadcrumb">
			{items.map((item, index) => (
				<span key={item.label} className={styles.item}>
					{index > 0 && <span className={styles.separator}>&gt;</span>}
					{item.href ? (
						<Link href={item.href} className={styles.link}>
							{item.label}
						</Link>
					) : (
						<span className={styles.current}>{item.label}</span>
					)}
				</span>
			))}
		</nav>
	);
}
