// ---------------------------------------------------------------------------
// Input Collection Tests — String + Number + SSL-Cert
//
// Tests for `collectInputs` covering string, number, and ssl-cert input types.
// All deps are injected as fakes. No real @clack/prompts calls.
// TDD: tests were written before the implementation (RED → GREEN).
// ---------------------------------------------------------------------------

import { describe, expect, it } from "bun:test";
import type { InputDef, ScriptEntry, ScriptInputs } from "../manifest/types.js";
import type {
	InputCollectionDeps,
	SelectOpts,
	TextOpts,
} from "./inputCollection.js";
import { collectInputs } from "./inputCollection.js";
import type { CertInfo } from "./sslCert.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(
	overrides: Partial<ScriptEntry> & { id: string; name: string },
): ScriptEntry {
	return {
		description: "A test script",
		platform: "linux",
		arch: "x86",
		script: "script.sh",
		dependencies: [],
		optional_dependencies: [],
		requires_elevation: false,
		inputs: [],
		...overrides,
	};
}

function makeInput(overrides: Partial<InputDef> & { id: string }): InputDef {
	return {
		type: "string",
		label: "Some Label",
		...overrides,
	};
}

const CANCEL = Symbol("cancel");

function makeDeps(
	overrides: Partial<InputCollectionDeps> = {},
): InputCollectionDeps {
	return {
		text: async (_opts: TextOpts) => "default-value",
		isCancel: (val: unknown): val is symbol => val === CANCEL,
		cancel: (_hint?: string) => {},
		log: {
			error: (_msg: string) => {},
		},
		exit: (_code: number): never => {
			throw new Error(`exit:${_code}`);
		},
		select: async (_opts: SelectOpts) => 0,
		spinner: () => ({
			start: (_msg: string) => {},
			stop: (_msg: string) => {},
		}),
		fetchCertChain: async (_host: string, _port: number) => [],
		downloadCert: async (
			_certDer: Buffer,
			_path: string,
			_format: "pem" | "der",
		) => {},
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// No inputs in any script → returns empty Map
// ---------------------------------------------------------------------------

describe("collectInputs — no inputs", () => {
	it("returns empty Map when no scripts have inputs", async () => {
		const scripts = [makeEntry({ id: "a", name: "Alpha" })];
		const deps = makeDeps();
		const result = await collectInputs(scripts, deps);
		expect(result).toBeInstanceOf(Map);
		expect(result.size).toBe(0);
	});

	it("returns empty Map when script list is empty", async () => {
		const deps = makeDeps();
		const result = await collectInputs([], deps);
		expect(result).toBeInstanceOf(Map);
		expect(result.size).toBe(0);
	});

	it("does not call text when no scripts have inputs", async () => {
		let textCalled = false;
		const deps = makeDeps({
			text: async (_opts: TextOpts) => {
				textCalled = true;
				return "value";
			},
		});
		const scripts = [makeEntry({ id: "a", name: "Alpha" })];
		await collectInputs(scripts, deps);
		expect(textCalled).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// String input stored under input id
// ---------------------------------------------------------------------------

describe("collectInputs — string input", () => {
	it("stores string input under its id", async () => {
		const scripts = [
			makeEntry({
				id: "a",
				name: "Alpha",
				inputs: [makeInput({ id: "email", type: "string", label: "Email" })],
			}),
		];
		const deps = makeDeps({
			text: async (_opts: TextOpts) => "user@example.com",
		});
		const result = await collectInputs(scripts, deps);
		expect(result.get("email")).toEqual({ value: "user@example.com" });
	});

	it("stores CollectedInput with only value field (no certCN)", async () => {
		const scripts = [
			makeEntry({
				id: "a",
				name: "Alpha",
				inputs: [makeInput({ id: "host", type: "string", label: "Host" })],
			}),
		];
		const deps = makeDeps({
			text: async (_opts: TextOpts) => "example.com",
		});
		const result = await collectInputs(scripts, deps);
		const collected = result.get("host");
		expect(collected).toBeDefined();
		expect(collected?.value).toBe("example.com");
		expect(collected?.certCN).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Number input stored under input id
// ---------------------------------------------------------------------------

describe("collectInputs — number input", () => {
	it("stores number input under its id", async () => {
		const scripts = [
			makeEntry({
				id: "a",
				name: "Alpha",
				inputs: [makeInput({ id: "port", type: "number", label: "Port" })],
			}),
		];
		const deps = makeDeps({
			text: async (_opts: TextOpts) => "8080",
		});
		const result = await collectInputs(scripts, deps);
		expect(result.get("port")).toEqual({ value: "8080" });
	});
});

// ---------------------------------------------------------------------------
// Validation — required string
// ---------------------------------------------------------------------------

describe("collectInputs — required string validation", () => {
	it("validate returns error string for empty value when required", async () => {
		let capturedValidate: ((value: string) => string | undefined) | undefined;
		const scripts = [
			makeEntry({
				id: "a",
				name: "Alpha",
				inputs: [
					makeInput({
						id: "name",
						type: "string",
						label: "Name",
						required: true,
					}),
				],
			}),
		];
		const deps = makeDeps({
			text: async (opts: TextOpts) => {
				capturedValidate = opts.validate;
				return "some-value";
			},
		});
		await collectInputs(scripts, deps);
		expect(capturedValidate).toBeDefined();
		expect(capturedValidate?.("")).toBe("This field is required.");
	});

	it("validate returns error string for whitespace-only value when required", async () => {
		let capturedValidate: ((value: string) => string | undefined) | undefined;
		const scripts = [
			makeEntry({
				id: "a",
				name: "Alpha",
				inputs: [
					makeInput({
						id: "name",
						type: "string",
						label: "Name",
						required: true,
					}),
				],
			}),
		];
		const deps = makeDeps({
			text: async (opts: TextOpts) => {
				capturedValidate = opts.validate;
				return "some-value";
			},
		});
		await collectInputs(scripts, deps);
		expect(capturedValidate?.("   ")).toBe("This field is required.");
	});

	it("validate returns undefined for non-empty required string", async () => {
		let capturedValidate: ((value: string) => string | undefined) | undefined;
		const scripts = [
			makeEntry({
				id: "a",
				name: "Alpha",
				inputs: [
					makeInput({
						id: "name",
						type: "string",
						label: "Name",
						required: true,
					}),
				],
			}),
		];
		const deps = makeDeps({
			text: async (opts: TextOpts) => {
				capturedValidate = opts.validate;
				return "hello";
			},
		});
		await collectInputs(scripts, deps);
		expect(capturedValidate?.("hello")).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Validation — optional string accepts empty
// ---------------------------------------------------------------------------

describe("collectInputs — optional string accepts empty", () => {
	it("validate returns undefined for empty optional string", async () => {
		let capturedValidate: ((value: string) => string | undefined) | undefined;
		const scripts = [
			makeEntry({
				id: "a",
				name: "Alpha",
				inputs: [
					makeInput({
						id: "opt",
						type: "string",
						label: "Option",
						required: false,
					}),
				],
			}),
		];
		const deps = makeDeps({
			text: async (opts: TextOpts) => {
				capturedValidate = opts.validate;
				return "";
			},
		});
		await collectInputs(scripts, deps);
		expect(capturedValidate?.("")).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Validation — number input
// ---------------------------------------------------------------------------

describe("collectInputs — number validation", () => {
	it("validate returns error string for non-numeric non-empty input", async () => {
		let capturedValidate: ((value: string) => string | undefined) | undefined;
		const scripts = [
			makeEntry({
				id: "a",
				name: "Alpha",
				inputs: [makeInput({ id: "port", type: "number", label: "Port" })],
			}),
		];
		const deps = makeDeps({
			text: async (opts: TextOpts) => {
				capturedValidate = opts.validate;
				return "8080";
			},
		});
		await collectInputs(scripts, deps);
		expect(capturedValidate?.("abc")).toBe("Please enter a valid number.");
	});

	it("validate accepts integer", async () => {
		let capturedValidate: ((value: string) => string | undefined) | undefined;
		const scripts = [
			makeEntry({
				id: "a",
				name: "Alpha",
				inputs: [makeInput({ id: "port", type: "number", label: "Port" })],
			}),
		];
		const deps = makeDeps({
			text: async (opts: TextOpts) => {
				capturedValidate = opts.validate;
				return "8080";
			},
		});
		await collectInputs(scripts, deps);
		expect(capturedValidate?.("8080")).toBeUndefined();
	});

	it("validate accepts float", async () => {
		let capturedValidate: ((value: string) => string | undefined) | undefined;
		const scripts = [
			makeEntry({
				id: "a",
				name: "Alpha",
				inputs: [makeInput({ id: "rate", type: "number", label: "Rate" })],
			}),
		];
		const deps = makeDeps({
			text: async (opts: TextOpts) => {
				capturedValidate = opts.validate;
				return "3.14";
			},
		});
		await collectInputs(scripts, deps);
		expect(capturedValidate?.("3.14")).toBeUndefined();
	});

	it("validate accepts negative number", async () => {
		let capturedValidate: ((value: string) => string | undefined) | undefined;
		const scripts = [
			makeEntry({
				id: "a",
				name: "Alpha",
				inputs: [makeInput({ id: "offset", type: "number", label: "Offset" })],
			}),
		];
		const deps = makeDeps({
			text: async (opts: TextOpts) => {
				capturedValidate = opts.validate;
				return "-5";
			},
		});
		await collectInputs(scripts, deps);
		expect(capturedValidate?.("-5")).toBeUndefined();
	});

	it("validate accepts empty value for optional number", async () => {
		let capturedValidate: ((value: string) => string | undefined) | undefined;
		const scripts = [
			makeEntry({
				id: "a",
				name: "Alpha",
				inputs: [
					makeInput({
						id: "port",
						type: "number",
						label: "Port",
						required: false,
					}),
				],
			}),
		];
		const deps = makeDeps({
			text: async (opts: TextOpts) => {
				capturedValidate = opts.validate;
				return "";
			},
		});
		await collectInputs(scripts, deps);
		expect(capturedValidate?.("")).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Default value passed as initialValue
// ---------------------------------------------------------------------------

describe("collectInputs — default value", () => {
	it("passes input default as initialValue to text", async () => {
		let capturedInitialValue: string | undefined;
		const scripts = [
			makeEntry({
				id: "a",
				name: "Alpha",
				inputs: [
					makeInput({
						id: "host",
						type: "string",
						label: "Host",
						default: "localhost",
					}),
				],
			}),
		];
		const deps = makeDeps({
			text: async (opts: TextOpts) => {
				capturedInitialValue = opts.initialValue;
				return "localhost";
			},
		});
		await collectInputs(scripts, deps);
		expect(capturedInitialValue).toBe("localhost");
	});

	it("passes empty string as initialValue when no default", async () => {
		let capturedInitialValue: string | undefined;
		const scripts = [
			makeEntry({
				id: "a",
				name: "Alpha",
				inputs: [makeInput({ id: "host", type: "string", label: "Host" })],
			}),
		];
		const deps = makeDeps({
			text: async (opts: TextOpts) => {
				capturedInitialValue = opts.initialValue;
				return "value";
			},
		});
		await collectInputs(scripts, deps);
		expect(capturedInitialValue).toBe("");
	});
});

// ---------------------------------------------------------------------------
// Script name included in prompt message
// ---------------------------------------------------------------------------

describe("collectInputs — prompt message", () => {
	it("includes script name in the prompt message", async () => {
		let capturedMessage: string | undefined;
		const scripts = [
			makeEntry({
				id: "a",
				name: "Install Nginx",
				inputs: [makeInput({ id: "port", type: "string", label: "Port" })],
			}),
		];
		const deps = makeDeps({
			text: async (opts: TextOpts) => {
				capturedMessage = opts.message;
				return "80";
			},
		});
		await collectInputs(scripts, deps);
		expect(capturedMessage).toContain("Install Nginx");
	});

	it("includes input label in the prompt message", async () => {
		let capturedMessage: string | undefined;
		const scripts = [
			makeEntry({
				id: "a",
				name: "Alpha",
				inputs: [
					makeInput({ id: "port", type: "string", label: "Server Port" }),
				],
			}),
		];
		const deps = makeDeps({
			text: async (opts: TextOpts) => {
				capturedMessage = opts.message;
				return "80";
			},
		});
		await collectInputs(scripts, deps);
		expect(capturedMessage).toContain("Server Port");
	});

	it("script name is dimmed in the prompt message", async () => {
		let capturedMessage: string | undefined;
		const scripts = [
			makeEntry({
				id: "a",
				name: "Alpha",
				inputs: [makeInput({ id: "port", type: "string", label: "Port" })],
			}),
		];
		const deps = makeDeps({
			text: async (opts: TextOpts) => {
				capturedMessage = opts.message;
				return "80";
			},
		});
		await collectInputs(scripts, deps);
		expect(capturedMessage).toContain("\x1b[2mAlpha\x1b[0m");
	});
});

// ---------------------------------------------------------------------------
// Cancel symbol on text → immediate exit (no confirmation dialog)
// ---------------------------------------------------------------------------

describe("collectInputs — cancel behavior", () => {
	it("cancel on text → cancel() called with 'User canceled.' hint", async () => {
		let capturedHint: string | undefined;
		const scripts = [
			makeEntry({
				id: "a",
				name: "Alpha",
				inputs: [makeInput({ id: "val", type: "string", label: "Value" })],
			}),
		];
		const deps = makeDeps({
			text: async (_opts: TextOpts) => CANCEL,
			cancel: (hint?: string) => {
				capturedHint = hint;
			},
			exit: (_code: number): never => {
				throw new Error("exit");
			},
		});
		try {
			await collectInputs(scripts, deps);
		} catch (_) {}
		expect(capturedHint).toContain("canceled");
	});

	it("cancel on text → exit(0) called immediately (no re-prompt)", async () => {
		let textCallCount = 0;
		let exitCode: number | undefined;
		const scripts = [
			makeEntry({
				id: "a",
				name: "Alpha",
				inputs: [makeInput({ id: "val", type: "string", label: "Value" })],
			}),
		];
		const deps = makeDeps({
			text: async (_opts: TextOpts) => {
				textCallCount++;
				return CANCEL;
			},
			exit: (code: number): never => {
				exitCode = code;
				throw new Error(`exit:${code}`);
			},
		});
		try {
			await collectInputs(scripts, deps);
		} catch (err) {
			if (!(err as Error).message.startsWith("exit:")) throw err;
		}
		expect(textCallCount).toBe(1);
		expect(exitCode).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// Inputs from multiple scripts collected in queue order
// ---------------------------------------------------------------------------

describe("collectInputs — multiple scripts", () => {
	it("collects inputs from multiple scripts in order", async () => {
		const responses = ["alpha-host", "beta-port"];
		let callIdx = 0;
		const scripts = [
			makeEntry({
				id: "a",
				name: "Alpha",
				inputs: [makeInput({ id: "host", type: "string", label: "Host" })],
			}),
			makeEntry({
				id: "b",
				name: "Beta",
				inputs: [makeInput({ id: "port", type: "number", label: "Port" })],
			}),
		];
		const deps = makeDeps({
			text: async (_opts: TextOpts) => responses[callIdx++] ?? "fallback",
		});
		const result = await collectInputs(scripts, deps);
		expect(result.get("host")).toEqual({ value: "alpha-host" });
		expect(result.get("port")).toEqual({ value: "beta-port" });
	});

	it("processes inputs from different scripts in queue order (script A inputs first, then script B)", async () => {
		const capturedMessages: string[] = [];
		const scripts = [
			makeEntry({
				id: "a",
				name: "First Script",
				inputs: [makeInput({ id: "a1", type: "string", label: "Alpha Input" })],
			}),
			makeEntry({
				id: "b",
				name: "Second Script",
				inputs: [makeInput({ id: "b1", type: "string", label: "Beta Input" })],
			}),
		];
		const deps = makeDeps({
			text: async (opts: TextOpts) => {
				capturedMessages.push(opts.message);
				return "value";
			},
		});
		await collectInputs(scripts, deps);
		// First message should reference First Script, second Beta Input
		expect(capturedMessages[0]).toContain("First Script");
		expect(capturedMessages[1]).toContain("Second Script");
	});

	it("each script's inputs are prompted in definition order", async () => {
		const capturedMessages: string[] = [];
		const scripts = [
			makeEntry({
				id: "a",
				name: "Alpha",
				inputs: [
					makeInput({ id: "first", type: "string", label: "First Input" }),
					makeInput({ id: "second", type: "string", label: "Second Input" }),
				],
			}),
		];
		const deps = makeDeps({
			text: async (opts: TextOpts) => {
				capturedMessages.push(opts.message);
				return "value";
			},
		});
		await collectInputs(scripts, deps);
		expect(capturedMessages[0]).toContain("First Input");
		expect(capturedMessages[1]).toContain("Second Input");
	});
});

// ---------------------------------------------------------------------------
// ssl-cert inputs — full four-step flow (Task 7)
// ---------------------------------------------------------------------------

/** Helper: create a minimal CertInfo object. */
function makeCertInfo(overrides: Partial<CertInfo> & { cn: string }): CertInfo {
	return {
		der: Buffer.from("fake-der"),
		validTo: "Jan 1 00:00:00 2030 GMT",
		isLeaf: false,
		isSelfSigned: false,
		...overrides,
	};
}

describe("collectInputs — ssl-cert: successful flow", () => {
	it("stores download_path as value and cert CN as certCN on success", async () => {
		const chain: CertInfo[] = [
			makeCertInfo({ cn: "Root CA", isSelfSigned: true }),
			makeCertInfo({ cn: "example.com", isLeaf: true }),
		];
		const scripts = [
			makeEntry({
				id: "a",
				name: "Alpha",
				inputs: [
					makeInput({
						id: "cert",
						type: "ssl-cert",
						label: "Certificate",
						download_path: "/tmp/certs/example.pem",
						format: "pem",
					}),
				],
			}),
		];
		const deps = makeDeps({
			text: async (_opts: TextOpts) => "example.com",
			fetchCertChain: async (_host: string, _port: number) => chain,
			select: async (_opts: SelectOpts) => 1, // select leaf (index 1)
			downloadCert: async () => {},
		});
		const result = await collectInputs(scripts, deps);
		const collected = result.get("cert");
		expect(collected?.value).toBe("/tmp/certs/example.pem");
		expect(collected?.certCN).toBe("example.com");
	});

	it("select options use root-first order from fetchCertChain", async () => {
		const chain: CertInfo[] = [
			makeCertInfo({ cn: "Root CA", isSelfSigned: true }),
			makeCertInfo({ cn: "Intermediate CA" }),
			makeCertInfo({ cn: "leaf.example.com", isLeaf: true }),
		];
		let capturedOpts: SelectOpts | undefined;
		const scripts = [
			makeEntry({
				id: "a",
				name: "Alpha",
				inputs: [
					makeInput({
						id: "cert",
						type: "ssl-cert",
						label: "Cert",
						download_path: "/tmp/leaf.pem",
					}),
				],
			}),
		];
		const deps = makeDeps({
			text: async (_opts: TextOpts) => "example.com",
			fetchCertChain: async () => chain,
			select: async (opts: SelectOpts) => {
				capturedOpts = opts;
				return 0;
			},
			downloadCert: async () => {},
		});
		await collectInputs(scripts, deps);
		expect(capturedOpts?.options.length).toBe(3);
		// first option is root (index 0 = chain[0])
		expect(capturedOpts?.options[0]?.label).toContain("Root CA");
	});

	it("select option label includes role label and CN", async () => {
		const chain: CertInfo[] = [
			makeCertInfo({ cn: "Root CA", isSelfSigned: true }),
			makeCertInfo({ cn: "site.example.com", isLeaf: true }),
		];
		let capturedOpts: SelectOpts | undefined;
		const scripts = [
			makeEntry({
				id: "a",
				name: "Alpha",
				inputs: [
					makeInput({
						id: "cert",
						type: "ssl-cert",
						label: "Cert",
						download_path: "/tmp/site.pem",
					}),
				],
			}),
		];
		const deps = makeDeps({
			text: async (_opts: TextOpts) => "example.com",
			fetchCertChain: async () => chain,
			select: async (opts: SelectOpts) => {
				capturedOpts = opts;
				return 0;
			},
			downloadCert: async () => {},
		});
		await collectInputs(scripts, deps);
		// Root option should contain [root] and CN
		expect(capturedOpts?.options[0]?.label).toContain("[root]");
		expect(capturedOpts?.options[0]?.label).toContain("Root CA");
		// Leaf option should contain [site] and CN
		expect(capturedOpts?.options[1]?.label).toContain("[site]");
		expect(capturedOpts?.options[1]?.label).toContain("site.example.com");
	});

	it("single-cert chain still shows select prompt", async () => {
		const chain: CertInfo[] = [
			makeCertInfo({
				cn: "only.example.com",
				isLeaf: true,
				isSelfSigned: false,
			}),
		];
		let selectCalled = false;
		const scripts = [
			makeEntry({
				id: "a",
				name: "Alpha",
				inputs: [
					makeInput({
						id: "cert",
						type: "ssl-cert",
						label: "Cert",
						download_path: "/tmp/only.pem",
					}),
				],
			}),
		];
		const deps = makeDeps({
			text: async (_opts: TextOpts) => "only.example.com",
			fetchCertChain: async () => chain,
			select: async (_opts: SelectOpts) => {
				selectCalled = true;
				return 0;
			},
			downloadCert: async () => {},
		});
		await collectInputs(scripts, deps);
		expect(selectCalled).toBe(true);
	});

	it("cert downloaded with format from inputDef (pem)", async () => {
		const chain: CertInfo[] = [
			makeCertInfo({ cn: "example.com", isLeaf: true }),
		];
		let capturedFormat: "pem" | "der" | undefined;
		const scripts = [
			makeEntry({
				id: "a",
				name: "Alpha",
				inputs: [
					makeInput({
						id: "cert",
						type: "ssl-cert",
						label: "Cert",
						download_path: "/tmp/cert.pem",
						format: "pem",
					}),
				],
			}),
		];
		const deps = makeDeps({
			text: async (_opts: TextOpts) => "example.com",
			fetchCertChain: async () => chain,
			select: async (_opts: SelectOpts) => 0,
			downloadCert: async (_der, _path, format) => {
				capturedFormat = format;
			},
		});
		await collectInputs(scripts, deps);
		expect(capturedFormat).toBe("pem");
	});

	it("cert downloaded with format from inputDef (der)", async () => {
		const chain: CertInfo[] = [
			makeCertInfo({ cn: "example.com", isLeaf: true }),
		];
		let capturedFormat: "pem" | "der" | undefined;
		const scripts = [
			makeEntry({
				id: "a",
				name: "Alpha",
				inputs: [
					makeInput({
						id: "cert",
						type: "ssl-cert",
						label: "Cert",
						download_path: "/tmp/cert.der",
						format: "der",
					}),
				],
			}),
		];
		const deps = makeDeps({
			text: async (_opts: TextOpts) => "example.com",
			fetchCertChain: async () => chain,
			select: async (_opts: SelectOpts) => 0,
			downloadCert: async (_der, _path, format) => {
				capturedFormat = format;
			},
		});
		await collectInputs(scripts, deps);
		expect(capturedFormat).toBe("der");
	});

	it("cert downloaded with format defaulting to pem when absent", async () => {
		const chain: CertInfo[] = [
			makeCertInfo({ cn: "example.com", isLeaf: true }),
		];
		let capturedFormat: "pem" | "der" | undefined;
		const scripts = [
			makeEntry({
				id: "a",
				name: "Alpha",
				inputs: [
					makeInput({
						id: "cert",
						type: "ssl-cert",
						label: "Cert",
						download_path: "/tmp/cert.pem",
						// format deliberately absent
					}),
				],
			}),
		];
		const deps = makeDeps({
			text: async (_opts: TextOpts) => "example.com",
			fetchCertChain: async () => chain,
			select: async (_opts: SelectOpts) => 0,
			downloadCert: async (_der, _path, format) => {
				capturedFormat = format;
			},
		});
		await collectInputs(scripts, deps);
		expect(capturedFormat).toBe("pem");
	});
});

describe("collectInputs — ssl-cert: fetchCertChain error loops back to URL entry", () => {
	it("fetchCertChain error calls log.error and loops back to Step 1 (text shown again)", async () => {
		const chain: CertInfo[] = [
			makeCertInfo({ cn: "example.com", isLeaf: true }),
		];
		let textCallCount = 0;
		let logErrorMsg: string | undefined;
		const { SslFetchError } = await import("./sslCert.js");

		const scripts = [
			makeEntry({
				id: "a",
				name: "Alpha",
				inputs: [
					makeInput({
						id: "cert",
						type: "ssl-cert",
						label: "Cert",
						download_path: "/tmp/cert.pem",
					}),
				],
			}),
		];
		let fetchCount = 0;
		const deps = makeDeps({
			text: async (_opts: TextOpts) => {
				textCallCount++;
				return "example.com";
			},
			fetchCertChain: async () => {
				fetchCount++;
				if (fetchCount === 1) throw new SslFetchError("TLS connect failed");
				return chain;
			},
			select: async (_opts: SelectOpts) => 0,
			downloadCert: async () => {},
			log: {
				error: (msg: string) => {
					logErrorMsg = msg;
				},
			},
		});
		await collectInputs(scripts, deps);
		// text should have been called twice (once for failed fetch, once for success)
		expect(textCallCount).toBe(2);
		expect(logErrorMsg).toContain("TLS connect failed");
	});
});

describe("collectInputs — ssl-cert: download error loops back to cert selection", () => {
	it("download error calls log.error and loops back to Step 3 (select shown again)", async () => {
		const chain: CertInfo[] = [
			makeCertInfo({ cn: "example.com", isLeaf: true }),
		];
		let selectCallCount = 0;
		let logErrorMsg: string | undefined;

		const scripts = [
			makeEntry({
				id: "a",
				name: "Alpha",
				inputs: [
					makeInput({
						id: "cert",
						type: "ssl-cert",
						label: "Cert",
						download_path: "/tmp/cert.pem",
					}),
				],
			}),
		];
		let downloadCount = 0;
		const deps = makeDeps({
			text: async (_opts: TextOpts) => "example.com",
			fetchCertChain: async () => chain,
			select: async (_opts: SelectOpts) => {
				selectCallCount++;
				return 0;
			},
			downloadCert: async () => {
				downloadCount++;
				if (downloadCount === 1) throw new Error("Disk full");
			},
			log: {
				error: (msg: string) => {
					logErrorMsg = msg;
				},
			},
		});
		await collectInputs(scripts, deps);
		// select should have been called twice
		expect(selectCallCount).toBe(2);
		expect(logErrorMsg).toContain("Disk full");
	});
});

describe("collectInputs — ssl-cert: cancel during ssl steps", () => {
	it("select cancel → cancel() called and exit(0) called immediately", async () => {
		const chain: CertInfo[] = [
			makeCertInfo({ cn: "example.com", isLeaf: true }),
		];
		let cancelCalled = false;
		let exitCode: number | undefined;

		const scripts = [
			makeEntry({
				id: "a",
				name: "Alpha",
				inputs: [
					makeInput({
						id: "cert",
						type: "ssl-cert",
						label: "Cert",
						download_path: "/tmp/cert.pem",
					}),
				],
			}),
		];
		const deps = makeDeps({
			text: async (_opts: TextOpts) => "example.com",
			fetchCertChain: async () => chain,
			select: async (_opts: SelectOpts) => CANCEL,
			cancel: (_hint?: string) => {
				cancelCalled = true;
			},
			exit: (code: number): never => {
				exitCode = code;
				throw new Error(`exit:${code}`);
			},
		});
		try {
			await collectInputs(scripts, deps);
		} catch (err) {
			if (!(err as Error).message.startsWith("exit:")) throw err;
		}
		expect(cancelCalled).toBe(true);
		expect(exitCode).toBe(0);
	});

	it("ssl-cert step 1 cancel → cancel() called and exit(0) called immediately", async () => {
		let cancelCalled = false;
		let exitCode: number | undefined;

		const scripts = [
			makeEntry({
				id: "a",
				name: "Alpha",
				inputs: [
					makeInput({
						id: "cert",
						type: "ssl-cert",
						label: "Cert",
						download_path: "/tmp/cert.pem",
					}),
				],
			}),
		];
		const deps = makeDeps({
			text: async (_opts: TextOpts) => CANCEL,
			cancel: (_hint?: string) => {
				cancelCalled = true;
			},
			exit: (code: number): never => {
				exitCode = code;
				throw new Error(`exit:${code}`);
			},
		});
		try {
			await collectInputs(scripts, deps);
		} catch (err) {
			if (!(err as Error).message.startsWith("exit:")) throw err;
		}
		expect(cancelCalled).toBe(true);
		expect(exitCode).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// Input deduplication — same ID across multiple scripts asked only once
// ---------------------------------------------------------------------------

describe("collectInputs — input deduplication", () => {
	it("same input ID across two scripts → text prompted only once", async () => {
		let textCallCount = 0;
		const scripts = [
			makeEntry({
				id: "a",
				name: "Alpha",
				inputs: [makeInput({ id: "shared", type: "string", label: "Shared" })],
			}),
			makeEntry({
				id: "b",
				name: "Beta",
				inputs: [makeInput({ id: "shared", type: "string", label: "Shared" })],
			}),
		];
		const deps = makeDeps({
			text: async (_opts: TextOpts) => {
				textCallCount++;
				return "shared-value";
			},
		});
		await collectInputs(scripts, deps);
		expect(textCallCount).toBe(1);
	});

	it("deduplicated input is stored once in the result map", async () => {
		const scripts = [
			makeEntry({
				id: "a",
				name: "Alpha",
				inputs: [makeInput({ id: "shared", type: "string", label: "Shared" })],
			}),
			makeEntry({
				id: "b",
				name: "Beta",
				inputs: [makeInput({ id: "shared", type: "string", label: "Shared" })],
			}),
		];
		const deps = makeDeps({
			text: async (_opts: TextOpts) => "shared-value",
		});
		const result = await collectInputs(scripts, deps);
		expect(result.get("shared")).toEqual({ value: "shared-value" });
		expect(result.size).toBe(1);
	});

	it("unique inputs are still collected alongside shared ones", async () => {
		let textCallCount = 0;
		const scripts = [
			makeEntry({
				id: "a",
				name: "Alpha",
				inputs: [
					makeInput({ id: "shared", type: "string", label: "Shared" }),
					makeInput({ id: "alpha-only", type: "string", label: "Alpha Only" }),
				],
			}),
			makeEntry({
				id: "b",
				name: "Beta",
				inputs: [
					makeInput({ id: "shared", type: "string", label: "Shared" }),
					makeInput({ id: "beta-only", type: "string", label: "Beta Only" }),
				],
			}),
		];
		const deps = makeDeps({
			text: async (_opts: TextOpts) => {
				textCallCount++;
				return `value-${textCallCount}`;
			},
		});
		const result = await collectInputs(scripts, deps);
		// shared asked once, alpha-only once, beta-only once = 3 total
		expect(textCallCount).toBe(3);
		expect(result.size).toBe(3);
		expect(result.has("shared")).toBe(true);
		expect(result.has("alpha-only")).toBe(true);
		expect(result.has("beta-only")).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// ScriptInputs type check — result is Map<string, CollectedInput>
// ---------------------------------------------------------------------------

describe("collectInputs — return type", () => {
	it("returns a Map instance", async () => {
		const scripts = [
			makeEntry({
				id: "a",
				name: "Alpha",
				inputs: [makeInput({ id: "val", type: "string", label: "Value" })],
			}),
		];
		const deps = makeDeps({
			text: async (_opts: TextOpts) => "hello",
		});
		const result: ScriptInputs = await collectInputs(scripts, deps);
		expect(result).toBeInstanceOf(Map);
	});
});
