import { dump, load } from "js-yaml";
import { z } from "zod";
import { CONFIG_PATH, DEFAULT_REPO } from "../config.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AppConfig {
	repo?: string;
}

export interface ConfigServiceDeps {
	readFileFn?: (path: string) => Promise<string>;
	writeFileFn?: (path: string, content: string) => Promise<void>;
	confirmFn?: (message: string) => Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const ConfigSchema = z.object({
	repo: z.string().optional(),
});

// ---------------------------------------------------------------------------
// readConfig
// ---------------------------------------------------------------------------

export async function readConfig(deps?: ConfigServiceDeps): Promise<AppConfig> {
	const readFileFn =
		deps?.readFileFn ?? ((path: string) => Bun.file(path).text());

	let raw: string;
	try {
		raw = await readFileFn(CONFIG_PATH);
	} catch {
		return {};
	}

	let parsed: unknown;
	try {
		parsed = load(raw);
	} catch {
		return {};
	}

	// null/undefined YAML (empty file or only comments) → return {}
	if (parsed === null || parsed === undefined) {
		return {};
	}

	const result = ConfigSchema.safeParse(parsed);
	if (!result.success) {
		return {};
	}

	return result.data;
}

// ---------------------------------------------------------------------------
// writeConfig
// ---------------------------------------------------------------------------

export async function writeConfig(
	config: AppConfig,
	deps?: ConfigServiceDeps,
): Promise<void> {
	const writeFileFn =
		deps?.writeFileFn ??
		(async (path: string, content: string) => {
			await Bun.write(path, content);
		});

	const yamlContent = dump(config);
	await writeFileFn(CONFIG_PATH, yamlContent);
}

// ---------------------------------------------------------------------------
// resolveRepo
// ---------------------------------------------------------------------------

export async function resolveRepo(
	cliRepo: string,
	deps?: ConfigServiceDeps,
): Promise<string> {
	const confirmFn =
		deps?.confirmFn ??
		(async (_msg: string) => {
			// Default: import from @clack/prompts at runtime
			const { confirm } = await import("@clack/prompts");
			return confirm({ message: _msg }) as Promise<boolean>;
		});

	const config = await readConfig(deps);

	// If cliRepo is DEFAULT_REPO and config has a saved repo → use config repo (no prompt)
	if (cliRepo === DEFAULT_REPO && config.repo) {
		return config.repo;
	}

	// If both are set and differ → prompt
	if (config.repo && cliRepo !== config.repo) {
		const useCliRepo = await confirmFn(
			`--repo flag is different from your saved repo (${config.repo}). Use ${cliRepo} instead of ${config.repo}?`,
		);
		if (useCliRepo) {
			await writeConfig({ repo: cliRepo }, deps);
			return cliRepo;
		}
		return config.repo;
	}

	// No conflict — use cliRepo as-is
	return cliRepo;
}
