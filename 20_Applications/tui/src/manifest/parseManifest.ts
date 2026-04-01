import { load, YAMLException } from "js-yaml";
import { z } from "zod";
import type { GroupEntry, ScriptEntry } from "../types.js";
import { ManifestValidationError } from "../types.js";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const InputDefSchema = z
	.object({
		id: z.string(),
		type: z.enum(["string", "number", "ssl-cert"]),
		label: z.string(),
		required: z.boolean().optional(),
		default: z.string().optional(),
		download_path: z.string().optional(),
		format: z.string().optional(),
	})
	.passthrough();

const OsSchema = z.object({
	name: z.string(),
	version: z.string().optional(),
	arch: z.enum(["x64", "arm"]),
});

const ScriptEntrySchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string(),
	os: OsSchema,
	script: z.string(),
	requires_elevation: z.boolean().optional(),
	dependencies: z.array(z.string()).optional(),
	run_after: z.array(z.string()).optional(),
	run_if: z.array(z.string()).optional(),
	creates: z.array(z.string()).optional(),
	inputs: z.array(InputDefSchema).optional(),
});

const GroupEntrySchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string(),
	scripts: z.array(z.string()),
});

const ManifestSchema = z
	.object({
		scripts: z.array(ScriptEntrySchema),
		groups: z.array(GroupEntrySchema).optional(),
	})
	.superRefine((manifest, ctx) => {
		const scriptIds = new Set<string>();

		// Unique script id values
		for (const entry of manifest.scripts) {
			if (scriptIds.has(entry.id)) {
				ctx.addIssue(`Duplicate script id: "${entry.id}"`);
			} else {
				scriptIds.add(entry.id);
			}
		}

		// Unique group id values
		if (manifest.groups) {
			const groupIds = new Set<string>();
			for (const group of manifest.groups) {
				if (groupIds.has(group.id)) {
					ctx.addIssue(`Duplicate group id: "${group.id}"`);
				} else {
					groupIds.add(group.id);
				}
			}

			// Every id in a group's scripts array exists in manifest scripts
			for (const group of manifest.groups) {
				for (const ref of group.scripts) {
					if (!scriptIds.has(ref)) {
						ctx.addIssue(
							`Group "${group.id}" references unknown script id: "${ref}"`,
						);
					}
				}
			}
		}

		// Per-script cross-field validation
		for (const entry of manifest.scripts) {
			// Input id values unique within each script entry
			if (entry.inputs) {
				const inputIds = new Set<string>();
				for (const input of entry.inputs) {
					if (inputIds.has(input.id)) {
						ctx.addIssue(
							`Script "${entry.id}" has duplicate input id: "${input.id}"`,
						);
					} else {
						inputIds.add(input.id);
					}
				}
			}

			// run_if references must exist in manifest scripts
			// Note: we validate against the collected scriptIds, which may be incomplete
			// if there are duplicates — but we still check all run_if refs.
			if (entry.run_if) {
				for (const ref of entry.run_if) {
					if (!scriptIds.has(ref)) {
						ctx.addIssue(
							`Script "${entry.id}" run_if references unknown script id: "${ref}"`,
						);
					}
				}
			}
		}
	});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type ParsedManifest = {
	scripts: ScriptEntry[];
	groups?: GroupEntry[];
};

export function parseManifest(yamlString: string): ParsedManifest {
	// Parse YAML — wrap YAMLException in ManifestValidationError
	let raw: unknown;
	try {
		raw = load(yamlString);
	} catch (err) {
		if (err instanceof YAMLException) {
			throw new ManifestValidationError([err.message]);
		}
		throw err;
	}

	// Validate with Zod — collect all issue messages
	const result = ManifestSchema.safeParse(raw);
	if (!result.success) {
		const messages = result.error.issues.map((issue) => issue.message);
		throw new ManifestValidationError(messages);
	}

	// Cast to our domain types (schemas align structurally)
	return result.data as ParsedManifest;
}
