import { KEYCHAIN_ACCOUNT, KEYCHAIN_SERVICE } from "../config.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SpawnSyncResult = {
	exitCode: number;
	stdout: Buffer | string;
};

export interface KeychainServiceDeps {
	spawnSyncFn?: (
		cmd: string[],
		opts?: Record<string, unknown>,
	) => SpawnSyncResult;
	platformFn?: () => string;
}

// ---------------------------------------------------------------------------
// Default spawnSync implementation
// ---------------------------------------------------------------------------

function defaultSpawnSync(
	cmd: string[],
	opts?: Record<string, unknown>,
): SpawnSyncResult {
	const proc = Bun.spawnSync(
		cmd as [string, ...string[]],
		opts as Parameters<typeof Bun.spawnSync>[1],
	);
	return {
		exitCode: proc.exitCode ?? 1,
		stdout: proc.stdout ?? Buffer.alloc(0),
	};
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stdoutToString(stdout: Buffer | string): string {
	if (typeof stdout === "string") return stdout.trim();
	return stdout.toString("utf8").trim();
}

// ---------------------------------------------------------------------------
// getToken
// ---------------------------------------------------------------------------

export function getToken(deps?: KeychainServiceDeps): string | undefined {
	const platform = (deps?.platformFn ?? (() => process.platform))();
	const spawnSync = deps?.spawnSyncFn ?? defaultSpawnSync;

	try {
		if (platform === "darwin") {
			const result = spawnSync([
				"security",
				"find-generic-password",
				"-s",
				KEYCHAIN_SERVICE,
				"-a",
				KEYCHAIN_ACCOUNT,
				"-w",
			]);
			if (result.exitCode !== 0) return undefined;
			return stdoutToString(result.stdout);
		}

		if (platform === "linux") {
			const result = spawnSync([
				"secret-tool",
				"lookup",
				"service",
				KEYCHAIN_SERVICE,
				"account",
				KEYCHAIN_ACCOUNT,
			]);
			if (result.exitCode !== 0) return undefined;
			return stdoutToString(result.stdout);
		}

		if (platform === "win32") {
			const result = spawnSync(["cmdkey", "/list"]);
			if (result.exitCode !== 0) return undefined;
			const output = stdoutToString(result.stdout);
			const target = `${KEYCHAIN_SERVICE}:${KEYCHAIN_ACCOUNT}`;
			if (!output.includes(target)) return undefined;
			// Extract the credential target line and return the target name as confirmation
			return target;
		}

		// Unknown platform
		return undefined;
	} catch {
		return undefined;
	}
}

// ---------------------------------------------------------------------------
// setToken
// ---------------------------------------------------------------------------

export function setToken(token: string, deps?: KeychainServiceDeps): void {
	const platform = (deps?.platformFn ?? (() => process.platform))();
	const spawnSync = deps?.spawnSyncFn ?? defaultSpawnSync;

	try {
		if (platform === "darwin") {
			spawnSync([
				"security",
				"add-generic-password",
				"-s",
				KEYCHAIN_SERVICE,
				"-a",
				KEYCHAIN_ACCOUNT,
				"-w",
				token,
				"-U",
			]);
			return;
		}

		if (platform === "linux") {
			spawnSync(
				[
					"secret-tool",
					"store",
					`--label=${KEYCHAIN_SERVICE}`,
					"service",
					KEYCHAIN_SERVICE,
					"account",
					KEYCHAIN_ACCOUNT,
				],
				{ stdin: token },
			);
			return;
		}

		if (platform === "win32") {
			spawnSync([
				"cmdkey",
				`/add:${KEYCHAIN_SERVICE}:${KEYCHAIN_ACCOUNT}`,
				`/user:${KEYCHAIN_ACCOUNT}`,
				`/pass:${token}`,
			]);
			return;
		}

		// Unknown platform — silently no-op
	} catch {
		// Silently no-op on any failure
	}
}

// ---------------------------------------------------------------------------
// deleteToken
// ---------------------------------------------------------------------------

export function deleteToken(deps?: KeychainServiceDeps): void {
	const platform = (deps?.platformFn ?? (() => process.platform))();
	const spawnSync = deps?.spawnSyncFn ?? defaultSpawnSync;

	try {
		if (platform === "darwin") {
			spawnSync([
				"security",
				"delete-generic-password",
				"-s",
				KEYCHAIN_SERVICE,
				"-a",
				KEYCHAIN_ACCOUNT,
			]);
			return;
		}

		if (platform === "linux") {
			spawnSync([
				"secret-tool",
				"clear",
				"service",
				KEYCHAIN_SERVICE,
				"account",
				KEYCHAIN_ACCOUNT,
			]);
			return;
		}

		if (platform === "win32") {
			spawnSync(["cmdkey", `/delete:${KEYCHAIN_SERVICE}:${KEYCHAIN_ACCOUNT}`]);
			return;
		}

		// Unknown platform — silently no-op
	} catch {
		// Silently no-op on any failure
	}
}
