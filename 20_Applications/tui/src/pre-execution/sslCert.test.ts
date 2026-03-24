// ---------------------------------------------------------------------------
// SSL Certificate Helpers — Pure Function Tests + Chain Fetch / Download Tests
//
// Tests for the four pure, I/O-free helper functions and the I/O-heavy
// chain-fetch and cert-download functions (all with injectable deps).
// TDD: tests were written before each implementation (RED → GREEN).
// ---------------------------------------------------------------------------

import { describe, expect, it } from "bun:test";
import {
	certRoleLabel,
	downloadCert,
	fetchCertChain,
	parseAiaUrl,
	parseHostname,
	SslFetchError,
	toPem,
} from "./sslCert.js";

// ---------------------------------------------------------------------------
// Shared test DER buffers
//
// Real X.509 DER bytes generated with openssl so that X509Certificate can
// parse them in the implementation under test.
//
// selfSignedDer  — CN=test.example.com, self-signed, no AIA
// leafDer        — CN=leaf2.example.com, signed by Test CA, has AIA pointing
//                  to http://aia.example.com/ca.crt
// caDer          — CN=Test CA, self-signed, no AIA
// ---------------------------------------------------------------------------

const selfSignedDer = Buffer.from(
	"MIIDFzCCAf+gAwIBAgIUMW0Xs6ZgfFK1mEd8RjerSNYijrAwDQYJKoZIhvcNAQELBQAwGzEZMBcGA1UEAwwQdGVzdC5leGFtcGxlLmNvbTAeFw0yNjAzMjMxMjExMzFaFw0zNjAzMjAxMjExMzFaMBsxGTAXBgNVBAMMEHRlc3QuZXhhbXBsZS5jb20wggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQC0WTDOxTK5nphGJUR+CS8uYUm3cfca/W4gwyx8nJZA49MhyYkbU4Unvx/QGcJR04PgrAOaMEcfoewPEEI4JsCj6FoywVboiSHJBWMA3f4QN5VSeo4HRZ7oyj0zL5g7DDDHo6AguajOw+8iFBI7FEyFtJLH95xHbcWz5RuxeoZb0pP+tkCu9mZwnpIL67EyvnCJ8C/D3aWpOyvaj45iWLqgx8o+ftnJhvDB32LanR0yqPLISMTjUhyoj29O6F5W7Iq1h1zncB69cTM8RiLc9GpxDqkk+NKdTDeGXlqYqsFyahbX7jmL76TdRjF8SnS+L6hiRich1p/wfP1rhtstRx63AgMBAAGjUzBRMB0GA1UdDgQWBBRUAllGAh8Q9aFM9uOjE0TTta/VBTAfBgNVHSMEGDAWgBRUAllGAh8Q9aFM9uOjE0TTta/VBTAPBgNVHRMBAf8EBTADAQH/MA0GCSqGSIb3DQEBCwUAA4IBAQBsYq9yHKJQJN0WIZpFe5rH/qtS7QXqGaOIc+FEcBd+AZ3W4OukEakFk/rWM1soerq/iHgsB4Kjj0bql+qzjTQ6tCOZ29SOSVlpvpu0N4ajCx6EutghV2eHliYLlO123q2Zxz8Z+4mH2EZisz0tSZUHS1+0XA5JH7aVbfhnDBXwPCaY95M8pZgGcAWaLbTh2ltZ0nxe40363Ibrj8zp0C+Br6NT5DcM5L7I2NtydKXBX658Y54XNZUy1l/ku93JnSQrkF7ycPdFqlVXEHGODg36LA9AOAVMnPob+0YnmifoA0vuQveXG0fQ5m7RtPz6q3gyzd6vJ9M59ZU9wkqu2O7M",
	"base64",
);

const leafDer = Buffer.from(
	"MIIDOTCCAiGgAwIBAgIUNv0BJHTEuEtOYL6iJZ2HSDI/EmcwDQYJKoZIhvcNAQELBQAwEjEQMA4GA1UEAwwHVGVzdCBDQTAeFw0yNjAzMjMxMjM1NTFaFw0zNjAzMjAxMjM1NTFaMBwxGjAYBgNVBAMMEWxlYWYyLmV4YW1wbGUuY29tMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAr2AGVAjCCqYXyPZR2SFy+cx7ziDe0CYImB4JlxSD9eOAe+AcndEV5GGH2fbSCuM8raCcpRxn1mUfnt+85C1vbql3UJOQbBD19q3Peqgup9adUvrD9ntgZNNisbJm0Ly92ov0sikhfxvMs4AT+iXjshwG/Wzuqs4aCQ+zeX9+MsySGLc5ObJPW93mBLRvru47MHsCRjRMhnXzvC1PU/eV9ecnUgroUq0JxtvynmZCe6i0aBypj6Z0lYLRnxZNVzu3zCqG9QLSPjaCDUAtP8KcXduBKgRzO6iUjkulU+xZ5V4gwUDOZlWmDBARhoqU+ftr5tgeNtzfEjGPYl45tpHqJwIDAQABo30wezA5BggrBgEFBQcBAQQtMCswKQYIKwYBBQUHMAKGHWh0dHA6Ly9haWEuZXhhbXBsZS5jb20vY2EuY3J0MB0GA1UdDgQWBBSfyQdt2Dm7H2X9hbqviX6chZWcnTAfBgNVHSMEGDAWgBQIqn0zec92fEwPZOmyAkLYLdsH4jANBgkqhkiG9w0BAQsFAAOCAQEAE4jobY0anZWer6pdhsyErU6IJiPX7vULejPunPSlm8oxAxEJQhlEVEXnJMVwhSSH2LQg/UFm+X1XQBQHRGKTrBkr/HEXc2UvKToRsmvoCEBDJ8jhj0Gp4lRgdjeC6HV5QkdLimyWspgfzk8RqjzFS+bn7EAFVtqzOYGuw06sD/zJoPEYbFxoSisk+hKIHrKNnia9+POuGy/R5eQaCZvtlR2Llbyg9Rbu9tlHHhvjheRFPVJ7fTw7BAUsocV743F7VhZDvRL1wNbkyyoHBJHJP2VMG36jO7ot+ayIVLySi+/8Eu6HSplVQZv8FJ/i0XnVd7PltGknfC3EqUEUsZJZXg==",
	"base64",
);

const caDer = Buffer.from(
	"MIIDBTCCAe2gAwIBAgIUZhacLIKorLVprnvRRPTZ5gEJ6QQwDQYJKoZIhvcNAQELBQAwEjEQMA4GA1UEAwwHVGVzdCBDQTAeFw0yNjAzMjMxMjM1NTFaFw0zNjAzMjAxMjM1NTFaMBIxEDAOBgNVBAMMB1Rlc3QgQ0EwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDLkyOiN20a3Yb4Wpbtmja1Xt2WwPS5VgeWSQ9Q0uZ3m8zuY+3xSvlvs/K5JAQ0DXqBDTI1ss4hdRV/7ullfyALC3a+zXZNXiSoMiUawoKve6z3fJK/2tnVJ9tEjyVxf2byTaYiuNeQVTxi7hVXGxuZrs8igZc7qh4BhqlBC/xvMeKwIT5Z6HGR3SHJL3B7yOVRzbOboCJEm5m65AquQDIHfxqZG1P/YYWGQ9eSkmehmxvftBFHUUXj/wIS/0Iu2VS49b+XBUVCWh/SIhJjwE0svSXf3RP4HjUrix/+MT/ajzBDRCyeie/653mxdKaw7TCvJik4ORgbTOcM/V+dv9BzAgMBAAGjUzBRMB0GA1UdDgQWBBQIqn0zec92fEwPZOmyAkLYLdsH4jAfBgNVHSMEGDAWgBQIqn0zec92fEwPZOmyAkLYLdsH4jAPBgNVHRMBAf8EBTADAQH/MA0GCSqGSIb3DQEBCwUAA4IBAQDFrjo59rIk1npNO0qTFPiZmkKAtJ5tAh8JPewkGTAdeB5Hkw3gMHr4E3cgtvJydRS4Zj9PTw1bsdOHEnhjD4eT34oxyMZWbaZ8ZllsTdrbWxAA9/Ge4nxYBjblMzzkniKDAOmQFG7N4Zl5q7NxYoQN6Oy1m2LuLbUMPAtoXYShvkGz2ro6S/hxNSfaoIiK9fUO9uP8GtPwPlvOKRZzoaF3a1Eso1JIgEzrSrRu83NX27HJBrcOAHYoyutptOJsMwmObLf28zPVjoX2XEZh1T7SzXoY1cZxJ16RWyp/LKwkeASJKif+lxR96AKV0BPcvue8h+p9ND3iYA5G/+08csmU",
	"base64",
);

// ---------------------------------------------------------------------------
// parseHostname
// ---------------------------------------------------------------------------

describe("parseHostname", () => {
	it("bare host returns port 443", () => {
		const result = parseHostname("example.com");
		expect(result.host).toBe("example.com");
		expect(result.port).toBe(443);
	});

	it("host:port extracts port as a number", () => {
		const result = parseHostname("example.com:8443");
		expect(result.host).toBe("example.com");
		expect(result.port).toBe(8443);
	});

	it("https:// URL returns port 443", () => {
		const result = parseHostname("https://example.com/some/path");
		expect(result.host).toBe("example.com");
		expect(result.port).toBe(443);
	});

	it("https:// URL with custom port returns that port", () => {
		const result = parseHostname("https://example.com:9443/some/path");
		expect(result.host).toBe("example.com");
		expect(result.port).toBe(9443);
	});

	it("https:// URL strips trailing path", () => {
		const result = parseHostname("https://example.com/deep/nested/path");
		expect(result.host).toBe("example.com");
		// No path in host
		expect(result.host).not.toContain("/");
	});

	it("port from host:port is coerced to number type", () => {
		const result = parseHostname("example.com:8443");
		expect(typeof result.port).toBe("number");
	});
});

// ---------------------------------------------------------------------------
// parseAiaUrl
// ---------------------------------------------------------------------------

describe("parseAiaUrl", () => {
	it("returns the CA Issuers URI when present", () => {
		const infoAccess =
			"CA Issuers - URI:http://certs.example.com/intermediate.crt\nOCSP - URI:http://ocsp.example.com";
		const result = parseAiaUrl(infoAccess);
		expect(result).toBe("http://certs.example.com/intermediate.crt");
	});

	it("returns null when no CA Issuers URI is present", () => {
		const infoAccess = "OCSP - URI:http://ocsp.example.com";
		const result = parseAiaUrl(infoAccess);
		expect(result).toBeNull();
	});

	it("returns null for empty string", () => {
		const result = parseAiaUrl("");
		expect(result).toBeNull();
	});

	it("handles multiple AIA entries and returns first CA Issuers", () => {
		const infoAccess =
			"CA Issuers - URI:http://first.example.com/cert.crt\nCA Issuers - URI:http://second.example.com/cert.crt";
		const result = parseAiaUrl(infoAccess);
		expect(result).toBe("http://first.example.com/cert.crt");
	});

	it("returns null for OCSP-only AIA (no CA Issuers entry)", () => {
		const infoAccess =
			"OCSP - URI:http://ocsp.example.com\nOCSP - URI:http://ocsp2.example.com";
		const result = parseAiaUrl(infoAccess);
		expect(result).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// toPem
// ---------------------------------------------------------------------------

describe("toPem", () => {
	it("output starts with PEM header", () => {
		const buf = Buffer.alloc(64, 0xab);
		const result = toPem(buf);
		expect(result.startsWith("-----BEGIN CERTIFICATE-----\n")).toBe(true);
	});

	it("output ends with PEM footer", () => {
		const buf = Buffer.alloc(64, 0xab);
		const result = toPem(buf);
		expect(result.trimEnd().endsWith("-----END CERTIFICATE-----")).toBe(true);
	});

	it("base64 lines are at most 64 characters wide", () => {
		// 200 bytes of data → base64 lines should be wrapped at 64 chars
		const buf = Buffer.alloc(200, 0xcd);
		const result = toPem(buf);
		const lines = result.split("\n").filter((l) => l.length > 0);
		// Strip header and footer lines
		const contentLines = lines.filter(
			(l) =>
				l !== "-----BEGIN CERTIFICATE-----" &&
				l !== "-----END CERTIFICATE-----",
		);
		for (const line of contentLines) {
			expect(line.length).toBeLessThanOrEqual(64);
		}
	});

	it("content decodes back to the original buffer", () => {
		const buf = Buffer.from("Hello, SSL world!");
		const result = toPem(buf);
		const lines = result.split("\n").filter((l) => l.length > 0);
		const b64Content = lines
			.filter(
				(l) =>
					l !== "-----BEGIN CERTIFICATE-----" &&
					l !== "-----END CERTIFICATE-----",
			)
			.join("");
		const decoded = Buffer.from(b64Content, "base64");
		expect(decoded.equals(buf)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// certRoleLabel
// ---------------------------------------------------------------------------

describe("certRoleLabel", () => {
	it("leaf cert returns [site]", () => {
		expect(certRoleLabel(true, false)).toBe("[site]");
	});

	it("self-signed root cert returns [root]", () => {
		expect(certRoleLabel(false, true)).toBe("[root]");
	});

	it("intermediate cert (not leaf, not self-signed) returns empty string", () => {
		expect(certRoleLabel(false, false)).toBe("");
	});

	it("leaf that is also self-signed returns [site] (leaf takes priority)", () => {
		expect(certRoleLabel(true, true)).toBe("[site]");
	});
});

// ---------------------------------------------------------------------------
// fetchCertChain
// ---------------------------------------------------------------------------

describe("fetchCertChain", () => {
	it("single-cert chain (no AIA) is returned as one-element array", async () => {
		// selfSignedDer is self-signed with no AIA — chain stops immediately
		const deps = {
			connectTls: async (_host: string, _port: number) => selfSignedDer,
			fetchDer: async (_url: string, _signal: AbortSignal) => Buffer.alloc(0),
			mkdirSync: () => undefined,
			writeFile: async () => undefined,
		};
		const chain = await fetchCertChain("example.com", 443, deps);
		expect(chain).toHaveLength(1);
		expect(chain[0]?.cn).toBe("test.example.com");
		expect(chain[0]?.isLeaf).toBe(true);
		expect(chain[0]?.isSelfSigned).toBe(true);
	});

	it("single-cert chain is returned root-first (leaf only, so same position)", async () => {
		const deps = {
			connectTls: async (_host: string, _port: number) => selfSignedDer,
			fetchDer: async (_url: string, _signal: AbortSignal) => Buffer.alloc(0),
			mkdirSync: () => undefined,
			writeFile: async () => undefined,
		};
		const chain = await fetchCertChain("example.com", 443, deps);
		// Single cert chain: first element is the leaf (also self-signed root)
		expect(chain[0]?.isLeaf).toBe(true);
	});

	it("two-cert chain is correctly reversed to root-first order", async () => {
		// leafDer has AIA pointing to http://aia.example.com/ca.crt
		// fetchDer returns caDer (self-signed, no AIA) → chain stops
		const deps = {
			connectTls: async (_host: string, _port: number) => leafDer,
			fetchDer: async (_url: string, _signal: AbortSignal) => caDer,
			mkdirSync: () => undefined,
			writeFile: async () => undefined,
		};
		const chain = await fetchCertChain("leaf2.example.com", 443, deps);
		// Should be [root, leaf] in root-first order
		expect(chain).toHaveLength(2);
		expect(chain[0]?.cn).toBe("Test CA");
		expect(chain[0]?.isSelfSigned).toBe(true);
		expect(chain[0]?.isLeaf).toBe(false);
		expect(chain[1]?.cn).toBe("leaf2.example.com");
		expect(chain[1]?.isLeaf).toBe(true);
		expect(chain[1]?.isSelfSigned).toBe(false);
	});

	it("AIA walk stops at depth 10", async () => {
		// leafDer always has AIA, selfSignedDer does not (but we never return it)
		// We supply leafDer as both connectTls and fetchDer results so chain
		// never terminates via self-signed or no-AIA, only via depth limit.
		let fetchCount = 0;
		const deps = {
			connectTls: async (_host: string, _port: number) => leafDer,
			fetchDer: async (_url: string, _signal: AbortSignal) => {
				fetchCount++;
				return leafDer;
			},
			mkdirSync: () => undefined,
			writeFile: async () => undefined,
		};
		const chain = await fetchCertChain("example.com", 443, deps);
		// Initial leaf + 9 AIA fetches = 10 total
		expect(chain).toHaveLength(10);
		expect(fetchCount).toBe(9);
	});

	it("AIA walk stops when self-signed cert found", async () => {
		// connectTls → leafDer (has AIA), fetchDer → caDer (self-signed, no AIA)
		let fetchCount = 0;
		const deps = {
			connectTls: async (_host: string, _port: number) => leafDer,
			fetchDer: async (_url: string, _signal: AbortSignal) => {
				fetchCount++;
				return caDer;
			},
			mkdirSync: () => undefined,
			writeFile: async () => undefined,
		};
		await fetchCertChain("example.com", 443, deps);
		// Should stop after one AIA fetch (caDer is self-signed)
		expect(fetchCount).toBe(1);
	});

	it("AbortSignal.timeout is used for each AIA fetch", async () => {
		const signals: AbortSignal[] = [];
		const deps = {
			connectTls: async (_host: string, _port: number) => leafDer,
			fetchDer: async (_url: string, signal: AbortSignal) => {
				signals.push(signal);
				return caDer;
			},
			mkdirSync: () => undefined,
			writeFile: async () => undefined,
		};
		await fetchCertChain("example.com", 443, deps);
		expect(signals).toHaveLength(1);
		// The signal should be an AbortSignal (created by AbortSignal.timeout)
		expect(signals[0]).toBeInstanceOf(AbortSignal);
	});

	it("connectTls failure throws SslFetchError", async () => {
		const deps = {
			connectTls: async (_host: string, _port: number): Promise<Buffer> => {
				throw new Error("Connection refused");
			},
			fetchDer: async (_url: string, _signal: AbortSignal) => Buffer.alloc(0),
			mkdirSync: () => undefined,
			writeFile: async () => undefined,
		};
		await expect(
			fetchCertChain("example.com", 443, deps),
		).rejects.toBeInstanceOf(SslFetchError);
	});

	it("fetchDer failure throws SslFetchError", async () => {
		const deps = {
			connectTls: async (_host: string, _port: number) => leafDer,
			fetchDer: async (_url: string, _signal: AbortSignal): Promise<Buffer> => {
				throw new Error("HTTP 404");
			},
			mkdirSync: () => undefined,
			writeFile: async () => undefined,
		};
		await expect(
			fetchCertChain("example.com", 443, deps),
		).rejects.toBeInstanceOf(SslFetchError);
	});

	it("CertInfo includes der, cn, validTo, isLeaf, isSelfSigned fields", async () => {
		const deps = {
			connectTls: async (_host: string, _port: number) => selfSignedDer,
			fetchDer: async (_url: string, _signal: AbortSignal) => Buffer.alloc(0),
			mkdirSync: () => undefined,
			writeFile: async () => undefined,
		};
		const chain = await fetchCertChain("example.com", 443, deps);
		expect(chain).toHaveLength(1);
		const [cert] = chain;
		expect(cert?.der).toBeInstanceOf(Buffer);
		expect(typeof cert?.cn).toBe("string");
		expect(typeof cert?.validTo).toBe("string");
		expect(typeof cert?.isLeaf).toBe("boolean");
		expect(typeof cert?.isSelfSigned).toBe("boolean");
	});
});

// ---------------------------------------------------------------------------
// downloadCert
// ---------------------------------------------------------------------------

describe("downloadCert", () => {
	it("downloadCert PEM writes wrapped base64 string", async () => {
		let written: string | Buffer | undefined;
		const deps = {
			connectTls: async (_host: string, _port: number) => selfSignedDer,
			fetchDer: async (_url: string, _signal: AbortSignal) => Buffer.alloc(0),
			mkdirSync: () => undefined,
			writeFile: async (_path: string, data: string | Buffer) => {
				written = data;
			},
		};
		await downloadCert(selfSignedDer, "/some/path/cert.pem", "pem", deps);
		expect(typeof written).toBe("string");
		expect((written as string).startsWith("-----BEGIN CERTIFICATE-----")).toBe(
			true,
		);
	});

	it("downloadCert DER writes raw bytes Buffer", async () => {
		let written: string | Buffer | undefined;
		const deps = {
			connectTls: async (_host: string, _port: number) => selfSignedDer,
			fetchDer: async (_url: string, _signal: AbortSignal) => Buffer.alloc(0),
			mkdirSync: () => undefined,
			writeFile: async (_path: string, data: string | Buffer) => {
				written = data;
			},
		};
		await downloadCert(selfSignedDer, "/some/path/cert.der", "der", deps);
		expect(written).toBeInstanceOf(Buffer);
		expect((written as Buffer).equals(selfSignedDer)).toBe(true);
	});

	it("downloadCert creates parent directories", async () => {
		const mkdirCalls: Array<{
			path: string;
			opts: { recursive: boolean };
		}> = [];
		const deps = {
			connectTls: async (_host: string, _port: number) => selfSignedDer,
			fetchDer: async (_url: string, _signal: AbortSignal) => Buffer.alloc(0),
			mkdirSync: (path: string, opts: { recursive: boolean }) => {
				mkdirCalls.push({ path, opts });
			},
			writeFile: async () => undefined,
		};
		await downloadCert(selfSignedDer, "/some/deep/path/cert.pem", "pem", deps);
		expect(mkdirCalls).toHaveLength(1);
		expect(mkdirCalls[0]?.path).toBe("/some/deep/path");
		expect(mkdirCalls[0]?.opts.recursive).toBe(true);
	});

	it("downloadCert overwrites existing file (no error on second write)", async () => {
		let writeCount = 0;
		const deps = {
			connectTls: async (_host: string, _port: number) => selfSignedDer,
			fetchDer: async (_url: string, _signal: AbortSignal) => Buffer.alloc(0),
			mkdirSync: () => undefined,
			writeFile: async () => {
				writeCount++;
			},
		};
		await downloadCert(selfSignedDer, "/path/cert.pem", "pem", deps);
		await downloadCert(selfSignedDer, "/path/cert.pem", "pem", deps);
		expect(writeCount).toBe(2);
	});

	it("downloadCert writes to the provided download path", async () => {
		const writtenPaths: string[] = [];
		const deps = {
			connectTls: async (_host: string, _port: number) => selfSignedDer,
			fetchDer: async (_url: string, _signal: AbortSignal) => Buffer.alloc(0),
			mkdirSync: () => undefined,
			writeFile: async (path: string) => {
				writtenPaths.push(path);
			},
		};
		await downloadCert(selfSignedDer, "/custom/download/cert.pem", "pem", deps);
		expect(writtenPaths[0]).toBe("/custom/download/cert.pem");
	});
});
