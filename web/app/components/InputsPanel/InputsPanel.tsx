import type { Input } from "../../../lib/types";
import styles from "./InputsPanel.module.css";

interface InputsPanelProps {
	inputs?: Input[];
}

export default function InputsPanel({ inputs }: InputsPanelProps) {
	const hasInputs = inputs && inputs.length > 0;

	return (
		<div className={styles.panel} data-testid="inputs-panel">
			<span className={styles.heading}>{"// inputs"}</span>
			{hasInputs ? (
				<div className={styles.inputList}>
					{inputs.map((input) => (
						<div
							key={input.id}
							className={styles.inputItem}
							data-testid="input-item"
						>
							<div className={styles.inputHeader}>
								<span className={styles.inputLabel}>
									{input.label}
								</span>
								<span className={styles.badge}>
									{input.required ? "required" : "optional"}
								</span>
							</div>
							<span className={styles.inputType}>
								type: {input.type}
							</span>
							{input.default !== undefined && (
								<span className={styles.inputDetail}>
									default: {input.default}
								</span>
							)}
							{input.download_path !== undefined && (
								<span className={styles.inputDetail}>
									download_path: {input.download_path}
								</span>
							)}
							{input.format !== undefined && (
								<span className={styles.inputDetail}>
									format: {input.format}
								</span>
							)}
						</div>
					))}
				</div>
			) : (
				<p className={styles.emptyState}>
					{"// no inputs required"}
				</p>
			)}
		</div>
	);
}
