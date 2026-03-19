const fs = require('fs');
const crypto = require('crypto');

// --- Network Configuration ---
const VAULT_URL = "https://atk-mint-vault.duckdns.org";
const DIFFICULTY = 6;

const command = process.argv[2];

// Helper function to safely read both old (camelCase) and new (snake_case) wallet formats
function getWalletKeys(wallet) {
    return {
        pubKey: wallet.public_key || wallet.publicKey,
        privKey: wallet.private_key || wallet.privateKey
    };
}

if (command === 'init') {
    console.log("Generating new Ed25519 keypair...");
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    
    const wallet = {
        public_key: publicKey.export({ type: 'spki', format: 'der' }).toString('hex'),
        private_key: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('hex')
    };
    
    fs.writeFileSync('wallet.json', JSON.stringify(wallet, null, 2));
    console.log("✅ New wallet created and saved to wallet.json");
    console.log(`Address: ${wallet.public_key}`);

} else if (command === 'address') {
    if (!fs.existsSync('wallet.json')) return console.log("❌ Error: wallet.json not found.");
    const wallet = JSON.parse(fs.readFileSync('wallet.json', 'utf8'));
    const { pubKey } = getWalletKeys(wallet);
    console.log(`Wallet Address: ${pubKey}`);

} else if (command === 'balance') {
    if (!fs.existsSync('wallet.json')) return console.log("❌ Error: wallet.json not found.");
    const wallet = JSON.parse(fs.readFileSync('wallet.json', 'utf8'));
    const { pubKey } = getWalletKeys(wallet);
    
    console.log(`\nWallet Address: ${pubKey}`);
    fetch(`${VAULT_URL}/balance/${pubKey}`)
        .then(res => res.json())
        .then(data => console.log(`Confirmed Balance: ₳ ${data.balance.toLocaleString()} ATK\n`))
        .catch(err => console.log("❌ Error fetching balance from Vault."));

} else if (command === 'commit') {
    if (!fs.existsSync('wallet.json')) return console.log("❌ Error: wallet.json not found.");
    const wallet = JSON.parse(fs.readFileSync('wallet.json', 'utf8'));
    const { pubKey, privKey } = getWalletKeys(wallet);

    (async () => {
        try {
            console.log("📡 Syncing state with Vault...");
            const stateRes = await fetch(`${VAULT_URL}/nonce/${pubKey}`);
            const state = await stateRes.json();

            const block = {
                signer_pubkey: pubKey,
                nonce: state.nonce,
                type: "MINT",
                previousHash: state.previousHash,
                timestamp: Date.now()
            };

            console.log(`⛏️  Mining MINT block (Difficulty: ${DIFFICULTY})...`);
            let mining_nonce = 0;
            let hash = "";
            const target = '0'.repeat(DIFFICULTY);

            while (true) {
                const data = `${block.signer_pubkey}${block.nonce}${block.type}${block.previousHash}${mining_nonce}`;
                hash = crypto.createHash('sha256').update(data).digest('hex');
                if (hash.startsWith(target)) break;
                mining_nonce++;
            }
            block.mining_nonce = mining_nonce;
            block.hash = hash;

            const canonical = [
                block.signer_pubkey, block.nonce, block.mining_nonce,
                "", "", block.type,
                "", "", "", "", "", block.previousHash
            ].join('|');

            const privateKeyObj = crypto.createPrivateKey({ key: Buffer.from(privKey, 'hex'), format: 'der', type: 'pkcs8' });
            block.signature = crypto.sign(null, Buffer.from(canonical), privateKeyObj).toString('hex');

            fs.writeFileSync('pending_block.json', JSON.stringify(block, null, 2));
            console.log("✅ MINT block forged and saved as pending_block.json");
        } catch (e) {
            console.log("❌ CRASH DETAILS:", e);
        }
    })();

} else if (command === 'transfer') {
    const recipient = process.argv[3];
    const amount = process.argv[4];
    
    if (!recipient || !amount) {
        console.log("Usage: node mark.js transfer <recipient> <amount>");
        process.exit(1);
    }

    if (!fs.existsSync('wallet.json')) {
        console.log("❌ Error: wallet.json not found.");
        process.exit(1);
    }
    
    const wallet = JSON.parse(fs.readFileSync('wallet.json', 'utf8'));
    const { pubKey, privKey } = getWalletKeys(wallet);

    (async () => {
        try {
            console.log("📡 Syncing state with Vault...");
            const stateRes = await fetch(`${VAULT_URL}/nonce/${pubKey}`);
            const state = await stateRes.json();

            const block = {
                signer_pubkey: pubKey,
                nonce: state.nonce,
                type: "TRANSFER",
                recipient: recipient,
                amount: parseFloat(amount),
                previousHash: state.previousHash,
                timestamp: Date.now()
            };

            console.log(`⛏️  Mining TRANSFER block (Difficulty: ${DIFFICULTY})...`);
            let mining_nonce = 0;
            let hash = "";
            const target = '0'.repeat(DIFFICULTY);

            while (true) {
                const data = `${block.signer_pubkey}${block.nonce}${block.type}${block.recipient}${block.amount}${block.previousHash}${mining_nonce}`;
                hash = crypto.createHash('sha256').update(data).digest('hex');
                if (hash.startsWith(target)) break;
                mining_nonce++;
            }
            block.mining_nonce = mining_nonce;
            block.hash = hash;

            const canonical = [
                block.signer_pubkey, block.nonce, block.mining_nonce,
                block.recipient || "", block.amount || "", block.type || "",
                "", "", "", "", "", block.previousHash
            ].join('|');

            const privateKeyObj = crypto.createPrivateKey({ key: Buffer.from(privKey, 'hex'), format: 'der', type: 'pkcs8' });
            block.signature = crypto.sign(null, Buffer.from(canonical), privateKeyObj).toString('hex');

            fs.writeFileSync('pending_block.json', JSON.stringify(block, null, 2));
            console.log("✅ TRANSFER block forged and saved as pending_block.json");
        } catch (e) {
            console.log("❌ CRASH DETAILS:", e);
        }
    })();

} else {
    console.log("Usage: node mark.js [init|address|balance|commit|transfer]");
}
