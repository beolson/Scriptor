import { describe, expect, test } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CertInfo } from "./certFetcher";
import { CertFetchError, downloadCert, MockCertFetcher } from "./certFetcher";

const fakeCert: CertInfo = {
	subject: "CN=example.com",
	issuer: "CN=Example CA",
	expiresAt: new Date("2030-01-01T00:00:00Z"),
	rawDer: new Uint8Array([
		// Minimal DER-encoded certificate (just a non-empty buffer for testing)
		0x30, 0x82, 0x01, 0x00,
	]),
};

describe("MockCertFetcher", () => {
	test("returns the preset cert array", async () => {
		const fetcher = new MockCertFetcher([fakeCert]);
		const result = await fetcher.fetchChain("example.com", 443);
		expect(result).toHaveLength(1);
		expect(result[0].subject).toBe("CN=example.com");
		expect(result[0].issuer).toBe("CN=Example CA");
		expect(result[0].expiresAt).toEqual(new Date("2030-01-01T00:00:00Z"));
	});

	test("configured to throw produces a CertFetchError when called", async () => {
		const fetcher = new MockCertFetcher([], {
			shouldThrow: true,
			message: "connection refused",
		});
		await expect(
			fetcher.fetchChain("badhost.example", 443),
		).rejects.toBeInstanceOf(CertFetchError);
	});
});

describe("downloadCert", () => {
	test("writes a PEM file and it starts with -----BEGIN CERTIFICATE-----", async () => {
		// Build a minimal valid DER cert to convert to PEM
		// We use a real-looking DER blob (just the header bytes) padded for base64
		// For testing, we'll use a known short DER payload
		const derBytes = new Uint8Array([0x30, 0x03, 0x01, 0x01, 0xff]);
		const cert: CertInfo = { ...fakeCert, rawDer: derBytes };
		const outPath = join(tmpdir(), `scriptor-test-${Date.now()}.pem`);
		await downloadCert(cert, outPath, "PEM");
		const content = await Bun.file(outPath).text();
		expect(content.startsWith("-----BEGIN CERTIFICATE-----")).toBe(true);
	});

	test("writes a DER file and it is non-empty binary", async () => {
		const derBytes = new Uint8Array([0x30, 0x03, 0x01, 0x01, 0xff]);
		const cert: CertInfo = { ...fakeCert, rawDer: derBytes };
		const outPath = join(tmpdir(), `scriptor-test-${Date.now()}.der`);
		await downloadCert(cert, outPath, "DER");
		const buf = await Bun.file(outPath).arrayBuffer();
		expect(buf.byteLength).toBeGreaterThan(0);
	});
});
