#!/usr/bin/env bash
set -euo pipefail

echo "Starting docker-compose (detached, builds images)..."
sudo docker-compose up -d --build

echo "Done. Use 'docker-compose ps' to see running containers and 'docker compose logs -f' to follow logs." 
