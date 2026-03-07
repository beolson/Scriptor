import { Box, Text, useInput } from "ink";
import { useEffect, useState } from "react";
import type { SslCertInputDef } from "../inputSchema.js";
import type { CertFetcher, CertInfo } from "../sslCert/certFetcher.js";
import { downloadCert } from "../sslCert/certFetcher.js";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = "url" | "fetching" | "select" | "downloading";

export interface SslCertInputPromptProps {
	inputDef: SslCertInputDef;
	scriptName: string;
	fetcher: CertFetcher;
	/**
	 * Called when the certificate has been downloaded.
	 * @param downloadPath - the local filesystem path the cert was saved to
	 * @param certCN - the Common Name (CN) of the selected certificate (FR-3-041)
	 */
	onSubmit: (downloadPath: string, certCN: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse a URL or bare host[:port] string into { host, port }.
 * Defaults port to 443 when absent.
 */
function parseHostPort(raw: string): { host: string; port: number } {
	const trimmed = raw.trim();
	// Try as a URL first (handles https://host:port/path)
	try {
		const url = new URL(
			trimmed.includes("://") ? trimmed : `https://${trimmed}`,
		);
		return {
			host: url.hostname,
			port: url.port ? Number(url.port) : 443,
		};
	} catch {
		// Fallback: treat as host:port
		const colonIdx = trimmed.lastIndexOf(":");
		if (colonIdx > 0) {
			const port = Number(trimmed.slice(colonIdx + 1));
			if (!Number.isNaN(port)) {
				return { host: trimmed.slice(0, colonIdx), port };
			}
		}
		return { host: trimmed, port: 443 };
	}
}

function formatDate(d: Date): string {
	return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Multi-step Ink component for the `ssl-cert` input type.
 *
 * Step 1 (url)       – prompts for a URL/host
 * Step 2 (fetching)  – loading indicator while `fetcher.fetchChain` runs;
 *                       on error, shows the message and returns to step 1 (FR-3-014)
 * Step 3 (select)    – arrow keys + Enter to pick a cert from the chain (FR-3-015/016)
 * Step 4 (downloading) – writes the cert to disk, then calls onSubmit
 *
 * Displays the owning script name above the prompt (FR-3-003).
 */
export function SslCertInputPrompt({
	inputDef,
	scriptName,
	fetcher,
	onSubmit,
}: SslCertInputPromptProps) {
	// ── Step 1: URL entry ────────────────────────────────────────────────────
	const [step, setStep] = useState<Step>("url");
	const [urlInput, setUrlInput] = useState("");
	const [fetchError, setFetchError] = useState<string | null>(null);

	// ── Step 3: cert selection ───────────────────────────────────────────────
	const [certs, setCerts] = useState<CertInfo[]>([]);
	const [cursor, setCursor] = useState(0);

	// ── Step 4: downloading ──────────────────────────────────────────────────
	const [downloadError, setDownloadError] = useState<string | null>(null);

	// ── Async: fetch chain after URL is submitted ────────────────────────────
	useEffect(() => {
		if (step !== "fetching") return;

		const { host, port } = parseHostPort(urlInput);

		fetcher
			.fetchChain(host, port)
			.then((chain) => {
				setCerts(chain);
				setCursor(0);
				setFetchError(null);
				setStep("select");
			})
			.catch((err: unknown) => {
				const msg = err instanceof Error ? err.message : String(err);
				setFetchError(msg);
				setStep("url");
			});
	}, [step, fetcher, urlInput]);

	// ── Async: download cert after selection ─────────────────────────────────
	useEffect(() => {
		if (step !== "downloading") return;

		const selected = certs[cursor];
		if (selected === undefined) {
			setStep("select");
			return;
		}

		downloadCert(selected, inputDef.download_path, inputDef.format)
			.then(() => {
				// Extract CN from the subject string (e.g. "CN=example.com" → "example.com")
				const cn = selected.subject.replace(/^CN=/i, "");
				onSubmit(inputDef.download_path, cn);
			})
			.catch((err: unknown) => {
				const msg = err instanceof Error ? err.message : String(err);
				setDownloadError(msg);
				setStep("select");
			});
	}, [step, certs, cursor, inputDef.download_path, inputDef.format, onSubmit]);

	// ── Input handling ───────────────────────────────────────────────────────
	useInput((input, key) => {
		if (step === "url") {
			if (key.return) {
				if (urlInput.trim() !== "") {
					setStep("fetching");
				}
				return;
			}
			if (key.backspace || key.delete) {
				setUrlInput((v) => v.slice(0, -1));
				return;
			}
			if (input.length > 0 && !key.ctrl && !key.meta) {
				setUrlInput((v) => v + input);
				setFetchError(null);
			}
			return;
		}

		if (step === "select") {
			if (key.upArrow) {
				setCursor((c) => Math.max(0, c - 1));
				return;
			}
			if (key.downArrow) {
				setCursor((c) => Math.min(certs.length - 1, c + 1));
				return;
			}
			if (key.return) {
				setDownloadError(null);
				setStep("downloading");
			}
		}
	});

	// ── Render ───────────────────────────────────────────────────────────────
	return (
		<Box flexDirection="column" gap={0}>
			{/* Script context label (FR-3-003) */}
			<Text dimColor={true}>{scriptName}</Text>

			{/* Step 1: URL prompt */}
			{(step === "url" || step === "fetching") && (
				<>
					<Box flexDirection="row" gap={1}>
						<Text>{inputDef.label}:</Text>
						<Text>{urlInput}</Text>
						{step === "url" && <Text inverse={true}> </Text>}
					</Box>

					{/* Fetch error — shown after a failed attempt */}
					{fetchError !== null && (
						<Box marginTop={0}>
							<Text color="red">{fetchError}</Text>
						</Box>
					)}

					{/* Loading indicator */}
					{step === "fetching" && (
						<Box marginTop={0}>
							<Text dimColor={true}>Fetching certificate chain…</Text>
						</Box>
					)}
				</>
			)}

			{/* Step 3: cert selection list */}
			{step === "select" && (
				<>
					<Box flexDirection="column" marginTop={0}>
						<Text>Select a certificate:</Text>
						{certs.map((cert, idx) => {
							const isFocused = idx === cursor;
							return (
								<Box key={`${cert.subject}-${idx}`} flexDirection="row" gap={1}>
									<Text bold={isFocused} color={isFocused ? "blue" : undefined}>
										{isFocused ? ">" : " "}
									</Text>
									<Text bold={isFocused}>
										{`${cert.subject}  Issuer: ${cert.issuer}  Expires: ${formatDate(cert.expiresAt)}`}
									</Text>
								</Box>
							);
						})}
					</Box>

					{downloadError !== null && (
						<Box marginTop={0}>
							<Text color="red">{downloadError}</Text>
						</Box>
					)}
				</>
			)}

			{/* Step 4: downloading indicator */}
			{step === "downloading" && (
				<Box marginTop={0}>
					<Text dimColor={true}>Downloading certificate…</Text>
				</Box>
			)}
		</Box>
	);
}
