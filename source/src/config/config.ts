import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import * as yaml from "js-yaml";

export interface ScriptorConfig {
	repo?: string;
}

function configDir(baseDir: string): string {
	return join(baseDir, ".scriptor");
}

function configPath(baseDir: string): string {
	return join(configDir(baseDir), "config");
}

/**
 * Reads `~/.scriptor/config` (or a test override base directory).
 * Returns a default empty config if the file is absent, corrupt, or non-object YAML.
 */
export async function readConfig(
	baseDir: string = homedir(),
): Promise<ScriptorConfig> {
	const file = Bun.file(configPath(baseDir));

	const exists = await file.exists();
	if (!exists) {
		return {};
	}

	try {
		const text = await file.text();
		const parsed = yaml.load(text);
		if (
			parsed === null ||
			typeof parsed !== "object" ||
			Array.isArray(parsed)
		) {
			return {};
		}
		const obj = parsed as Record<string, unknown>;
		const config: ScriptorConfig = {};
		if (typeof obj.repo === "string") {
			config.repo = obj.repo;
		}
		return config;
	} catch {
		return {};
	}
}

/**
 * Writes `~/.scriptor/config` (or a test override base directory).
 * Creates the directory if it does not exist.
 */
export async function writeConfig(
	config: ScriptorConfig,
	baseDir: string = homedir(),
): Promise<void> {
	mkdirSync(configDir(baseDir), { recursive: true });
	const text = yaml.dump(config);
	await Bun.write(configPath(baseDir), text);
}
