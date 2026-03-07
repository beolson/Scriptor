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

// ─── TlsCertFetcher ───────────────────────────────────────────────────────────

/**
 * Walks the peer certificate chain returned by node:tls and extracts
 * subject CN, issuer, expiry, and the raw DER bytes for each certificate.
 */
function tlsPeerToCertInfo(peer: tls.DetailedPeerCertificate): CertInfo[] {
	const seen = new Set<string>();
	const certs: CertInfo[] = [];
	let current: tls.DetailedPeerCertificate | null = peer;

	while (current != null) {
		const fp = current.fingerprint256 ?? current.fingerprint;
		if (fp && seen.has(fp)) break;
		if (fp) seen.add(fp);

		const subjectCN =
			typeof current.subject === "object" && current.subject !== null
				? ((current.subject as Record<string, string>).CN ?? "")
				: "";
		const issuerCN =
			typeof current.issuer === "object" && current.issuer !== null
				? ((current.issuer as Record<string, string>).CN ?? "")
				: "";

		// raw is a Buffer containing the DER-encoded certificate
		const rawDer =
			current.raw instanceof Buffer
				? new Uint8Array(current.raw)
				: new Uint8Array(0);

		certs.push({
			subject: `CN=${subjectCN}`,
			issuer: `CN=${issuerCN}`,
			expiresAt: new Date(current.valid_to),
			rawDer,
		});

		// Walk up the chain; stop when issuer == subject (self-signed root)
		if (current.issuerCertificate == null) break;
		if (current.issuerCertificate === current) break;
		current = current.issuerCertificate;
	}

	return certs;
}

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
						resolve(tlsPeerToCertInfo(peer));
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
