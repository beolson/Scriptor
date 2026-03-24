// ---------------------------------------------------------------------------
// Input Collection — String + Number + SSL-Cert
//
// Prompts the user for each declared input across all selected scripts in
// order. Builds a flat queue of { script, def } pairs and calls the
// injectable `text` dep for each item.
//
// SSL-cert inputs run a four-step flow:
//   Step 1 — URL entry (text)
//   Step 2 — chain fetch (spinner + fetchCertChain)
//   Step 3 — cert selection (select)
//   Step 4 — cert download (spinner + downloadCert)
//
// All @clack/prompts calls are injectable via `deps` for testability.
// ---------------------------------------------------------------------------

import * as clackPrompts from "@clack/prompts";
import type {
	CollectedInput,
	InputDef,
	ScriptEntry,
	ScriptInputs,
} from "../manifest/types.js";
import type { CertInfo } from "./sslCert.js";
import { certRoleLabel, parseHostname } from "./sslCert.js";

// ---------------------------------------------------------------------------
// TextOpts
// ---------------------------------------------------------------------------

/** Options passed to the injectable `text` dep. */
export interface TextOpts {
	message: string;
	initialValue?: string;
	validate?: (value: string) => string | undefined;
}

// ---------------------------------------------------------------------------
// SelectOpts
// ---------------------------------------------------------------------------

/** Options passed to the injectable `select` dep. */
export interface SelectOpts {
	message: string;
	options: Array<{ value: number; label: string; hint?: string }>;
}

// ---------------------------------------------------------------------------
// InputCollectionDeps
// ---------------------------------------------------------------------------

/** Injectable dependencies for `collectInputs`. */
export interface InputCollectionDeps {
	/** Prompt the user for a text value. Returns the string or a cancel symbol. */
	text: (opts: TextOpts) => Promise<string | symbol>;
	/** Returns true if the value is a cancel symbol from @clack/prompts. */
	isCancel: (val: unknown) => val is symbol;
	/** Prints a cancellation message to the terminal (clack cancel style). */
	cancel: (hint?: string) => void;
	/** Logging interface. */
	log: {
		error: (msg: string) => void;
	};
	/** Process exit, injectable for tests. Never returns. */
	exit: (code: number) => never;
	/** Prompt the user to select one option from a list. Returns the selected index or a cancel symbol. */
	select: (opts: SelectOpts) => Promise<number | symbol>;
	/** Returns a spinner for displaying progress messages. */
	spinner: () => { start: (msg: string) => void; stop: (msg: string) => void };
	/** Fetches the certificate chain for host:port. Returns root-first CertInfo[]. */
	fetchCertChain: (host: string, port: number) => Promise<CertInfo[]>;
	/** Downloads a certificate to the given path in the given format. */
	downloadCert: (
		certDer: Buffer,
		path: string,
		format: "pem" | "der",
	) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Default deps
// ---------------------------------------------------------------------------

function makeDefaultDeps(): InputCollectionDeps {
	const {
		defaultConnectTls,
		defaultFetchDer,
		downloadCert: downloadCertImpl,
		fetchCertChain: fetchCertChainImpl,
	} = require("./sslCert.js") as typeof import("./sslCert.js");
	const fs = require("node:fs") as typeof import("node:fs");
	const fsPromises =
		require("node:fs/promises") as typeof import("node:fs/promises");

	const sslCertDeps = {
		connectTls: defaultConnectTls,
		fetchDer: defaultFetchDer,
		mkdirSync: fs.mkdirSync,
		writeFile: fsPromises.writeFile,
	};

	return {
		text: clackPrompts.text,
		isCancel: clackPrompts.isCancel,
		cancel: clackPrompts.cancel,
		log: {
			error: (msg: string) => {
				console.error(msg);
			},
		},
		exit: (code: number): never => process.exit(code),
		select: (opts: SelectOpts) =>
			clackPrompts.select({
				message: opts.message,
				options: opts.options,
			}) as Promise<number | symbol>,
		spinner: () => clackPrompts.spinner(),
		fetchCertChain: (host: string, port: number) =>
			fetchCertChainImpl(host, port, sslCertDeps),
		downloadCert: (certDer: Buffer, path: string, format: "pem" | "der") =>
			downloadCertImpl(certDer, path, format, sslCertDeps),
	};
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Wraps a string in ANSI dim escape codes. */
function dim(s: string): string {
	return `\x1b[2m${s}\x1b[0m`;
}

/** Queue item: a script paired with one of its input definitions. */
interface QueueItem {
	script: ScriptEntry;
	def: InputDef;
}

/** Builds a flat, ordered queue of all inputs from all scripts.
 *  Inputs with the same id are deduplicated — only the first occurrence is kept. */
function buildQueue(scripts: ScriptEntry[]): QueueItem[] {
	const queue: QueueItem[] = [];
	const seen = new Set<string>();
	for (const script of scripts) {
		for (const def of script.inputs) {
			if (!seen.has(def.id)) {
				seen.add(def.id);
				queue.push({ script, def });
			}
		}
	}
	return queue;
}

/** Returns the validate function for a given input definition. */
function makeValidate(
	def: InputDef,
): ((value: string) => string | undefined) | undefined {
	const isRequired = def.required === true;
	const isNumber = def.type === "number";

	if (!isRequired && !isNumber) return undefined;

	return (value: string): string | undefined => {
		if (isRequired && value.trim() === "") {
			return "This field is required.";
		}
		if (isNumber && value !== "" && Number.isNaN(Number(value))) {
			return "Please enter a valid number.";
		}
		return undefined;
	};
}

// ---------------------------------------------------------------------------
// collectInputs
// ---------------------------------------------------------------------------

/**
 * Collects all declared inputs from `orderedScripts` in queue order.
 *
 * Returns an empty Map immediately when no scripts have inputs.
 *
 * For each input:
 * - string/number: Prompts via `deps.text()`; on cancel shows exit confirmation.
 * - ssl-cert: Runs a four-step flow (URL entry → chain fetch → cert select → download).
 * - On cancel at any point: prints "User canceled." and exits immediately via
 *   `deps.exit(0)` with no confirmation dialog.
 * - On valid entry: stores `CollectedInput { value }` (plus `certCN` for ssl-cert) in the result map.
 */
export async function collectInputs(
	orderedScripts: ScriptEntry[],
	deps: InputCollectionDeps = makeDefaultDeps(),
): Promise<ScriptInputs> {
	const queue = buildQueue(orderedScripts);
	const result: ScriptInputs = new Map<string, CollectedInput>();

	if (queue.length === 0) return result;

	for (const { script, def } of queue) {
		if (def.type === "ssl-cert") {
			const collected = await collectSslCertInput(script, def, deps);
			result.set(def.id, collected);
		} else {
			const collected = await collectStringOrNumberInput(script, def, deps);
			result.set(def.id, collected);
		}
	}

	return result;
}

// ---------------------------------------------------------------------------
// collectStringOrNumberInput
// ---------------------------------------------------------------------------

/**
 * Collects a single string or number input, looping on cancel until the user
 * either provides a value or confirms exit.
 */
async function collectStringOrNumberInput(
	script: ScriptEntry,
	def: InputDef,
	deps: InputCollectionDeps,
): Promise<CollectedInput> {
	const message = `${dim(script.name)}\n${def.label}`;
	const initialValue = def.default ?? "";
	const validate = makeValidate(def);

	const rawResult = await deps.text({ message, initialValue, validate });

	if (deps.isCancel(rawResult)) handleCancel(deps);

	return { value: rawResult as string };
}

// ---------------------------------------------------------------------------
// collectSslCertInput
// ---------------------------------------------------------------------------

/**
 * Collects an ssl-cert input via the four-step flow:
 *   Step 1 — URL entry
 *   Step 2 — chain fetch (with spinner)
 *   Step 3 — cert selection
 *   Step 4 — cert download (with spinner)
 */
async function collectSslCertInput(
	script: ScriptEntry,
	def: InputDef,
	deps: InputCollectionDeps,
): Promise<CollectedInput> {
	const urlMessage = `${dim(script.name)}\n${def.label}`;

	// Step 1 — URL entry (outer loop; loops back here on fetch failure)
	while (true) {
		// Step 1: Prompt for URL
		const urlResult = await deps.text({
			message: urlMessage,
			initialValue: "",
		});

		if (deps.isCancel(urlResult)) handleCancel(deps);

		const { host, port } = parseHostname(urlResult as string);

		// Step 2: Fetch cert chain
		let chain: CertInfo[];
		{
			const spin = deps.spinner();
			spin.start("Fetching certificate chain…");
			try {
				chain = await deps.fetchCertChain(host, port);
				spin.stop("");
			} catch (err) {
				spin.stop("");
				deps.log.error(err instanceof Error ? err.message : String(err));
				continue; // loop back to Step 1
			}
		}

		// Step 3 — cert selection (inner loop; loops back here on download failure)
		while (true) {
			// Build options: one per cert in chain (already root-first from fetchCertChain)
			const options = chain.map((cert, idx) => {
				const role = certRoleLabel(cert.isLeaf, cert.isSelfSigned);
				const label = role ? `${role} ${cert.cn}`.trimEnd() : cert.cn;
				return {
					value: idx,
					label,
					hint: `Expires: ${cert.validTo}`,
				};
			});

			const selectResult = await deps.select({
				message: `${dim(script.name)}\n${def.label} — Select certificate`,
				options,
			});

			if (deps.isCancel(selectResult)) handleCancel(deps);

			const idx = selectResult as number;
			const selectedCert = chain[idx];
			if (selectedCert === undefined) continue;

			// Step 4: Download cert
			const downloadPath = def.download_path as string;
			const format = (def.format as "pem" | "der" | undefined) ?? "pem";

			{
				const spin = deps.spinner();
				spin.start("Downloading certificate…");
				try {
					await deps.downloadCert(selectedCert.der, downloadPath, format);
					spin.stop("");
				} catch (err) {
					spin.stop("");
					deps.log.error(err instanceof Error ? err.message : String(err));
					continue; // loop back to Step 3
				}
			}

			return { value: downloadPath, certCN: selectedCert.cn };
		}
	}
}

// ---------------------------------------------------------------------------
// handleCancel
// ---------------------------------------------------------------------------

/**
 * Prints a cancellation message and exits the process immediately.
 * Never returns.
 */
function handleCancel(deps: InputCollectionDeps): never {
	deps.cancel("User canceled.");
	return deps.exit(0);
}
