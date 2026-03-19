$ErrorActionPreference = "Stop"
# Ensure PowerShell's own output is UTF-8 when piped (e.g. via Scriptor).
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$InstanceName = if ($args[0]) { $args[0] } else { "Debian13Dev" }
$WinUser = $env:USERNAME

Write-Host "[setup-debian-devbox] Starting..."
Write-Host "[setup-debian-devbox] Instance name: $InstanceName"
Write-Host "[setup-debian-devbox] Windows user: $WinUser"

# Check if WSL is installed
$wslPath = Get-Command wsl.exe -ErrorAction SilentlyContinue
if (-not $wslPath) {
    Write-Host "[setup-debian-devbox] ERROR: WSL is not installed. Run the 'Install WSL' script first."
    exit 1
}

# Check if instance already exists
# wsl --list --quiet outputs UTF-16LE; normalize for comparison
$existingInstances = (wsl --list --quiet 2>$null) |
    ForEach-Object { $_.Trim("`0").Trim() } |
    Where-Object { $_ -ne "" }

if ($existingInstances -contains $InstanceName) {
    Write-Host "[setup-debian-devbox] ERROR: WSL instance '$InstanceName' already exists. Remove it with:"
    Write-Host "  wsl --unregister $InstanceName"
    exit 1
}

# Install Debian without launching interactive setup.
# Suppress output: wsl --install writes UTF-16 LE directly to the pipe which
# garbles logs. The exit code tells us whether it succeeded.
Write-Host "[setup-debian-devbox] Installing Debian WSL instance '$InstanceName'..."
wsl --install -d Debian --name $InstanceName --no-launch *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[setup-debian-devbox] ERROR: Failed to install WSL instance."
    exit 1
}

# Verify the instance was registered under the expected name.
# --name requires WSL 2.4.4+; on older builds the distro may be named 'Debian'.
$installedInstances = (wsl --list --quiet 2>$null) |
    ForEach-Object { $_.Trim("`0").Trim() } |
    Where-Object { $_ -ne "" }
if (-not ($installedInstances -contains $InstanceName)) {
    Write-Host "[setup-debian-devbox] ERROR: Instance '$InstanceName' not found after install."
    Write-Host "[setup-debian-devbox] Your WSL may not support --name. Update with: wsl --update"
    Write-Host "[setup-debian-devbox] Found instances: $($installedInstances -join ', ')"
    exit 1
}
Write-Host "[setup-debian-devbox] WSL instance '$InstanceName' installed."

# Create user matching Windows username with no password.
# Use useradd instead of adduser: PowerShell 5.x silently drops empty-string
# arguments to native commands, which breaks `adduser --gecos "" username`.
Write-Host "[setup-debian-devbox] Creating user '$WinUser'..."
wsl --distribution $InstanceName --user root -- useradd -m -s /bin/bash $WinUser
if ($LASTEXITCODE -ne 0) {
    Write-Host "[setup-debian-devbox] ERROR: Failed to create user '$WinUser'."
    exit 1
}

wsl --distribution $InstanceName --user root -- passwd -d $WinUser
if ($LASTEXITCODE -ne 0) {
    Write-Host "[setup-debian-devbox] ERROR: Failed to remove password for '$WinUser'."
    exit 1
}

# Add user to sudo group
Write-Host "[setup-debian-devbox] Adding '$WinUser' to sudo group..."
wsl --distribution $InstanceName --user root -- usermod -aG sudo $WinUser
if ($LASTEXITCODE -ne 0) {
    Write-Host "[setup-debian-devbox] ERROR: Failed to add '$WinUser' to sudo group."
    exit 1
}

# Set as default login user
Write-Host "[setup-debian-devbox] Setting default user in /etc/wsl.conf..."
wsl --distribution $InstanceName --user root -- bash -c "printf '[user]\ndefault=$WinUser\n' > /etc/wsl.conf"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[setup-debian-devbox] ERROR: Failed to set default user in wsl.conf."
    exit 1
}

# Terminate instance to apply wsl.conf
Write-Host "[setup-debian-devbox] Restarting instance to apply configuration..."
wsl --terminate $InstanceName *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[setup-debian-devbox] ERROR: Failed to terminate instance."
    exit 1
}

# Update packages and install essentials
Write-Host "[setup-debian-devbox] Updating packages and installing curl and wget..."
wsl --distribution $InstanceName --user root -- bash -c "apt-get update -y && apt-get upgrade -y && apt-get install -y curl wget"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[setup-debian-devbox] ERROR: Package setup failed."
    exit 1
}

Write-Host "[setup-debian-devbox] Done. WSL instance '$InstanceName' is ready."
Write-Host "[setup-debian-devbox] Verify with: wsl --distribution $InstanceName -- whoami"
