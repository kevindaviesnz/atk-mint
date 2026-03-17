#!/bin/bash

# ==============================================================================
# Autarky Central Bank Node - Secure Deployment Script
# ==============================================================================

# ⚠️ UPDATE THESE VARIABLES WITH YOUR ACTUAL SERVER DETAILS
SERVER_USER="root"
SERVER_IP="23.95.216.127"
DEST_DIR="/opt/atk-mint-node"

echo "🚀 Initiating secure air-gapped deployment to $SERVER_IP..."

# Execute rsync over SSH with strict exclusion rules
rsync -avzP \
  --exclude 'client.env' \
  --exclude '*.key' \
  --exclude 'bin/atk' \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '.DS_Store' \
  --exclude 'setup.sh' \
  --exclude 'deploy.sh' \
  ./ $SERVER_USER@$SERVER_IP:$DEST_DIR/

echo "\n✅ Deployment payload delivered securely to $DEST_DIR."
echo "🔒 client.env and private keys remain air-gapped on this machine."