const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ quiet: true }); 

const VAULT_URL = "https://atk-mint-vault.duckdns.org";
const WALLET_FILE = path.join(__dirname, 'wallet.json');

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

async function mineCommit(message) {
    if (!fs.existsSync(WALLET_FILE)) {
        console.log("❌ wallet.json not found.");
        return;
    }
    
    console.log("📡 Syncing state with Vault...");
    const wallet = JSON.parse(fs.readFileSync(WALLET_FILE, 'utf8'));
    const state = await getNetworkState(wallet.publicKey);

    let block = {
        signer_pubkey: wallet.publicKey,
        nonce: state.nonce,
        mining_nonce: 0,
        recipient: "",
        amount: 0,
        type: "MINT",
        vm_result: "Int(500)",
        mark_commit: "false",
        message: message,
        previousHash: state.previousHash,
        timestamp: Date.now()
    };

    const minedBlock = mineBlock(block);

    const dataToSign = buildCanonicalString(minedBlock);
    const privateKey = crypto.createPrivateKey({
        key: Buffer.from(wallet.privateKey, 'hex'),
        format: 'der',
        type: 'pkcs8'
    });

    minedBlock.signature = crypto.sign(null, Buffer.from(dataToSign), privateKey).toString('hex');

    fs.writeFileSync('pending_block.json', JSON.stringify(minedBlock, null, 2));
    console.log(`✅ MINT block forged and saved as pending_block.json`);
}

async function checkBalance() {
    if (!fs.existsSync(WALLET_FILE)) return console.log("❌ wallet.json not found.");
    const wallet = JSON.parse(fs.readFileSync(WALLET_FILE, 'utf8'));
    
    try {
        const res = await fetch(`${VAULT_URL}/balance/${wallet.publicKey}`);
        const data = await res.json();
        console.log(`\n💳 Wallet Address: ${wallet.publicKey}`);
        console.log(`💰 Confirmed Balance: ₳ ${data.balance} ATK\n`);
    } catch (e) {
        console.log("❌ Real Error:", e.message);
    }
}

function showAddress() {
    if (!fs.existsSync(WALLET_FILE)) return console.log("❌ wallet.json not found.");
    const wallet = JSON.parse(fs.readFileSync(WALLET_FILE, 'utf8'));
    console.log(`\n🔑 Your Public Key:\n${wallet.publicKey}\n`);
}

// --- CLI ROUTER ---
const command = (process.argv[2] || "").trim();
const message = process.argv[3] || "ATK-Mint Cloud Block";

switch (command) {
    case 'commit':
        mineCommit(message);
        break;
    case 'balance':
        checkBalance();
        break;
    case 'address':
        showAddress();
        break;
    default:
        console.log(`❌ Invalid mark.js command: '${command}'. Use balance, address, or commit.`);
}
