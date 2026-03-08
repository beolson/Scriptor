import { Box, Text, useInput } from "ink";
import { useEffect, useState } from "react";
import type { CollectedInput, InputDef, ScriptInputs } from "../inputSchema.js";
import type { CertFetcher } from "../sslCert/certFetcher.js";
import { NumberInputPrompt } from "./NumberInputPrompt.js";
import { SslCertInputPrompt } from "./SslCertInputPrompt.js";
import { StringInputPrompt } from "./StringInputPrompt.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScriptWithInputs {
	id: string;
	name: string;
	inputs: InputDef[];
}

export interface InputCollectionScreenProps {
	scripts: ScriptWithInputs[];
	fetcher: CertFetcher;
	onComplete: (collected: ScriptInputs) => void;
	onCancel: () => void;
}

/** Flat list of all (script, input) pairs that need to be collected. */
interface PromptItem {
	scriptId: string;
	scriptName: string;
	inputDef: InputDef;
}

function buildPromptQueue(scripts: ScriptWithInputs[]): PromptItem[] {
	const queue: PromptItem[] = [];
	for (const script of scripts) {
		for (const inputDef of script.inputs) {
			queue.push({
				scriptId: script.id,
				scriptName: script.name,
				inputDef,
			});
		}
	}
	return queue;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Orchestrates collection of all inputs across all selected scripts, one
 * prompt at a time, before the confirmation screen.
 *
 * - Sequences prompts in script declaration order (FR-3-002, FR-3-051).
 * - Each prompt is labeled with the owning script's name (FR-3-003, FR-3-051).
 * - Q / Ctrl+C shows a cancel confirmation; confirmed → onCancel,
 *   declined → resumes collection (FR-3-052).
 * - Scripts with no inputs are skipped silently.
 * - When all prompts are answered, calls onComplete with the ScriptInputs map.
 */
export function InputCollectionScreen({
	scripts,
	fetcher,
	onComplete,
	onCancel,
}: InputCollectionScreenProps) {
	const [queue] = useState<PromptItem[]>(() => buildPromptQueue(scripts));
	const [cursor, setCursor] = useState(0);
	const [collected, setCollected] = useState<Map<string, CollectedInput[]>>(
		() => new Map(),
	);
	const [confirmingCancel, setConfirmingCancel] = useState(false);

	// If there are no inputs to collect, call onComplete immediately.
	useEffect(() => {
		if (queue.length === 0) {
			onComplete(new Map());
		}
	}, [queue, onComplete]);

	// Handle Q / Ctrl+C to show cancel confirmation (only during collection,
	// not while the confirmation dialog itself is open — the dialog handles its
	// own input via useInput with isActive).
	useInput(
		(input, key) => {
			if (confirmingCancel) {
				// y / Y → confirmed cancel
				if (input === "y" || input === "Y") {
					onCancel();
					return;
				}
				// n / N / Escape → resume
				if (input === "n" || input === "N" || key.escape) {
					setConfirmingCancel(false);
					return;
				}
				return;
			}

			// Show cancel confirmation on Q or Ctrl+C
			if (input === "q" || (key.ctrl && input === "c")) {
				setConfirmingCancel(true);
			}
		},
		{ isActive: cursor < queue.length },
	);

	// Nothing to render if queue is empty (effect will fire onComplete).
	if (queue.length === 0) {
		return null;
	}

	// All prompts answered — this should not normally be reached because we
	// call onComplete in the submit handler, but guard anyway.
	if (cursor >= queue.length) {
		return null;
	}

	const current = queue[cursor] as PromptItem;

	function handleSubmit(value: string, certCN?: string) {
		const entry: CollectedInput = {
			id: current.inputDef.id,
			label: current.inputDef.label,
			value,
			...(certCN !== undefined ? { certCN } : {}),
		};

		const next = new Map(collected);
		const existing = next.get(current.scriptId) ?? [];
		next.set(current.scriptId, [...existing, entry]);
		setCollected(next);

		const nextCursor = cursor + 1;
		if (nextCursor >= queue.length) {
			onComplete(next);
		} else {
			setCursor(nextCursor);
		}
	}

	// ── Cancel confirmation overlay ──────────────────────────────────────────
	if (confirmingCancel) {
		return (
			<Box flexDirection="column" gap={1}>
				<Text bold={true} color="yellow">
					Cancel input collection and exit? [y/N]
				</Text>
				<Text dimColor={true}>Press Y to confirm, N to resume.</Text>
			</Box>
		);
	}

	// ── Current prompt ───────────────────────────────────────────────────────
	const { scriptName, inputDef } = current;

	if (inputDef.type === "string") {
		return (
			<StringInputPrompt
				inputDef={inputDef}
				scriptName={scriptName}
				onSubmit={handleSubmit}
			/>
		);
	}

	if (inputDef.type === "number") {
		return (
			<NumberInputPrompt
				inputDef={inputDef}
				scriptName={scriptName}
				onSubmit={handleSubmit}
			/>
		);
	}

	// ssl-cert
	return (
		<SslCertInputPrompt
			inputDef={inputDef}
			scriptName={scriptName}
			fetcher={fetcher}
			onSubmit={(downloadPath, certCN) => handleSubmit(downloadPath, certCN)}
		/>
	);
}
