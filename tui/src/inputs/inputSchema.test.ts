import { describe, expect, test } from "bun:test";
import { InputDefArraySchema, InputDefSchema } from "./inputSchema";

describe("InputDefSchema — string", () => {
	test("valid string input def parses correctly", () => {
		const result = InputDefSchema.safeParse({
			id: "username",
			type: "string",
			label: "GitHub Username",
			required: true,
			default: "octocat",
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.type).toBe("string");
			expect(result.data.id).toBe("username");
			expect(result.data.label).toBe("GitHub Username");
		}
	});

	test("required defaults to false when omitted", () => {
		const result = InputDefSchema.safeParse({
			id: "username",
			type: "string",
			label: "GitHub Username",
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.required).toBe(false);
		}
	});
});

describe("InputDefSchema — number", () => {
	test("valid number input def parses correctly", () => {
		const result = InputDefSchema.safeParse({
			id: "port",
			type: "number",
			label: "Port Number",
			required: true,
			default: 8080,
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.type).toBe("number");
			expect(result.data.id).toBe("port");
		}
	});
});

describe("InputDefSchema — ssl-cert", () => {
	test("valid ssl-cert input def parses with download_path and format", () => {
		const result = InputDefSchema.safeParse({
			id: "cert",
			type: "ssl-cert",
			label: "Server Certificate",
			download_path: "/tmp/cert.pem",
			format: "PEM",
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.type).toBe("ssl-cert");
			// biome-ignore lint/suspicious/noExplicitAny: narrowing discriminated union in test
			const d = result.data as any;
			expect(d.download_path).toBe("/tmp/cert.pem");
			expect(d.format).toBe("PEM");
		}
	});

	test("ssl-cert missing download_path fails Zod parse", () => {
		const result = InputDefSchema.safeParse({
			id: "cert",
			type: "ssl-cert",
			label: "Server Certificate",
			format: "PEM",
		});
		expect(result.success).toBe(false);
	});
});

describe("InputDefSchema — invalid cases", () => {
	test("input def with unknown type fails Zod parse", () => {
		const result = InputDefSchema.safeParse({
			id: "foo",
			type: "unknown-type",
			label: "Something",
		});
		expect(result.success).toBe(false);
	});
});

describe("InputDefArraySchema", () => {
	test("parses an array of mixed valid input defs", () => {
		const result = InputDefArraySchema.safeParse([
			{ id: "name", type: "string", label: "Name" },
			{ id: "count", type: "number", label: "Count" },
			{
				id: "cert",
				type: "ssl-cert",
				label: "Cert",
				download_path: "/tmp/c.pem",
				format: "DER",
			},
		]);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toHaveLength(3);
		}
	});
});
