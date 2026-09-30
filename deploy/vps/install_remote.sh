#!/usr/bin/env bash
set -euo pipefail

echo "=========================================================="
echo "🚀 Bootstrapping Finance Agent on Oracle Cloud ARM64 VM"
echo "=========================================================="

echo "📦 Step 1: Installing Docker and dependencies..."
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl gnupg lsb-release iptables-persistent

# Configure firewall rules on VM OS
sudo iptables -I INPUT 5 -p tcp --dport 80 -j ACCEPT || true
sudo iptables -I INPUT 5 -p tcp --dport 443 -j ACCEPT || true
sudo iptables -I INPUT 5 -p tcp --dport 3000 -j ACCEPT || true
sudo iptables -I INPUT 5 -p tcp --dport 3001 -j ACCEPT || true
sudo iptables -I INPUT 5 -p tcp --dport 8000 -j ACCEPT || true
sudo iptables-save | sudo tee /etc/iptables/rules.v4 > /dev/null || true

if ! command -v docker &> /dev/null; then
    echo "🐳 Installing Docker CE..."
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update -y
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    sudo systemctl enable --now docker
    sudo usermod -aG docker ubuntu
fi

echo "📂 Step 2: Unpacking application workspace..."
mkdir -p /home/ubuntu/app
tar -xzf /home/ubuntu/finance_app.tar.gz -C /home/ubuntu/app
cp /home/ubuntu/.env /home/ubuntu/app/.env

# Replace localhost with remote public IP for frontend & OAuth callback
sed -i 's|http://localhost:3000|http://161.153.9.52:3000|g' /home/ubuntu/app/.env
sed -i 's|http://localhost:8000|http://161.153.9.52:8000|g' /home/ubuntu/app/.env

echo "🏗️ Step 3: Building and starting all 8 services..."
cd /home/ubuntu/app
sudo docker compose -f docker-compose.yml up -d --build

echo "⏳ Step 4: Waiting for database to become healthy..."
for i in {1..30}; do
    if sudo docker exec finance_postgres pg_isready -U postgres -d finance_db > /dev/null 2>&1; then
        echo "✅ PostgreSQL is healthy!"
        break
    fi
    echo "Waiting for PostgreSQL ($i/30)..."
    sleep 2
done

echo "🌱 Step 5: Running database migrations and seeds..."
sleep 5
sudo docker exec finance_api python scripts/seed_db.py || true

echo ""
echo "=========================================================="
echo "🎉 SUCCESS: Finance Agent deployed 24/7 on Oracle Cloud!"
echo "=========================================================="
echo "🌐 Frontend Dashboard: http://161.153.9.52:3000"
echo "📖 Swagger API Docs:   http://161.153.9.52:3000/docs"
echo "🔍 Langfuse Tracing:   http://161.153.9.52:3001"
echo "=========================================================="
sudo docker compose ps
