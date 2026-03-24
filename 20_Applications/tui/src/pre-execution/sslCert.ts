// ---------------------------------------------------------------------------
// SSL Certificate Helpers — Pure Parsing Functions + Chain Fetch / Download
//
// Pure parsing helpers plus the I/O-heavy functions for TLS connection,
// AIA chain walking, and certificate download. All I/O is injectable so
// these can be unit-tested without real network or filesystem access.
// ---------------------------------------------------------------------------

import { X509Certificate } from "node:crypto";
import { dirname } from "node:path";
import * as tls from "node:tls";

// ---------------------------------------------------------------------------
// parseHostname
// ---------------------------------------------------------------------------

/**
 * Parses a hostname input into a `{ host, port }` pair.
 *
 * Accepts three formats:
 * - `host`            → port 443
 * - `host:port`       → port as specified
 * - `https://host/…`  → host extracted, path stripped; port 443 unless
 *                       explicit port present in the URL
 */
export function parseHostname(input: string): { host: string; port: number } {
	if (input.startsWith("https://") || input.startsWith("http://")) {
		const url = new URL(input);
		const port = url.port ? Number(url.port) : 443;
		return { host: url.hostname, port };
	}

	const colonIdx = input.lastIndexOf(":");
	if (colonIdx !== -1) {
		const host = input.slice(0, colonIdx);
		const port = Number(input.slice(colonIdx + 1));
		return { host, port };
	}

	return { host: input, port: 443 };
}

// ---------------------------------------------------------------------------
// parseAiaUrl
// ---------------------------------------------------------------------------

/**
 * Extracts the first `CA Issuers` URI from an `X509Certificate.infoAccess`
 * string. Returns `null` if not found.
 */
export function parseAiaUrl(infoAccess: string): string | null {
	const match = /CA Issuers - URI:(.+)/m.exec(infoAccess);
	if (match === null) return null;
	return match[1]?.trim() ?? null;
}

// ---------------------------------------------------------------------------
// toPem
// ---------------------------------------------------------------------------

/**
 * Wraps a DER-encoded certificate buffer in PEM format with
 * `-----BEGIN CERTIFICATE-----` / `-----END CERTIFICATE-----` headers and
 * 64-character base64 line wrapping.
 */
export function toPem(derBuffer: Buffer): string {
	const b64 = derBuffer.toString("base64");
	const lines = b64.match(/.{1,64}/g) ?? [];
	return `-----BEGIN CERTIFICATE-----\n${lines.join("\n")}\n-----END CERTIFICATE-----\n`;
}

// ---------------------------------------------------------------------------
// certRoleLabel
// ---------------------------------------------------------------------------

/**
 * Returns a human-readable role label for a certificate in a chain:
 * - `"[site]"` — leaf certificate
 * - `"[root]"` — self-signed root certificate
 * - `""`       — intermediate certificate
 */
export function certRoleLabel(isLeaf: boolean, isSelfSigned: boolean): string {
	if (isLeaf) return "[site]";
	if (isSelfSigned) return "[root]";
	return "";
}

// ---------------------------------------------------------------------------
// SslFetchError
// ---------------------------------------------------------------------------

/**
 * Thrown by `fetchCertChain` when TLS connection or AIA cert fetch fails.
 */
export class SslFetchError extends Error {
	override readonly name = "SslFetchError";

	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = "SslFetchError";
	}
}

// ---------------------------------------------------------------------------
// CertInfo
// ---------------------------------------------------------------------------

/** Information about a single certificate in a chain. */
export interface CertInfo {
	/** Raw DER-encoded certificate bytes. */
	der: Buffer;
	/** Common Name (CN) extracted from the subject. */
	cn: string;
	/** Certificate validity end date string from X509Certificate.validTo. */
	validTo: string;
	/** True if this is the leaf certificate (the one returned by the server). */
	isLeaf: boolean;
	/** True if subject === issuer (self-signed root). */
	isSelfSigned: boolean;
}

// ---------------------------------------------------------------------------
// SslCertDeps
// ---------------------------------------------------------------------------

/** Injectable dependencies for `fetchCertChain` and `downloadCert`. */
export interface SslCertDeps {
	/** Establish a TLS connection and return the raw DER bytes of the leaf cert. */
	connectTls: (host: string, port: number) => Promise<Buffer>;
	/** Fetch a DER-encoded certificate from a URL. */
	fetchDer: (url: string, signal: AbortSignal) => Promise<Buffer>;
	/** Create a directory (and parents) synchronously. */
	mkdirSync: (path: string, opts: { recursive: boolean }) => void;
	/** Write data to a file. */
	writeFile: (path: string, data: Buffer | string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// fetchCertChain
// ---------------------------------------------------------------------------

/**
 * Fetches the full certificate chain for a host via TLS and AIA extension
 * walking. Returns certificates in root-first order.
 *
 * Chain walking stops when:
 * - The current certificate is self-signed (issuer === subject), OR
 * - No `CA Issuers` URL is found in the current cert's `infoAccess`, OR
 * - The chain reaches a depth of 10 certificates.
 *
 * Each individual AIA fetch is constrained by a 10-second `AbortSignal.timeout`.
 *
 * @throws {SslFetchError} on TLS connection failure or any AIA fetch failure.
 */
export async function fetchCertChain(
	host: string,
	port: number,
	deps: SslCertDeps,
): Promise<CertInfo[]> {
	// Step 1: Fetch the leaf certificate via TLS.
	let leafDer: Buffer;
	try {
		leafDer = await deps.connectTls(host, port);
	} catch (err) {
		throw new SslFetchError(
			`TLS connection to ${host}:${port} failed: ${err instanceof Error ? err.message : String(err)}`,
			{ cause: err },
		);
	}

	const leafCert = new X509Certificate(leafDer);
	const chain: CertInfo[] = [
		{
			der: leafDer,
			cn: extractCn(leafCert.subject),
			validTo: leafCert.validTo,
			isLeaf: true,
			isSelfSigned: leafCert.subject === leafCert.issuer,
		},
	];

	// Step 2: Walk the AIA chain.
	while (chain.length < 10) {
		const current = chain[chain.length - 1];
		// chain always has at least one entry (the leaf), so current is defined.
		if (current === undefined) break;

		// Stop if the current cert is self-signed.
		if (current.isSelfSigned) break;

		const currentCert = new X509Certificate(current.der);
		const aiaUrl = currentCert.infoAccess
			? parseAiaUrl(currentCert.infoAccess)
			: null;

		// Stop if no AIA URL.
		if (aiaUrl === null) break;

		let nextDer: Buffer;
		try {
			nextDer = await deps.fetchDer(aiaUrl, AbortSignal.timeout(10_000));
		} catch (err) {
			throw new SslFetchError(
				`Failed to fetch certificate from AIA URL ${aiaUrl}: ${err instanceof Error ? err.message : String(err)}`,
				{ cause: err },
			);
		}

		const nextCert = new X509Certificate(nextDer);
		chain.push({
			der: nextDer,
			cn: extractCn(nextCert.subject),
			validTo: nextCert.validTo,
			isLeaf: false,
			isSelfSigned: nextCert.subject === nextCert.issuer,
		});
	}

	// Step 3: Reverse to root-first order.
	chain.reverse();

	// The original leaf is now at the end; mark it as isLeaf.
	// (The reverse() above moves it to the last position.)
	const last = chain[chain.length - 1];
	if (last !== undefined) {
		last.isLeaf = true;
	}

	return chain;
}

// ---------------------------------------------------------------------------
// downloadCert
// ---------------------------------------------------------------------------

/**
 * Downloads a DER-encoded certificate to disk in the specified format.
 *
 * Creates parent directories automatically. Overwrites any existing file
 * without prompting.
 */
export async function downloadCert(
	certDer: Buffer,
	downloadPath: string,
	format: "pem" | "der",
	deps: SslCertDeps,
): Promise<void> {
	deps.mkdirSync(dirname(downloadPath), { recursive: true });

	if (format === "pem") {
		await deps.writeFile(downloadPath, toPem(certDer));
	} else {
		await deps.writeFile(downloadPath, certDer);
	}
}

// ---------------------------------------------------------------------------
// Real default SslCertDeps implementations
// ---------------------------------------------------------------------------

/**
 * Connects to `host:port` via TLS with certificate verification disabled
 * (we want to inspect the cert regardless of validity) and returns the raw
 * DER bytes of the leaf certificate presented by the server.
 */
export async function defaultConnectTls(
	host: string,
	port: number,
): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const socket = tls.connect(
			{ host, port, rejectUnauthorized: false },
			() => {
				const peerCert = socket.getPeerCertificate(true);
				const raw = peerCert.raw;
				socket.destroy();
				resolve(raw);
			},
		);
		socket.on("error", reject);
	});
}

/**
 * Fetches a DER-encoded certificate from a URL, respecting the provided
 * `AbortSignal` for timeout/cancellation.
 */
export async function defaultFetchDer(
	url: string,
	signal: AbortSignal,
): Promise<Buffer> {
	const resp = await fetch(url, { signal });
	return Buffer.from(await resp.arrayBuffer());
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extracts the CN value from a subject distinguished name string.
 * Falls back to the full subject string if no CN is found.
 *
 * Example: "CN=example.com\nO=Example Corp" → "example.com"
 */
function extractCn(subject: string): string {
	const match = /^CN=(.+)$/m.exec(subject);
	return match?.[1]?.trim() ?? subject;
}
