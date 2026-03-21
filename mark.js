const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ quiet: true }); 

const VAULT_URL = "https://atk-mint-vault.duckdns.org";
const WALLET_FILE = path.join(__dirname, 'wallet.json');


// --- ADD THIS FUNCTION ---
function initWallet() {
    if (fs.existsSync(WALLET_FILE)) {
        console.log("ℹ️  wallet.json already exists. Skipping generation.");
        return;
    }
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
        namedCurve: 'secp256k1',
        publicKeyEncoding: { type: 'spki', format: 'der' },
        privateKeyEncoding: { type: 'pkcs8', format: 'der' }
    });
    const wallet = {
        privateKey: privateKey.toString('hex'),
        publicKey: publicKey.toString('hex')
    };
    fs.writeFileSync(WALLET_FILE, JSON.stringify(wallet, null, 2));
    console.log("✅ New identity generated and saved to wallet.json");
}

function buildCanonicalString(b) {
    return [
        String(b.signer_pubkey || ""), 
        String(b.nonce ?? "0"), 
        String(b.mining_nonce ?? "0"),
        String(b.recipient || ""), 
        String(b.amount || ""), 
        String(b.type || ""),
        String(b.vm_result || ""), 
        String(b.mark_commit ?? "false"),
        String(b.message || ""),             
        String(b.compiler_payload_raw || ""), 
        String(b.compiler_signature || ""),
        String(b.compiler_pubkey || ""), 
        String(b.previousHash || "0")         
    ].join('|');
}

async function getNetworkState(pubkey) {
    try {
        const response = await fetch(`${VAULT_URL}/nonce/${pubkey}`);
        if (!response.ok) throw new Error("Vault unreachable");
        return await response.json();
    } catch (e) {
        console.error("❌ Network Sync Failed:", e.message);
        process.exit(1);
    }
}

function mineBlock(block) {
    let hash = "";
    console.log(`⛏️  Mining MINT block (Difficulty: 6)...`);
    
    while (!hash.startsWith('000000')) {
        block.mining_nonce++;
        const dataStr = buildCanonicalString(block);
        hash = crypto.createHash('sha256').update(dataStr).digest('hex');
    }
    
    block.hash = hash;
    return block;
}

// --- 📉 MONETARY POLICY HELPER ---
function getMiningReward(height) {
    const INITIAL_REWARD = 50000; // 50k ATK
    const HALVING_INTERVAL = 210000; 
    const halvings = Math.floor(height / HALVING_INTERVAL);
    
    // Reward halves every 210,000 blocks
    let reward = INITIAL_REWARD / Math.pow(2, halvings);
    return Math.floor(reward); 
}

// --- ⛏️ THE MINING ENGINE ---
async function mineCommit(message) {
    if (!fs.existsSync(WALLET_FILE)) return console.log("❌ wallet.json not found. Run 'init' first.");
    const wallet = JSON.parse(fs.readFileSync(WALLET_FILE, 'utf8'));

    console.log("📡 Syncing with Vault...");
    const state = await getNetworkState(wallet.publicKey);
    
    // Calculate the reward for the NEXT block being mined
    const nextHeight = state.height + 1;
    const currentReward = getMiningReward(nextHeight);

    let block = {
        signer_pubkey: wallet.publicKey,
        nonce: state.nonce,
        mining_nonce: 0,
        type: "MINT",
        vm_result: `Int(${currentReward})`, // Dynamic reward (starts at 50,000)
        message: message || "ATK-Mint Cloud Block",
        mark_commit: true,
        previousHash: state.previousHash,
        timestamp: Date.now()
    };

    console.log(`\n⛏️  Mining Block #${nextHeight}...`);
    console.log(`💰 Target Reward: ₳ ${currentReward} ATK`);
    
    // 1. Solve the Proof of Work
    const minedBlock = mineBlock(block); 

    // 2. Sign the completed block
    const dataToSign = buildCanonicalString(minedBlock);
    const privateKey = crypto.createPrivateKey({
        key: Buffer.from(wallet.privateKey, 'hex'),
        format: 'der',
        type: 'pkcs8'
    });
    minedBlock.signature = crypto.sign(null, Buffer.from(dataToSign), privateKey).toString('hex');

    // 3. Transmit to Racknerd Vault
    console.log("🚀 Submitting block to network...");
    try {
        const response = await fetch(`${VAULT_URL}/blocks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(minedBlock)
        });

        const result = await response.json();

        if (response.ok) {
            console.log(`✅ SUCCESS! Block #${result.height} accepted.`);
            console.log(`🔗 Hash: ${minedBlock.hash.substring(0, 16)}...`);
        } else {
            console.error(`❌ Vault Rejected Block: ${JSON.stringify(result)}`);
        }
    } catch (e) {
        console.error(`❌ Network Error: ${e.message}`);
    }
}

async function checkBalance() {
    // Check if an address was provided in the command (process.argv)
    // If not, fall back to the local wallet.json
    const targetAddress = process.argv[3] || (fs.existsSync(WALLET_FILE) ? JSON.parse(fs.readFileSync(WALLET_FILE, 'utf8')).publicKey : null);
    if (!targetAddress) {
        return console.log("❌ No address provided and no wallet.json found.");
    }
    
    try {
        const res = await fetch(`${VAULT_URL}/balance/${targetAddress.trim()}`);
        const data = await res.json();
        
        // We use targetAddress here so the printout matches what you asked for
        console.log(`\n💳 Wallet Address: ${targetAddress}`);
        console.log(`💰 Confirmed Balance: ₳ ${data.balance} ATK\n`);
    } catch (e) {
        console.log("❌ Network Error:", e.message);
    }
}

function showAddress() {
    if (!fs.existsSync(WALLET_FILE)) return console.log("❌ wallet.json not found.");
    const wallet = JSON.parse(fs.readFileSync(WALLET_FILE, 'utf8'));
    console.log(`\n🔑 Your Public Key:\n${wallet.publicKey}\n`);
}

async function transferATK(recipient, amount) {
    if (!fs.existsSync(WALLET_FILE)) return console.log("❌ wallet.json not found.");
    const wallet = JSON.parse(fs.readFileSync(WALLET_FILE, 'utf8'));
    const state = await getNetworkState(wallet.publicKey);

    // 1. Create the base block
    let block = {
        signer_pubkey: wallet.publicKey,
        nonce: state.nonce,
        mining_nonce: 0, // Reset for the new solve
        recipient: recipient.trim(),
        amount: amount.toString(),
        type: "TRANSFER",
        previousHash: state.previousHash,
        timestamp: Date.now()
    };

    // 2. 🔥 THE FIX: Mine the transaction to satisfy the Vault's Difficulty 6
    console.log("⛏️  Mining Proof-of-Work for transaction...");
    const minedBlock = mineBlock(block); 

    // 3. Sign the fully mined block
    const dataToSign = buildCanonicalString(minedBlock);
    const privateKey = crypto.createPrivateKey({
        key: Buffer.from(wallet.privateKey, 'hex'),
        format: 'der',
        type: 'pkcs8'
    });
    minedBlock.signature = crypto.sign(null, Buffer.from(dataToSign), privateKey).toString('hex');

    // 4. Transmit the valid block
    console.log(`🚀 Transmitting ₳ ${amount} to ${recipient.substring(0,10)}...`);
    
    try {
        const response = await fetch(`${VAULT_URL}/blocks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(minedBlock)
        });

        const result = await response.json();
        if (response.ok) {
            console.log(`✅ Sent! Block #${result.height} accepted by Vault.`);
        } else {
            console.log(`❌ Vault Rejected Transfer: ${JSON.stringify(result)}`);
        }
    } catch (e) {
        console.log(`❌ Network Error: ${e.message}`);
    }
}

// --- CLI ROUTER ---
const command = (process.argv[2] || "").trim();
const message = process.argv[3] || "ATK-Mint Cloud Block";

switch (command) {
    case 'init':
        initWallet();
        break;
    case 'send':
    case 'transfer':
        transferATK(process.argv[3], process.argv[4]);
        break;
    case 'commit':
    case 'mine':
        mineCommit(process.argv[0] || "Cloud Block");
        break;
    case 'balance':
        checkBalance();
        break;
    case 'address':
        showAddress();
        break;
    default:
        console.log(`❌ Invalid command: '${command}'. Use init, send, balance, or mine.`);
}