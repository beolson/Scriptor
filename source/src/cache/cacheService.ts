import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const COMMIT_HASH_FILE = "commit-hash";
const MANIFEST_FILE = "scriptor.yaml";
const SCRIPTS_SUBDIR = "scripts";

/**
 * Manages the local cache stored in `~/.scriptor/cache/`.
 * Accepts an injectable base path for testing without touching the real home directory.
 */
export class CacheService {
	private readonly cacheDir: string;

	constructor(baseDir: string = homedir()) {
		this.cacheDir = join(baseDir, ".scriptor", "cache");
	}

	private ensureCacheDir(): void {
		mkdirSync(this.cacheDir, { recursive: true });
	}

	private ensureScriptsDir(): void {
		mkdirSync(join(this.cacheDir, SCRIPTS_SUBDIR), { recursive: true });
	}

	/**
	 * Returns the stored commit hash, or `null` if not present.
	 */
	async getStoredCommitHash(): Promise<string | null> {
		const file = Bun.file(join(this.cacheDir, COMMIT_HASH_FILE));
		const exists = await file.exists();
		if (!exists) {
			return null;
		}
		const text = await file.text();
		return text.trim() || null;
	}

	/**
	 * Persists the given commit hash to disk.
	 * Creates the cache directory if it does not exist.
	 */
	async saveCommitHash(hash: string): Promise<void> {
		this.ensureCacheDir();
		await Bun.write(join(this.cacheDir, COMMIT_HASH_FILE), hash);
	}

	/**
	 * Returns the cached manifest YAML string, or `null` if absent.
	 */
	async getCachedManifest(): Promise<string | null> {
		const file = Bun.file(join(this.cacheDir, MANIFEST_FILE));
		const exists = await file.exists();
		if (!exists) {
			return null;
		}
		return file.text();
	}

	/**
	 * Writes the manifest YAML to the cache directory.
	 * Creates the cache directory if it does not exist.
	 */
	async saveManifest(yaml: string): Promise<void> {
		this.ensureCacheDir();
		await Bun.write(join(this.cacheDir, MANIFEST_FILE), yaml);
	}

	/**
	 * Returns the cached script content for the given id, or `null` if absent.
	 */
	async getCachedScript(id: string): Promise<string | null> {
		const file = Bun.file(join(this.cacheDir, SCRIPTS_SUBDIR, id));
		const exists = await file.exists();
		if (!exists) {
			return null;
		}
		return file.text();
	}

	/**
	 * Writes script content to the cache directory under `scripts/<id>`.
	 * Creates the cache and scripts directories if they do not exist.
	 */
	async saveScript(id: string, content: string): Promise<void> {
		this.ensureScriptsDir();
		await Bun.write(join(this.cacheDir, SCRIPTS_SUBDIR, id), content);
	}

	/**
	 * Returns `true` when the stored commit hash differs from the latest hash
	 * (or when no hash is stored yet). Returns `false` when they match.
	 */
	async isCacheStale(latestHash: string): Promise<boolean> {
		const stored = await this.getStoredCommitHash();
		return stored !== latestHash;
	}
}
