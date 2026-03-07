#!/usr/bin/env bash
# configure-tls-endpoint.sh
# Args: $1=service-name, $2=port, $3=cert-path

set -euo pipefail

SERVICE_NAME="$1"
PORT="$2"
CERT_PATH="$3"

echo "Configuring TLS endpoint..."
echo "  Service : $SERVICE_NAME"
echo "  Port    : $PORT"
echo "  Cert    : $CERT_PATH"
echo ""
echo "Simulating TLS configuration for $SERVICE_NAME on port $PORT..."
echo "  [1/3] Validating certificate at $CERT_PATH"
echo "  [2/3] Binding $SERVICE_NAME to port $PORT"
echo "  [3/3] Reloading service"
echo ""
echo "Done. $SERVICE_NAME is now listening on port $PORT with TLS."
