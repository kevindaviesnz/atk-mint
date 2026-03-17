#!/bin/bash

echo -e "\n==========================================================="
echo -e "⚠️  WARNING: ATK-MINT IS EXPERIMENTAL BETA SOFTWARE ⚠️"
echo -e "==========================================================="
echo -e "By proceeding, you acknowledge that this is an experimental"
echo -e "peer-to-peer network. You accept all risks associated with"
echo -e "compiling, running, and transacting on this blockchain."
echo -e "The creators hold no liability for lost funds, lost data,"
echo -e "or network failures."
echo -e "===========================================================\n"

read -p "Type 'YES' to accept these terms and continue: " user_accept
if [ "$user_accept" != "YES" ]; then
    echo -e "\n❌ Setup aborted. You must type YES to accept the risks.\n"
    exit 1
fi
echo -e "\n✅ Terms accepted. Initializing Fort Knox...\n"

# 1. Generate the Core Network Key (For Server Vault)
if [ ! -f "autarky.key" ]; then
    echo "Generating Master Compiler Key..."
    openssl rand -hex 32 > autarky.key
fi
export AUTARKY_COMPILER_SECRET=$(cat autarky.key)

# 2. Create the Node Environment File
echo "Saving Node environment to node.env..."
cat <<EOF > node.env
HTTP_PORT=3000
P2P_PORT=6000
AUTARKY_COMPILER_SECRET=$AUTARKY_COMPILER_SECRET
EOF
chmod 600 node.env

# 3. Secure Git
if ! grep -q "*.env" .gitignore 2>/dev/null; then
    echo "*.env" >> .gitignore
    echo "autarky.key" >> .gitignore
    echo "wallet.json" >> .gitignore
    echo "✅ Added secrets to .gitignore"
fi

# 4. Initialize Local Wallet (Client Side)
if [ ! -f "wallet.json" ]; then
    echo "Initializing Central Bank wallet..."
    # We pass the --accept-risks flag so mark.js doesn't prompt them a second time
    node mark.js init --accept-risks
fi

echo "--------------------------------------------------"
echo "🚀 Environment Setup Complete"
echo "Node Config: node.env (Deploy this file to your Server)"
echo "Client Wallet: wallet.json (Keep ONLY on your local machine)"
echo "--------------------------------------------------"