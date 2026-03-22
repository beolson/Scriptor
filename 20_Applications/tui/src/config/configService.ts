import * as path from "node:path";
import * as yaml from "js-yaml";
import { type Config, configSchema } from "./types.js";

// ---------------------------------------------------------------------------
// Default config path
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG_PATH = path.join(
	process.env.HOME ?? process.env.USERPROFILE ?? "~",
	".scriptor",
	"config",
);

// ---------------------------------------------------------------------------
// Injectable deps
// ---------------------------------------------------------------------------

export interface ConfigDeps {
	readFile: (path: string) => Promise<string>;
	writeFile: (path: string, content: string) => Promise<void>;
	mkdir: (path: string) => Promise<void>;
	/** Override for testing; defaults to ~/.scriptor/config */
	configPath?: string;
}

const defaultDeps: ConfigDeps = {
	readFile: async (filePath: string) => {
		const file = Bun.file(filePath);
		const exists = await file.exists();
		if (!exists) {
			const err = new Error(
				`ENOENT: no such file: ${filePath}`,
			) as NodeJS.ErrnoException;
			err.code = "ENOENT";
			throw err;
		}
		return file.text();
	},
	writeFile: async (filePath: string, content: string) => {
		await Bun.write(filePath, content);
	},
	mkdir: async (dirPath: string) => {
		const fs = await import("node:fs/promises");
		await fs.mkdir(dirPath, { recursive: true });
	},
};

// ---------------------------------------------------------------------------
// readConfig
// ---------------------------------------------------------------------------

/**
 * Reads `~/.scriptor/config` (YAML). Returns `{}` on any read or parse error,
 * including missing file, corrupt YAML, and non-object YAML values.
 */
export async function readConfig(deps?: Partial<ConfigDeps>): Promise<Config> {
	const resolved = resolvedDeps(deps);
	const configPath = resolved.configPath ?? DEFAULT_CONFIG_PATH;

	let raw: string;
	try {
		raw = await resolved.readFile(configPath);
	} catch {
		return {};
	}

	let parsed: unknown;
	try {
		parsed = yaml.load(raw);
	} catch {
		return {};
	}

	if (
		parsed === null ||
		parsed === undefined ||
		typeof parsed !== "object" ||
		Array.isArray(parsed)
	) {
		return {};
	}

	const result = configSchema.safeParse(parsed);
	if (!result.success) {
		return {};
	}

	return result.data;
}

// ---------------------------------------------------------------------------
// writeConfig
// ---------------------------------------------------------------------------

/**
 * Writes the given Config to `~/.scriptor/config` as YAML.
 * Creates the parent directory if it does not exist.
 */
export async function writeConfig(
	config: Config,
	deps?: Partial<ConfigDeps>,
): Promise<void> {
	const resolved = resolvedDeps(deps);
	const configPath = resolved.configPath ?? DEFAULT_CONFIG_PATH;
	const dir = path.dirname(configPath);

	await resolved.mkdir(dir);

	const content = yaml.dump(config, { noRefs: true });
	await resolved.writeFile(configPath, content);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function resolvedDeps(
	deps?: Partial<ConfigDeps>,
): ConfigDeps & { configPath?: string } {
	return { ...defaultDeps, ...deps };
}
