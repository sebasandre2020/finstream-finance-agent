#!/usr/bin/env bash
# ==============================================================================
# Multi-Account Finance Agent - Zero-Cost Production VPS Setup Script
# Designed for Oracle Cloud Always Free (Ubuntu 22.04 / 24.04 ARM64 / x86_64)
# ==============================================================================

set -euo pipefail

echo "=========================================================="
echo "🚀 Multi-Account Finance Agent - Zero-Cost Setup"
echo "=========================================================="

# 1. Update system and install prerequisites
echo "📦 Updating system packages..."
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl gnupg lsb-release git ufw openssl

# 2. Install Docker and Docker Compose plugin if missing
if ! command -v docker &> /dev/null; then
    echo "🐳 Installing Docker Engine..."
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update -y
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    sudo systemctl enable --now docker
    sudo usermod -aG docker "$USER"
fi

# 3. Configure Firewall (UFW)
echo "🔒 Configuring firewall..."
sudo ufw allow 22/tcp || true
sudo ufw allow 80/tcp || true
sudo ufw allow 443/tcp || true
sudo ufw allow 3000/tcp || true
sudo ufw --force enable || true

# 4. Check or create .env file
if [ ! -f .env ]; then
    echo "📝 Creating .env from .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env
    else
        touch .env
    fi
    # Generate secure random secret if not provided
    RANDOM_SECRET=$(openssl rand -hex 32)
    echo "WEBHOOK_SIGNING_SECRET=${RANDOM_SECRET}" >> .env
fi

# 5. Build and launch Docker Compose stack
echo "🏗️ Building and starting services..."
sudo docker compose up -d --build

# 6. Wait for health checks
echo "⏳ Waiting for health checks to pass..."
sleep 15

# Check running containers
echo "📋 Service Status:"
sudo docker compose ps

# 7. Print access instructions
echo ""
echo "=========================================================="
echo "✅ Deployment completed successfully!"
echo "=========================================================="
echo "🌐 Local/Internal Access: http://localhost:3000"
echo "📖 Swagger API Docs:      http://localhost:3000/docs"
echo "🔍 Langfuse Monitoring:  http://localhost:3001"
echo ""
echo "To view live Cloudflare Tunnel URL (if enabled):"
echo "  docker logs finance_tunnel --tail 30"
echo "=========================================================="
