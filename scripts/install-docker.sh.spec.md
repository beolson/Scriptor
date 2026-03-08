## Overview

Installs Docker Engine and the Docker Compose plugin on Debian 13 using
the official Docker apt repository.

## Steps

1. Remove any conflicting packages
2. Add Docker's official GPG key
3. Add the Docker apt repository
4. Install `docker-ce`, `docker-ce-cli`, `containerd.io`, and `docker-compose-plugin`
5. Enable and start the Docker daemon

## Post-install

Add your user to the `docker` group to run Docker without `sudo`:

```bash
sudo usermod -aG docker $USER
newgrp docker
```

## Verification

```bash
docker --version
docker compose version
```
