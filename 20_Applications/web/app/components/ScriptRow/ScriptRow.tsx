import Link from "next/link";
import ArchBadge from "../ArchBadge/ArchBadge";
import styles from "./ScriptRow.module.css";

interface ScriptRowProps {
	name: string;
	description: string;
	arch: string;
	distro?: string;
	version?: string;
	href: string;
}

export default function ScriptRow({
	name,
	description,
	arch,
	distro,
	version,
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
				{distro && distro !== "any" && <ArchBadge arch={distro} />}
				{version && version !== "any" && <ArchBadge arch={version} />}
				<ArchBadge arch={arch} />
				<span className={styles.arrow}>&gt;&gt;</span>
			</div>
		</Link>
	);
}
