import Link from "next/link";
import ArchBadge from "../ArchBadge/ArchBadge";
import styles from "./ScriptRow.module.css";

interface ScriptRowProps {
	name: string;
	description: string;
	arch: string;
	href: string;
}

export default function ScriptRow({
	name,
	description,
	arch,
	href,
}: ScriptRowProps) {
	return (
		<Link href={href} className={styles.row} data-testid="script-row">
			<div className={styles.left}>
				<span className={styles.name}>{name}</span>
				<span className={styles.desc}>
					{"// "}
					{description}
				</span>
			</div>
			<div className={styles.right}>
				<ArchBadge arch={arch} />
				<span className={styles.arrow}>&gt;&gt;</span>
			</div>
		</Link>
	);
}
