const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config();

// --- CONFIGURATION ---
const VAULT_URL = "https://atk-mint-vault.duckdns.org";
const WALLET_FILE = path.join(__dirname, 'wallet.json');

/**
 * THE CRITICAL SYNC: This string must match server.js exactly.
 * Order: Pubkey | Nonce | MiningNonce | Recipient | Amount | Type | VM | Mark | Message | Payload | Sig | CompPub | PrevHash
 */
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
        String(b.message || ""),             // Position 9
        String(b.compiler_payload_raw || ""), 
        String(b.compiler_signature || ""),
        String(b.compiler_pubkey || ""), 
        String(b.previousHash || "0")         // Position 13
    ].join('|');
}

/**
 * Fetches the current network state from the Cloud Vault.
 */
async function getNetworkState(pubkey) {
    try {
        console.log("📡 Syncing state with Vault...");
        const response = await fetch(`${VAULT_URL}/nonce/${pubkey}`);
        if (!response.ok) throw new Error("Vault unreachable");
        return await response.json();
    } catch (e) {
        console.error("❌ Network Sync Failed:", e.message);
        process.exit(1);
    }
}

/**
 * Proof of Work: Finds a hash starting with 000000.
 */
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

/**
 * Main Mining Execution
 */
async function main() {
    const message = process.argv || "ATK-Mint Cloud Block";

    if (!fs.existsSync(WALLET_FILE)) {
        console.log("❌ wallet.json not found.");
        return;
    }

    const wallet = JSON.parse(fs.readFileSync(WALLET_FILE, 'utf8'));
    const state = await getNetworkState(wallet.publicKey);

    // Construct the Block Template
    let block = {
        signer_pubkey: wallet.publicKey,
        nonce: state.nonce,
        mining_nonce: 0,
        recipient: "",
        amount: 0,
        type: "MINT",
        vm_result: "Int(500)", // Standard Mint Reward
        mark_commit: "false",
        message: message,
        previousHash: state.previousHash,
        timestamp: Date.now()
    };

    // 1. Solve the PoW Puzzle
    const minedBlock = mineBlock(block);

    // 2. Sign the Result (Using internal Node crypto)
    // Note: This assumes your wallet.json contains the privateKey 
    // If encrypted, you would add decryption logic here.
    const dataToSign = buildCanonicalString(minedBlock);
    const privateKey = crypto.createPrivateKey({
        key: Buffer.from(wallet.privateKey, 'hex'),
        format: 'der',
        type: 'pkcs8'
    });

    minedBlock.signature = crypto.sign(null, Buffer.from(dataToSign), privateKey).toString('hex');

    // 3. Save for the miner.sh to transmit
    fs.writeFileSync('pending_block.json', JSON.stringify(minedBlock, null, 2));
    console.log(`✅ MINT block forged and saved as pending_block.json`);
}

main();