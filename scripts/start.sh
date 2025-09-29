#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CERT_SCRIPT="$ROOT_DIR/nginx/generate-self-signed.sh"
CERT_DIR="$ROOT_DIR/nginx/certs"

if [ ! -f "$CERT_DIR/fullchain.pem" ] || [ ! -f "$CERT_DIR/privkey.pem" ]; then
  echo "Generating self-signed certificates..."
  bash "$CERT_SCRIPT" localhost
else
  echo "Certificates already exist in $CERT_DIR"
fi

echo "Starting docker-compose (detached, builds images)..."
sudo docker-compose up -d --build

echo "Done. Use 'docker-compose ps' to see running containers and 'docker compose logs -f' to follow logs." 
