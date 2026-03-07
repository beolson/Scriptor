import { z } from "zod";

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

export const StringInputDefSchema = z.object({
	id: z.string(),
	type: z.literal("string"),
	label: z.string(),
	required: z.boolean().default(false),
	default: z.string().optional(),
});

export const NumberInputDefSchema = z.object({
	id: z.string(),
	type: z.literal("number"),
	label: z.string(),
	required: z.boolean().default(false),
	default: z.number().optional(),
});

export const SslCertInputDefSchema = z.object({
	id: z.string(),
	type: z.literal("ssl-cert"),
	label: z.string(),
	required: z.boolean().default(false),
	download_path: z.string(),
	format: z.enum(["PEM", "DER"]),
});

export const InputDefSchema = z.discriminatedUnion("type", [
	StringInputDefSchema,
	NumberInputDefSchema,
	SslCertInputDefSchema,
]);

export const InputDefArraySchema = z.array(InputDefSchema);

// ─── TypeScript Types ─────────────────────────────────────────────────────────

export type StringInputDef = z.infer<typeof StringInputDefSchema>;
export type NumberInputDef = z.infer<typeof NumberInputDefSchema>;
export type SslCertInputDef = z.infer<typeof SslCertInputDefSchema>;
export type InputDef = z.infer<typeof InputDefSchema>;

export type CollectedInput = {
	id: string;
	label: string;
	value: string;
	/**
	 * For `ssl-cert` inputs: the Common Name (CN) of the selected certificate.
	 * Used by the confirmation screen to display the cert subject alongside the
	 * download path (FR-3-041).
	 */
	certCN?: string;
};

/** Map from scriptId to the list of collected inputs for that script. */
export type ScriptInputs = Map<string, CollectedInput[]>;
