## Overview

Test/demo script that simulates configuring a TLS endpoint for a named service on Debian 13. Does not modify the system — intended for validating Scriptor input handling and certificate delivery.

## Inputs

| Input | Type | Description |
|---|---|---|
| `service-name` | string | Name of the service to bind (e.g., `nginx`) |
| `port` | number | Port to listen on (e.g., `443`) |
| `cert` | ssl-cert | Certificate file, downloaded to `/tmp/test-tls-cert.pem` before the script runs |

## Steps

1. Print the resolved service name, port, and certificate path
2. Simulate certificate validation at the provided path
3. Simulate binding the service to the specified port
4. Simulate reloading the service

## Verification

```bash
# Script is a simulation — no system state to verify.
# Confirm the output contains "Done." and the expected service name.
```
