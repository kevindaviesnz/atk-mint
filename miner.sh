#!/bin/bash

# --- Configuration ---
# Your secure DuckDNS Cloud Vault
VAULT_URL="https://atk-mint-vault.duckdns.org"

# SMART PATH: This line detects the folder where the script is actually located.
PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE}" )" && pwd )"

# Default message if none is provided as an argument
USER_MESSAGE=${1:-"ATK-Mint Cloud Miner"}

# Ensure we are in the correct folder to access mark.js and wallet.json
cd "$PROJECT_DIR" || { echo "❌ Directory not found"; exit 1; }

echo "========================================="
echo "⛏️  ATK-Mint CONTINUOUS CLOUD RIG"
echo "💬 Message: $USER_MESSAGE"
echo "🌐 Vault: $VAULT_URL"
echo "📂 Path: $PROJECT_DIR"
echo "========================================="

while true; do
    # 1. Mine the next block using mark.js (MINT type)
    echo "⚒️  Starting mining attempt..."
    node mark.js commit "$USER_MESSAGE"

    # 2. Check if a block was actually created (pending_block.json)
    if [ -f pending_block.json ]; then
        echo -e "\n🚀 Transmitting Block to Vault..."
        
        # 3. Push the mined block to the /mine endpoint (Aligned with server.js)
        RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -d @pending_block.json "$VAULT_URL/mine")
        
        # 4. Check if the Vault responded with "Success"
        # server.js returns: res.json({ message: "Success!", block });
        if [[ $RESPONSE == *"Success"* ]]; then
            echo -e "✅ Block Accepted! Coins added to wallet."
        else
            echo -e "❌ Vault Rejected Block: $RESPONSE"
        fi

        # Clean up the pending block so we don't accidentally double-submit
        rm -f pending_block.json

        echo -e "\n♻️  Cooling down (2s)..."
        sleep 2
    else
        echo "🚨 Mining failed to produce a block. Check connection or wallet.json."
        # Wait 5 seconds before retrying to prevent a rapid crash-loop
        sleep 5
    fi
done