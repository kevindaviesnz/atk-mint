#!/bin/bash

echo "🛠️  Initializing Autarky v3 Air-Gapped Environment..."

# --------------------------------------------------
# 0. OS Detection & Engine Deployment (into ./bin/)
# --------------------------------------------------
# This ensures 'mark.js' always finds the engine at bin/atk
echo "Detecting Operating System..."
OS_TYPE=$(uname -s)

# Ensure the bin directory exists
mkdir -p bin

if [ "$OS_TYPE" == "Darwin" ]; then
    echo "🍎 Mac detected. Deploying atk-mac -> bin/atk"
    if [ -f "bin/atk-mac" ]; then
        cp bin/atk-mac bin/atk
        chmod +x bin/atk
        echo "✅ Sovereign Engine (Mac) is ready in bin/"
    else
        echo "⚠️  Warning: bin/atk-mac not found!"
    fi
elif [ "$OS_TYPE" == "Linux" ]; then
    echo "🐧 Linux detected. Deploying atk-linux -> bin/atk"
    if [ -f "bin/atk-linux" ]; then
        cp bin/atk-linux bin/atk
        chmod +x bin/atk
        echo "✅ Sovereign Engine (Linux) is ready in bin/"
    else
        echo "⚠️  Warning: bin/atk-linux not found!"
    fi
fi

# --------------------------------------------------
# 1. Handle Sovereign Secret (The Node's Identity)
# --------------------------------------------------
if [ -z "$AUTARKY_COMPILER_SECRET" ]; then
    if [ ! -f "autarky.key" ]; then
        echo "No secret found. Generating new 32-byte sovereign secret..."
        export AUTARKY_COMPILER_SECRET=$(openssl rand -hex 32)
        echo "$AUTARKY_COMPILER_SECRET" | xxd -r -p > autarky.key
    else
        echo "Found 'autarky.key' on disk. Loading..."
        export AUTARKY_COMPILER_SECRET=$(xxd -p -c 32 < autarky.key)
    fi
fi

# --------------------------------------------------
# 2. Derive compiler.pub (Public Network Anchor)
# --------------------------------------------------
if [ ! -f "compiler.pub" ]; then
    echo "Deriving public key..."
    HEADER="302e020100300506032b657004220420"
    echo "${HEADER}${AUTARKY_COMPILER_SECRET}" | xxd -r -p > temp_priv.der
    openssl pkey -inform DER -in temp_priv.der -out temp_priv.pem 2>/dev/null
    openssl pkey -in temp_priv.pem -pubout -outform DER 2>/dev/null | tail -c 32 | xxd -p -c 32 > compiler.pub
    rm temp_priv.der temp_priv.pem
fi

# --------------------------------------------------
# 3. Handle WALLET_PASS (For the Local Client)
# --------------------------------------------------
if [ -z "$WALLET_PASS" ]; then
    echo "Generating high-entropy WALLET_PASS..."
    export WALLET_PASS=$(openssl rand -base64 24)
fi

# --------------------------------------------------
# 4. Create Air-Gapped Environment Files
# --------------------------------------------------
echo "Saving Node environment to node.env..."
echo "AUTARKY_COMPILER_SECRET=$AUTARKY_COMPILER_SECRET" > node.env
chmod 600 node.env

echo "Saving Client environment to client.env..."
echo "WALLET_PASS=$WALLET_PASS" > client.env
chmod 600 client.env

# Safety: Ensure sensitive files are never committed to Git
if ! grep -q "*.env" .gitignore 2>/dev/null; then
    echo "*.env" >> .gitignore
    echo "autarky.key" >> .gitignore
    echo "wallet.json" >> .gitignore
    echo "✅ Added protection to .gitignore"
fi

# --------------------------------------------------
# 5. Initialize Wallets (Client Side)
# --------------------------------------------------
if [ ! -f "wallet.json" ]; then
    echo "Initializing wallet..."
    env WALLET_PASS="$WALLET_PASS" node mark.js init
fi

echo "--------------------------------------------------"
echo "🚀 Air-Gapped Setup Complete"
echo "OS Type:    $OS_TYPE"
echo "Public Key: $(cat compiler.pub 2>/dev/null || echo 'ERROR')"
echo "Engine:     bin/atk"
echo "--------------------------------------------------"