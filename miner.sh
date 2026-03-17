#!/bin/bash

# Configuration
VAULT_URL="https://atk-mint-vault.duckdns.org"
LOCAL_NODE="http://localhost:3001"
USER_MESSAGE=${1:-"ATK-Mint Mining Rig"}

echo "========================================="
echo "⛏️  ATK-Mint CONTINUOUS MINING RIG"
echo "💬 Message: $USER_MESSAGE"
echo "🌐 Vault: $VAULT_URL"
echo "========================================="

while true; do
    # 1. Mine the next block using mark.js
    node mark.js commit "$USER_MESSAGE"

    # 2. Check if a block was actually created
    if [ -f pending_block.json ]; then
        echo -e "\n🚀 Transmitting Block to Vault..."
        
        # 3. Push directly to the Global Vault
        RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -d @pending_block.json "$VAULT_URL/mine")
        
        if [[ $RESPONSE == *"Success"* ]]; then
            echo -e "✅ Block Accepted by Vault!"
            
            # 4. Sync the local chain so mark.js knows the new height/nonce
            echo "📡 Syncing local ledger..."
            curl -s "$VAULT_URL/blocks" > chain_local.json
        else
            echo -e "❌ Vault Rejected Block: $RESPONSE"
            echo "Attempting emergency sync..."
            curl -s "$VAULT_URL/blocks" > chain_local.json
        fi

        echo -e "\n♻️  Cooling down (2s)..."
        sleep 2
    else
        echo "🚨 Mining failed. Check your wallet.json and connection."
        break
    fi
done