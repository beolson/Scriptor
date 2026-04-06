"use client";

import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import styles from "./filter-button.module.css";

const filterButtonVariants = cva(styles.filterButton, {
	variants: {
		active: {
			true: styles.active,
			false: "",
		},
		disabled: {
			true: styles.disabled,
			false: "",
		},
	},
	defaultVariants: {
		active: false,
		disabled: false,
	},
});

export interface FilterButtonProps
	extends VariantProps<typeof filterButtonVariants> {
	label: string;
	active: boolean;
	disabled: boolean;
	onClick: () => void;
}

export function FilterButton({
	label,
	active,
	disabled,
	onClick,
}: FilterButtonProps) {
	function handleClick() {
		if (!disabled) {
			onClick();
		}
	}

	return (
		<button
			type="button"
			className={cn(filterButtonVariants({ active, disabled }))}
			data-active={active ? "true" : undefined}
			aria-disabled={disabled ? "true" : undefined}
			onClick={handleClick}
		>
			{label}
		</button>
	);
}
