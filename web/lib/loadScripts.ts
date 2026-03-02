import { readFile } from "node:fs/promises";
import * as path from "node:path";
import yaml from "js-yaml";
import type { ScriptEntry } from "./types";

const YAML_PATH = path.resolve(process.cwd(), "../scriptor.yaml");

async function parseYaml(): Promise<ScriptEntry[]> {
	const text = await readFile(YAML_PATH, "utf-8");
	const raw = yaml.load(text);
	if (!Array.isArray(raw)) {
		throw new Error("scriptor.yaml must contain a top-level array");
	}
	return raw as ScriptEntry[];
}

export async function loadScripts(): Promise<ScriptEntry[]> {
	return parseYaml();
}

export async function getScriptsByPlatform(
	platform: string,
): Promise<ScriptEntry[]> {
	const scripts = await parseYaml();
	return scripts.filter((s) => s.platform === platform);
}

export async function getScriptById(
	id: string,
): Promise<ScriptEntry | undefined> {
	const scripts = await parseYaml();
	return scripts.find((s) => s.id === id);
}

export async function getAllScriptIds(): Promise<string[]> {
	const scripts = await parseYaml();
	return scripts.map((s) => s.id);
}
