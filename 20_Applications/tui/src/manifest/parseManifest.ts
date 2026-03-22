// ---------------------------------------------------------------------------
// Manifest Parser
//
// Parses a raw YAML string into a validated Manifest array.
// All fatal errors call deps.log.error then deps.exit(1).
// ---------------------------------------------------------------------------

import * as jsYaml from "js-yaml";
import { z } from "zod";
import type { Manifest } from "./types.js";

// ---------------------------------------------------------------------------
// Injectable deps
// ---------------------------------------------------------------------------

export interface ParseManifestDeps {
	log: {
		error: (message: string) => void;
	};
	exit: (code: number) => never;
}

const defaultDeps: ParseManifestDeps = {
	log: {
		error: (msg) => {
			console.error(msg);
		},
	},
	exit: (code) => process.exit(code),
};

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const InputDefSchema = z
	.object({
		id: z.string(),
		type: z.enum(["string", "number", "ssl-cert"]),
		label: z.string(),
		required: z.boolean().optional(),
		default: z.string().optional(),
	})
	.passthrough();

const ScriptEntrySchema = z
	.object({
		id: z.string(),
		name: z.string(),
		description: z.string(),
		platform: z.enum(["linux", "mac", "windows"]),
		arch: z.enum(["x86", "arm"]),
		script: z.string(),
		distro: z.string().optional(),
		version: z.string().optional(),
		group: z.string().optional(),
		dependencies: z.array(z.string()).default([]),
		optional_dependencies: z.array(z.string()).default([]),
		requires_elevation: z.boolean().default(false),
		creates: z.string().optional(),
		inputs: z.array(InputDefSchema).default([]),
	})
	.superRefine((entry, ctx) => {
		// Validate distro/version rules based on platform.
		if (entry.platform === "linux") {
			if (!entry.distro) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: `Entry "${entry.id}": linux entries must have a "distro" field`,
				});
			}
			if (!entry.version) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: `Entry "${entry.id}": linux entries must have a "version" field`,
				});
			}
		} else {
			if (entry.distro !== undefined) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: `Entry "${entry.id}": non-linux entries must not have a "distro" field`,
				});
			}
			if (entry.version !== undefined) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: `Entry "${entry.id}": non-linux entries must not have a "version" field`,
				});
			}
		}

		// Validate no duplicate input IDs.
		const inputIds = entry.inputs.map((i) => i.id);
		const seen = new Set<string>();
		for (const id of inputIds) {
			if (seen.has(id)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: `Entry "${entry.id}": duplicate input id "${id}"`,
				});
				break;
			}
			seen.add(id);
		}
	});

const ManifestSchema = z.array(ScriptEntrySchema);

// ---------------------------------------------------------------------------
// parseManifest
// ---------------------------------------------------------------------------

/**
 * Parses a raw YAML string and validates it against the manifest schema.
 *
 * Fatal on:
 *  - Invalid YAML (parse error)
 *  - Zod schema violations (missing required field, wrong type, business rules)
 *
 * All fatal paths call `deps.log.error(message)` then `deps.exit(1)`.
 */
export function parseManifest(
	rawYaml: string,
	deps: ParseManifestDeps = defaultDeps,
): Manifest {
	// Step 1: Parse YAML
	let parsed: unknown;
	try {
		parsed = jsYaml.load(rawYaml);
	} catch (err) {
		const message =
			err instanceof Error ? err.message : "Failed to parse YAML manifest";
		deps.log.error(`Invalid YAML in manifest: ${message}`);
		deps.exit(1);
	}

	// Step 2: Validate with Zod
	const result = ManifestSchema.safeParse(parsed);
	if (!result.success) {
		const issues = result.error.issues
			.map((issue) => {
				const path = issue.path.length > 0 ? ` at ${issue.path.join(".")}` : "";
				return `  - ${issue.message}${path}`;
			})
			.join("\n");
		deps.log.error(`Invalid manifest schema:\n${issues}`);
		deps.exit(1);
	}

	// Cast through unknown to satisfy TypeScript — Zod output shape matches
	// our ScriptEntry type exactly (passthrough on InputDef preserves extras).
	return result.data as unknown as Manifest;
}
