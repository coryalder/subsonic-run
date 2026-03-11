#!/usr/bin/env bash

# Exit on error
set -e

echo "==============================================="
echo " Subsonic Run - Proxmox LXC Creator            "
echo "==============================================="

# Check if running on Proxmox
if ! command -v pct &> /dev/null; then
  echo "Error: This script must be run directly on the Proxmox host."
  exit 1
fi

# Ask for Container ID
read -p "Enter LXC ID (e.g., 200, or leave blank for next available): " CTID
if [ -z "$CTID" ]; then
  CTID=$(pvesh get /cluster/nextid)
  echo "Using ID: $CTID"
fi

# Prompt for Environment Variables
echo ""
echo "Please enter your configuration details:"
read -p "Subsonic URL (e.g., https://music.example.com): " SUBSONIC_URL
read -p "Subsonic Username: " SUBSONIC_USER
read -s -p "Subsonic Password: " SUBSONIC_PASS
echo ""
echo ""

# Setup template
echo "Checking for latest Debian 12 template..."
pveam update > /dev/null
TEMPLATE_SYSTEM_PATH=$(pveam available -section system | grep "debian-12-standard" | sort -V | tail -n 1 | awk '{print $2}')

if [ -z "$TEMPLATE_SYSTEM_PATH" ]; then
    echo "Could not find a Debian 12 template on the Proxmox servers."
    exit 1
fi

TEMPLATE_FILENAME=$(basename "$TEMPLATE_SYSTEM_PATH")
STORAGE="local"

if ! pveam list $STORAGE | grep -q "$TEMPLATE_FILENAME"; then
  echo "Downloading $TEMPLATE_FILENAME to local storage..."
  pveam download $STORAGE "$TEMPLATE_SYSTEM_PATH"
fi

# Create LXC Container
echo ""
echo "Creating LXC Container $CTID..."
pct create $CTID ${STORAGE}:vztmpl/${TEMPLATE_FILENAME} \
  --hostname subsonic-run \
  --net0 name=eth0,bridge=vmbr0,ip=dhcp \
  --memory 1024 \
  --cores 2 \
  --unprivileged 1 \
  --features nesting=1 \
  --onboot 1

# Start LXC Container
echo "Starting container $CTID..."
pct start $CTID

echo "Waiting for container to boot and acquire an IP address..."
sleep 10

# Helper function to run commands inside the container
cexec() {
  pct exec $CTID -- bash -c "$1"
}

# Install dependencies inside container
echo ""
echo "[1/4] Installing system dependencies (git, curl, ffmpeg)..."
cexec "apt-get update && apt-get upgrade -y"
cexec "apt-get install -y curl git ffmpeg"

echo ""
echo "[2/4] Installing Node.js 20.x..."
cexec "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -"
cexec "apt-get install -y nodejs"

# Clone and setup the app
APP_DIR="/opt/subsonic-run"
echo ""
echo "[3/4] Cloning the repository and setting up environment..."
cexec "git clone https://github.com/coryalder/subsonic-run.git $APP_DIR"

cexec "cat <<EOF > $APP_DIR/.env
SUBSONIC_URL=$SUBSONIC_URL
SUBSONIC_USER=$SUBSONIC_USER
SUBSONIC_PASS=$SUBSONIC_PASS
EOF"

echo ""
echo "[4/4] Installing npm dependencies and building (this may take a minute)..."
cexec "cd $APP_DIR && npm install"
cexec "cd $APP_DIR && npm run build"

# Setup systemd service
echo ""
echo "Setting up systemd service..."
cexec "cat <<EOF > /etc/systemd/system/subsonic-run.service
[Unit]
Description=Subsonic Run App
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/npm run start
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF"

cexec "systemctl daemon-reload"
cexec "systemctl enable subsonic-run"
cexec "systemctl start subsonic-run"

# Get IP Address
IP=$(pct exec $CTID -- ip -4 -br addr show eth0 | awk '{print $3}' | cut -d/ -f1)

echo ""
echo "==============================================="
echo " Installation Complete! "
echo "==============================================="
echo "Container ID: $CTID"
if [ -n "$IP" ]; then
    echo "IP Address: $IP"
    echo "The app should be accessible at http://$IP:3000"
else
    echo "Could not detect the IP address."
    echo "You can check it using: pct exec $CTID -- ip a"
fi
