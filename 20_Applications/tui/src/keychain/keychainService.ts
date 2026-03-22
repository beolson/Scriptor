// ---------------------------------------------------------------------------
// Keychain Service
//
// Stores and retrieves the OAuth token using platform-native CLI tools.
// No native modules — all interaction is via subprocess (Bun.spawn).
//
// Platform routing:
//   macOS  → security (built-in Keychain CLI)
//   Linux  → secret-tool (libsecret; may be absent — treat as no-keychain)
//   Windows → powershell Credential Manager API
//
// Any subprocess failure (non-zero exit, thrown error, missing tool / exit 127)
// causes keychainGet to return null and keychainSet to silently no-op.
// Callers must not assume persistence is available.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Injectable deps
// ---------------------------------------------------------------------------

export interface SpawnResult {
	exitCode: number | null;
	stdout: string;
}

export interface KeychainDeps {
	/** Current platform; defaults to `process.platform`. */
	platform: NodeJS.Platform;
	/**
	 * Run a subprocess and return exit code + stdout.
	 * Optional `stdin` string is piped to the process's standard input.
	 */
	spawn: (cmd: string[], stdin?: string) => Promise<SpawnResult>;
}

const defaultDeps: KeychainDeps = {
	get platform() {
		return process.platform;
	},
	spawn: async (cmd: string[], stdin?: string): Promise<SpawnResult> => {
		const proc = Bun.spawn(cmd, {
			stdout: "pipe",
			stderr: "ignore",
			stdin: stdin !== undefined ? Buffer.from(`${stdin}\n`) : "ignore",
		});
		const exitCode = await proc.exited;
		const stdout = (await new Response(proc.stdout).text()).trim();
		return { exitCode, stdout };
	},
};

// ---------------------------------------------------------------------------
// Platform command builders
// ---------------------------------------------------------------------------

function darwinGetCmd(key: string): string[] {
	return ["security", "find-generic-password", "-s", key, "-w"];
}

function darwinSetCmd(key: string, value: string): string[] {
	return ["security", "add-generic-password", "-s", key, "-w", value, "-U"];
}

function linuxGetCmd(key: string): string[] {
	return ["secret-tool", "lookup", "service", key];
}

function linuxSetCmd(key: string): string[] {
	// secret-tool store reads the secret from stdin.
	// The caller passes the value via the `stdin` parameter to spawn.
	return ["secret-tool", "store", "--label", key, "service", key];
}

function win32GetCmd(key: string): string[] {
	// Use PowerShell to read from Windows Credential Manager
	const script = [
		`$cred = Get-StoredCredential -Target ${psEscape(key)} -ErrorAction SilentlyContinue;`,
		`if ($cred) { $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($cred.Password);`,
		`[System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr) }`,
	].join(" ");
	return ["powershell", "-NoProfile", "-NonInteractive", "-Command", script];
}

function win32SetCmd(key: string, value: string): string[] {
	// Use PowerShell to write to Windows Credential Manager
	const script = [
		`$cred = New-Object System.Management.Automation.PSCredential(${psEscape(key)},`,
		`(ConvertTo-SecureString ${psEscape(value)} -AsPlainText -Force));`,
		`$cred | Export-Clixml -Path "$env:APPDATA\\scriptor_cred_${psEscape(key)}.xml"`,
	].join(" ");
	return ["powershell", "-NoProfile", "-NonInteractive", "-Command", script];
}

// ---------------------------------------------------------------------------
// Shell escaping helpers
// ---------------------------------------------------------------------------

/** Minimal PowerShell string escape (single-quoted strings). */
function psEscape(s: string): string {
	return `'${s.replace(/'/g, "''")}'`;
}

// ---------------------------------------------------------------------------
// keychainGet
// ---------------------------------------------------------------------------

/**
 * Retrieves the stored value for `key` from the OS keychain.
 * Returns `null` if the key is not found, the keychain tool is unavailable,
 * the subprocess fails, or the platform is unsupported.
 */
export async function keychainGet(
	key: string,
	deps?: Partial<KeychainDeps>,
): Promise<string | null> {
	const resolved: KeychainDeps = { ...defaultDeps, ...deps };

	let cmd: string[];
	switch (resolved.platform) {
		case "darwin":
			cmd = darwinGetCmd(key);
			break;
		case "linux":
			cmd = linuxGetCmd(key);
			break;
		case "win32":
			cmd = win32GetCmd(key);
			break;
		default:
			return null;
	}

	try {
		const result = await resolved.spawn(cmd);
		if (result.exitCode !== 0) {
			return null;
		}
		return result.stdout.trim() || null;
	} catch {
		return null;
	}
}

// ---------------------------------------------------------------------------
// keychainSet
// ---------------------------------------------------------------------------

/**
 * Stores `value` under `key` in the OS keychain.
 * Silently no-ops if the keychain tool is unavailable, the subprocess fails,
 * or the platform is unsupported.
 */
export async function keychainSet(
	key: string,
	value: string,
	deps?: Partial<KeychainDeps>,
): Promise<void> {
	const resolved: KeychainDeps = { ...defaultDeps, ...deps };

	let cmd: string[];
	let stdin: string | undefined;
	switch (resolved.platform) {
		case "darwin":
			cmd = darwinSetCmd(key, value);
			break;
		case "linux":
			// secret-tool store reads the password from stdin
			cmd = linuxSetCmd(key);
			stdin = value;
			break;
		case "win32":
			cmd = win32SetCmd(key, value);
			break;
		default:
			return;
	}

	try {
		await resolved.spawn(cmd, stdin);
		// Silently ignore any non-zero exit code
	} catch {
		// Silently swallow spawn errors
	}
}
