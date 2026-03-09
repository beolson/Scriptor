#Requires -RunAsAdministrator
$ErrorActionPreference = "Stop"

$InstanceName = if ($args[0]) { $args[0] } else { "Debian13Dev" }
$WinUser = $env:USERNAME

Write-Host "[setup-debian-devbox] Starting..."
Write-Host "[setup-debian-devbox] Instance name: $InstanceName"
Write-Host "[setup-debian-devbox] Windows user: $WinUser"

# Check if WSL is installed
$wslPath = Get-Command wsl.exe -ErrorAction SilentlyContinue
if (-not $wslPath) {
    Write-Error "[setup-debian-devbox] WSL is not installed. Install it with:`n  wsl --install --no-distribution"
    exit 1
}

# Check if instance already exists
# wsl --list --quiet outputs UTF-16LE; normalize for comparison
$existingInstances = (wsl --list --quiet 2>$null) |
    ForEach-Object { $_.Trim("`0").Trim() } |
    Where-Object { $_ -ne "" }

if ($existingInstances -contains $InstanceName) {
    Write-Error "[setup-debian-devbox] WSL instance '$InstanceName' already exists. Remove it with:`n  wsl --unregister $InstanceName"
    exit 1
}

# Install Debian without launching interactive setup
Write-Host "[setup-debian-devbox] Installing Debian WSL instance '$InstanceName'..."
wsl --install -d Debian --name $InstanceName --no-launch
if ($LASTEXITCODE -ne 0) {
    Write-Error "[setup-debian-devbox] Failed to install WSL instance."
    exit 1
}

# Create user (as root, since no default user exists yet)
Write-Host "[setup-debian-devbox] Creating user '$WinUser'..."
wsl --distribution $InstanceName --user root -- adduser --disabled-password --gecos "" $WinUser
if ($LASTEXITCODE -ne 0) {
    Write-Error "[setup-debian-devbox] Failed to create user '$WinUser'."
    exit 1
}

# Add user to sudo group
Write-Host "[setup-debian-devbox] Adding '$WinUser' to sudo group..."
wsl --distribution $InstanceName --user root -- usermod -aG sudo $WinUser
if ($LASTEXITCODE -ne 0) {
    Write-Error "[setup-debian-devbox] Failed to add user to sudo group."
    exit 1
}

# Configure passwordless sudo
Write-Host "[setup-debian-devbox] Configuring passwordless sudo..."
wsl --distribution $InstanceName --user root -- bash -c "echo '$WinUser ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/$WinUser && chmod 0440 /etc/sudoers.d/$WinUser"
if ($LASTEXITCODE -ne 0) {
    Write-Error "[setup-debian-devbox] Failed to configure passwordless sudo."
    exit 1
}

# Set default user in wsl.conf
Write-Host "[setup-debian-devbox] Setting default user in /etc/wsl.conf..."
wsl --distribution $InstanceName --user root -- bash -c "printf '[user]\ndefault=$WinUser\n' > /etc/wsl.conf"
if ($LASTEXITCODE -ne 0) {
    Write-Error "[setup-debian-devbox] Failed to set default user in wsl.conf."
    exit 1
}

# Terminate instance to apply wsl.conf
Write-Host "[setup-debian-devbox] Restarting instance to apply configuration..."
wsl --terminate $InstanceName
if ($LASTEXITCODE -ne 0) {
    Write-Error "[setup-debian-devbox] Failed to terminate instance."
    exit 1
}

# Copy SSH files from Windows home into WSL
# Compute WSL mount path from HOMEDRIVE + HOMEPATH (handles non-C: drives)
$driveLetter = ($env:HOMEDRIVE -replace ':', '').ToLower()
$homePath = $env:HOMEPATH -replace '\\', '/'
$wslSshSource = "/mnt/$driveLetter$homePath/.ssh"

Write-Host "[setup-debian-devbox] Checking for SSH files at $wslSshSource..."

$sshFilesExist = wsl --distribution $InstanceName -- test -d $wslSshSource
if ($LASTEXITCODE -ne 0) {
    Write-Warning "[setup-debian-devbox] No .ssh directory found at $wslSshSource. Skipping SSH copy."
} else {
    Write-Host "[setup-debian-devbox] Copying SSH files..."
    wsl --distribution $InstanceName -- bash -c "mkdir -p ~/.ssh && cp -r $wslSshSource/* ~/.ssh/ 2>/dev/null"
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "[setup-debian-devbox] No SSH files found to copy."
    } else {
        # Set correct permissions
        Write-Host "[setup-debian-devbox] Setting SSH file permissions..."
        wsl --distribution $InstanceName -- bash -c "chmod 700 ~/.ssh && find ~/.ssh -type f -name '*.pub' -exec chmod 644 {} + && find ~/.ssh -type f ! -name '*.pub' ! -name 'known_hosts*' ! -name 'config' -exec chmod 600 {} + && chmod 644 ~/.ssh/known_hosts* 2>/dev/null; chmod 644 ~/.ssh/config 2>/dev/null; true"
    }
}

Write-Host "[setup-debian-devbox] Done. WSL instance '$InstanceName' is ready."
Write-Host "[setup-debian-devbox] Verify with: wsl --distribution $InstanceName -- whoami"
