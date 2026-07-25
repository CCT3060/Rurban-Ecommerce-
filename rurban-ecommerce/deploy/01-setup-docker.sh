#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Step 1: Install Docker & Docker Compose on the EC2 (Amazon Linux 2023)
# Run once on a fresh / upgraded EC2 instance.
# Usage: bash 01-setup-docker.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

echo "=== [1/3] Installing Docker ==="
sudo dnf update -y
sudo dnf install -y docker
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker ec2-user
echo "Docker installed: $(docker --version)"

echo ""
echo "=== [2/3] Installing Docker Compose v2 ==="
COMPOSE_VERSION="v2.27.1"
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-x86_64" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
echo "Docker Compose installed: $(docker compose version)"

echo ""
echo "=== [3/3] Installing Git & other tools ==="
sudo dnf install -y git jq curl

echo ""
echo "✓ Docker setup complete."
echo "  IMPORTANT: Log out and back in (or run 'newgrp docker') for group changes to take effect."
