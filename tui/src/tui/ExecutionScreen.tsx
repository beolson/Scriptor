import { Box, Text, useApp, useInput, useStdout } from "ink";
import { useEffect, useRef, useState } from "react";
import type {
	ProgressEvent,
	ScriptRunResult,
} from "../execution/scriptRunner.js";
import type { ScriptEntry } from "../manifest/parseManifest.js";

// ---------------------------------------------------------------------------
// Spinner frames
// ---------------------------------------------------------------------------

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const SPINNER_INTERVAL_MS = 80;

/** Maximum output lines to show per script in the TUI. */
const MAX_OUTPUT_LINES = 8;

// ---------------------------------------------------------------------------
// Per-script status
// ---------------------------------------------------------------------------

type ScriptStatus =
	| { kind: "pending" }
	| { kind: "running" }
	| { kind: "done" }
	| { kind: "failed"; exitCode: number };

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ExecutionScreenProps {
	/** The ordered list of scripts that will be executed. */
	scripts: ScriptEntry[];
	/**
	 * Injectable execution function. Callers wire in ScriptRunner + LogService.
	 * It must call `onProgress` for each ProgressEvent and resolve with the
	 * final ScriptRunResult (including the log file path).
	 */
	runExecution: (
		onProgress: (event: ProgressEvent) => void,
	) => Promise<ScriptRunResult>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Displays real-time progress as scripts execute sequentially.
 *
 * - Shows a spinner next to the currently running script.
 * - Shows ✓ / ✗ once each script completes.
 * - Blocks Q and Ctrl+C while any script is running.
 * - Exits automatically after all scripts finish or halt on failure,
 *   printing the log file path to stdout.
 */
export function ExecutionScreen({
	scripts,
	runExecution,
}: ExecutionScreenProps) {
	const { exit } = useApp();
	const { write: writeToStdout } = useStdout();

	// Map from script id → current status
	const [statuses, setStatuses] = useState<Map<string, ScriptStatus>>(
		() => new Map(scripts.map((s) => [s.id, { kind: "pending" }])),
	);

	// Whether any script is currently running (used to block quit keys)
	const [isRunning, setIsRunning] = useState(false);

	// Whether execution has finished (success or halted on failure)
	const [finished, setFinished] = useState(false);

	// Spinner frame index
	const [spinnerFrame, setSpinnerFrame] = useState(0);

	// Recent output lines per script id (capped at MAX_OUTPUT_LINES)
	const [outputLines, setOutputLines] = useState<Map<string, string[]>>(
		() => new Map(),
	);

	// We track the spinner interval via a ref so we can clear it on unmount
	const spinnerRef = useRef<ReturnType<typeof setInterval> | null>(null);

	// Start spinner
	useEffect(() => {
		spinnerRef.current = setInterval(() => {
			setSpinnerFrame((f) => (f + 1) % SPINNER_FRAMES.length);
		}, SPINNER_INTERVAL_MS);
		return () => {
			if (spinnerRef.current !== null) {
				clearInterval(spinnerRef.current);
			}
		};
	}, []);

	// Run scripts once on mount
	useEffect(() => {
		setIsRunning(true);

		function handleProgress(event: ProgressEvent) {
			if (event.status === "output") {
				setOutputLines((prev) => {
					const next = new Map(prev);
					const current = next.get(event.scriptId) ?? [];
					next.set(
						event.scriptId,
						[...current, event.line].slice(-MAX_OUTPUT_LINES),
					);
					return next;
				});
				return;
			}

			// Clear output lines for scripts that finish successfully.
			if (event.status === "done") {
				setOutputLines((prev) => {
					const next = new Map(prev);
					next.delete(event.scriptId);
					return next;
				});
			}

			setStatuses((prev) => {
				const next = new Map(prev);
				switch (event.status) {
					case "pending":
						next.set(event.scriptId, { kind: "pending" });
						break;
					case "running":
						next.set(event.scriptId, { kind: "running" });
						break;
					case "done":
						next.set(event.scriptId, { kind: "done" });
						break;
					case "failed":
						next.set(event.scriptId, {
							kind: "failed",
							exitCode: event.exitCode,
						});
						break;
				}
				return next;
			});
		}

		runExecution(handleProgress)
			.then((result) => {
				setIsRunning(false);
				setFinished(true);
				// Print log file path to stdout after the TUI has unmounted.
				// We defer the exit so Ink has a frame to render the final state.
				setTimeout(() => {
					writeToStdout(`\nLog file: ${result.logFile}\n`);
					exit();
				}, 150);
			})
			.catch(() => {
				setIsRunning(false);
				setFinished(true);
				setTimeout(() => {
					exit();
				}, 150);
			});
	}, [exit, runExecution, writeToStdout]);

	// Block Q / Ctrl+C while a script is running
	useInput((input, key) => {
		if (isRunning) {
			// Swallow the key — quit is not allowed while executing
			return;
		}
		// If finished (shouldn't normally reach here — we auto-exit), allow quit
		if (input === "q" || (key.ctrl && input === "c")) {
			exit();
		}
	});

	return (
		<Box flexDirection="column" gap={0}>
			{scripts.map((entry) => {
				const status = statuses.get(entry.id) ?? { kind: "pending" };
				const lines = outputLines.get(entry.id) ?? [];
				const showOutput =
					(status.kind === "running" || status.kind === "failed") &&
					lines.length > 0;
				return (
					<Box key={entry.id} flexDirection="column">
						<Box flexDirection="row" gap={1}>
							<StatusIcon status={status} spinnerFrame={spinnerFrame} />
							<Text
								color={
									status.kind === "done"
										? "green"
										: status.kind === "failed"
											? "red"
											: status.kind === "running"
												? "cyan"
												: undefined
								}
								dimColor={status.kind === "pending"}
							>
								{entry.name}
							</Text>
							{status.kind === "failed" && (
								<Text color="red" dimColor={true}>
									{`(exit code ${status.exitCode})`}
								</Text>
							)}
						</Box>
						{showOutput && (
							<Box flexDirection="column" marginLeft={2}>
								{lines.map((line, i) => (
									<Text
										// biome-ignore lint/suspicious/noArrayIndexKey: stable output buffer
										key={i}
										color={status.kind === "failed" ? "red" : undefined}
										dimColor
									>
										{line}
									</Text>
								))}
							</Box>
						)}
					</Box>
				);
			})}

			{/* Blocked-quit warning, shown only while running */}
			{isRunning && (
				<Box marginTop={1}>
					<Text dimColor={true}>
						A script is running — please wait for it to finish.
					</Text>
				</Box>
			)}

			{/* Completion notice */}
			{finished && (
				<Box marginTop={1}>
					<Text dimColor={true}>Execution complete. Exiting…</Text>
				</Box>
			)}
		</Box>
	);
}

// ---------------------------------------------------------------------------
// StatusIcon helper component
// ---------------------------------------------------------------------------

interface StatusIconProps {
	status: ScriptStatus;
	spinnerFrame: number;
}

function StatusIcon({ status, spinnerFrame }: StatusIconProps) {
	switch (status.kind) {
		case "pending":
			return <Text dimColor={true}>·</Text>;
		case "running":
			return <Text color="cyan">{SPINNER_FRAMES[spinnerFrame] ?? "⠋"}</Text>;
		case "done":
			return <Text color="green">✓</Text>;
		case "failed":
			return <Text color="red">✗</Text>;
	}
}
