#!/bin/bash

# --- Configuration ---
VAULT_URL="https://atk-mint-vault.duckdns.org"
PROJECT_DIR="/Users/kevindavies/Development/AI/atk-mint"
USER_MESSAGE=${1:-"ATK-Mint Mining Rig"}

# Ensure we are in the correct folder to access mark.js and wallet.json
cd "$PROJECT_DIR" || exit

echo "========================================="
echo "⛏️  ATK-Mint CONTINUOUS MINING RIG"
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
        
        # 3. Push the mined block to the Global Vault
        RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -d @pending_block.json "$VAULT_URL/submit")
        
        if [[ $RESPONSE == *"success\":true"* ]]; then
            echo -e "✅ Block Accepted! Coins added to wallet."
        else
            echo -e "❌ Vault Rejected Block: $RESPONSE"
        fi

        # Clean up the pending block so we don't double-submit
        rm -f pending_block.json

        echo -e "\n♻️  Cooling down (2s)..."
        sleep 2
    else
        echo "🚨 Mining failed to produce a block. Check your connection."
        # Wait a bit before retrying to prevent a crash loop
        sleep 5
    fi
done