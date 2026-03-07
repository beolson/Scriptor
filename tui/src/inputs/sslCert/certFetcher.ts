import * as crypto from "node:crypto";
import * as tls from "node:tls";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CertInfo {
	subject: string;
	issuer: string;
	expiresAt: Date;
	rawDer: Uint8Array;
}

export interface CertFetcher {
	fetchChain(host: string, port: number): Promise<CertInfo[]>;
}

// ─── Errors ───────────────────────────────────────────────────────────────────

export class CertFetchError extends Error {
	constructor(message: string, cause?: unknown) {
		super(message);
		this.name = "CertFetchError";
		if (cause !== undefined) {
			this.cause = cause;
		}
	}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CA_ISSUERS_RE = /CA Issuers - URI:(\S+)/;
const MAX_CHAIN_DEPTH = 10;

/** Extract CN from an X.509 subject/issuer string like "CN=example.com\nO=Org" */
function extractCN(field: string): string {
	const match = field.match(/CN=([^\n]*)/);
	return match?.[1] ?? "";
}

function x509ToCertInfo(x509: crypto.X509Certificate): CertInfo {
	return {
		subject: `CN=${extractCN(x509.subject)}`,
		issuer: `CN=${extractCN(x509.issuer)}`,
		expiresAt: new Date(x509.validTo),
		rawDer: new Uint8Array(x509.raw),
	};
}

/**
 * Walk the chain by following AIA (Authority Information Access) CA Issuers
 * URLs. Each certificate's infoAccess field may contain a URL pointing to
 * the issuer's DER-encoded certificate.
 */
async function walkChainViaAIA(
	leaf: crypto.X509Certificate,
): Promise<CertInfo[]> {
	const certs: CertInfo[] = [x509ToCertInfo(leaf)];
	let current = leaf;

	for (let i = 0; i < MAX_CHAIN_DEPTH; i++) {
		// Self-signed root — stop
		if (current.subject === current.issuer) break;

		const aiaMatch = current.infoAccess?.match(CA_ISSUERS_RE);
		if (!aiaMatch?.[1]) break;

		const resp = await fetch(aiaMatch[1]);
		if (!resp.ok) break;

		const buf = await resp.arrayBuffer();
		try {
			current = new crypto.X509Certificate(Buffer.from(buf));
		} catch {
			break;
		}

		certs.push(x509ToCertInfo(current));
	}

	return certs;
}

// ─── TlsCertFetcher ───────────────────────────────────────────────────────────

/**
 * Fetches the full certificate chain for a TLS endpoint.
 *
 * Bun's `getPeerCertificate(true)` does not populate `issuerCertificate`
 * beyond the leaf cert. To get the full chain we connect via node:tls to
 * obtain the leaf, then walk up via AIA (Authority Information Access)
 * CA Issuers URLs embedded in each certificate.
 */
export class TlsCertFetcher implements CertFetcher {
	fetchChain(host: string, port: number): Promise<CertInfo[]> {
		return new Promise((resolve, reject) => {
			let settled = false;

			const socket = tls.connect(
				{ host, port, rejectUnauthorized: false },
				() => {
					if (settled) return;
					try {
						const peer = socket.getPeerCertificate(true);
						socket.destroy();
						settled = true;
						if (!peer || Object.keys(peer).length === 0) {
							reject(
								new CertFetchError(
									`No certificate returned from ${host}:${port}`,
								),
							);
							return;
						}
						const leaf = new crypto.X509Certificate(peer.raw);
						resolve(walkChainViaAIA(leaf));
					} catch (err) {
						settled = true;
						reject(
							new CertFetchError(
								`Failed to extract certificate from ${host}:${port}: ${String(err)}`,
								err,
							),
						);
					}
				},
			);

			socket.on("error", (err) => {
				if (settled) return;
				settled = true;
				socket.destroy();
				reject(
					new CertFetchError(
						`TLS connection to ${host}:${port} failed: ${err.message}`,
						err,
					),
				);
			});

			socket.setTimeout(10_000, () => {
				if (settled) return;
				settled = true;
				socket.destroy();
				reject(
					new CertFetchError(`TLS connection to ${host}:${port} timed out`),
				);
			});
		});
	}
}

// ─── MockCertFetcher ──────────────────────────────────────────────────────────

interface MockCertFetcherOptions {
	shouldThrow?: boolean;
	message?: string;
}

export class MockCertFetcher implements CertFetcher {
	private readonly certs: CertInfo[];
	private readonly options: MockCertFetcherOptions;

	constructor(certs: CertInfo[], options: MockCertFetcherOptions = {}) {
		this.certs = certs;
		this.options = options;
	}

	fetchChain(_host: string, _port: number): Promise<CertInfo[]> {
		if (this.options.shouldThrow) {
			return Promise.reject(
				new CertFetchError(
					this.options.message ?? "MockCertFetcher: simulated error",
				),
			);
		}
		return Promise.resolve(this.certs);
	}
}

// ─── downloadCert ─────────────────────────────────────────────────────────────

/**
 * Serializes a certificate to PEM or DER format and writes it to disk.
 */
export async function downloadCert(
	cert: CertInfo,
	path: string,
	format: "PEM" | "DER",
): Promise<void> {
	if (format === "DER") {
		await Bun.write(path, cert.rawDer);
	} else {
		// PEM = base64-encoded DER wrapped in header/footer lines
		const base64 = Buffer.from(cert.rawDer).toString("base64");
		// Split into 64-char lines per RFC 7468
		const lines = base64.match(/.{1,64}/g) ?? [];
		const pem = [
			"-----BEGIN CERTIFICATE-----",
			...lines,
			"-----END CERTIFICATE-----",
			"",
		].join("\n");
		await Bun.write(path, pem);
	}
}
