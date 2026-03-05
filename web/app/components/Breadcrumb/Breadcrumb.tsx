import Link from "next/link";
import styles from "./Breadcrumb.module.css";

interface BreadcrumbSegment {
	label: string;
	href?: string;
}

interface BreadcrumbProps {
	segments: BreadcrumbSegment[];
}

export default function Breadcrumb({ segments }: BreadcrumbProps) {
	return (
		<nav
			className={styles.breadcrumb}
			data-testid="breadcrumb"
			aria-label="Breadcrumb"
		>
			{segments.map((segment, index) => {
				const isLast = index === segments.length - 1;
				return (
					<span key={segment.label} className={styles.segmentWrapper}>
						{index > 0 && (
							<span className={styles.separator} aria-hidden="true">
								{">"}
							</span>
						)}
						{isLast || !segment.href ? (
							<span
								className={isLast ? styles.active : styles.ancestor}
								aria-current={isLast ? "page" : undefined}
							>
								{segment.label}
							</span>
						) : (
							<Link href={segment.href} className={styles.ancestor}>
								{segment.label}
							</Link>
						)}
					</span>
				);
			})}
		</nav>
	);
}
