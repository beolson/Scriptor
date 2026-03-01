import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Formats a Date into an ISO-8601-like string safe for use in file names.
 * Colons in the time portion are replaced with hyphens.
 * Example: "2026-02-28T14-32-00"
 *
 * The file-name pattern required by the spec is `YYYY-MM-DDTHH-MM-SS.log`.
 * When two log files are created within the same second a monotonically
 * increasing counter suffix is appended to keep paths unique.
 */
function formatTimestamp(date: Date): string {
	// Build YYYY-MM-DDTHH-MM-SS from UTC parts to keep names deterministic
	const yyyy = date.getUTCFullYear().toString().padStart(4, "0");
	const mm = (date.getUTCMonth() + 1).toString().padStart(2, "0");
	const dd = date.getUTCDate().toString().padStart(2, "0");
	const hh = date.getUTCHours().toString().padStart(2, "0");
	const min = date.getUTCMinutes().toString().padStart(2, "0");
	const ss = date.getUTCSeconds().toString().padStart(2, "0");
	return `${yyyy}-${mm}-${dd}T${hh}-${min}-${ss}`;
}

/** Tracks the last second-level timestamp and a counter for sub-second disambiguation. */
let lastTimestamp = "";
let seqCounter = 0;

/**
 * Returns a unique file-name stem for the current moment.
 * Format: `YYYY-MM-DDTHH-MM-SS` or `YYYY-MM-DDTHH-MM-SS-N` for N > 0.
 */
function uniqueLogStem(): string {
	const base = formatTimestamp(new Date());
	if (base !== lastTimestamp) {
		lastTimestamp = base;
		seqCounter = 0;
		return base;
	}
	seqCounter += 1;
	return `${base}-${seqCounter}`;
}

/**
 * Formats a Date for display inside log file content (human-readable ISO string).
 */
function formatDisplayTime(date: Date): string {
	return date.toISOString();
}

const SEPARATOR = "=".repeat(60);

/**
 * Manages per-run log files stored in `~/.scriptor/logs/`.
 * Accepts an injectable base path for testing without touching the real home directory.
 */
export class LogService {
	private readonly logsDir: string;

	constructor(baseDir: string = homedir()) {
		this.logsDir = join(baseDir, ".scriptor", "logs");
	}

	/**
	 * Creates a new log file named by the current UTC timestamp.
	 * Returns the absolute path of the created file.
	 */
	async createLogFile(): Promise<string> {
		const name = `${uniqueLogStem()}.log`;
		const filePath = join(this.logsDir, name);
		// Write an empty file to ensure it exists on disk immediately.
		await Bun.write(filePath, "");
		return filePath;
	}

	/**
	 * Writes a prominent banner for a script to the log file.
	 * @param logFile  Absolute path returned by `createLogFile`.
	 * @param scriptName  Human-readable script identifier.
	 * @param startTime  Timestamp when the script started.
	 */
	async writeScriptBanner(
		logFile: string,
		scriptName: string,
		startTime: Date,
	): Promise<void> {
		const banner =
			`\n${SEPARATOR}\n` +
			`Script : ${scriptName}\n` +
			`Started: ${formatDisplayTime(startTime)}\n` +
			`${SEPARATOR}\n`;
		await this._appendRaw(logFile, banner);
	}

	/**
	 * Appends raw stdout/stderr content to the log file.
	 * @param logFile  Absolute path returned by `createLogFile`.
	 * @param output  Raw text to append (may be empty).
	 */
	async appendOutput(logFile: string, output: string): Promise<void> {
		if (output.length === 0) {
			return;
		}
		await this._appendRaw(logFile, output);
	}

	/**
	 * Writes a closing footer for a script to the log file.
	 * @param logFile  Absolute path returned by `createLogFile`.
	 * @param exitCode  Process exit code (0 = success).
	 * @param endTime  Timestamp when the script finished.
	 */
	async writeScriptFooter(
		logFile: string,
		exitCode: number,
		endTime: Date,
	): Promise<void> {
		const footer =
			`${SEPARATOR}\n` +
			`Ended    : ${formatDisplayTime(endTime)}\n` +
			`Exit code: ${exitCode}\n` +
			`${SEPARATOR}\n`;
		await this._appendRaw(logFile, footer);
	}

	/**
	 * Internal helper: reads existing file content and rewrites with appended data.
	 * Bun does not expose a native append API, so we read-then-write.
	 */
	private async _appendRaw(filePath: string, data: string): Promise<void> {
		const file = Bun.file(filePath);
		const existing = await file.text();
		await Bun.write(filePath, existing + data);
	}
}
