const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// CONFIGURATION
const PORT = 3001; // Using 3001 so it doesn't clash if you run another node
const CHAIN_FILE = path.join(__dirname, 'chain_local.json');

/**
 * Loads the local blockchain state.
 * If no chain exists, it creates the ATK-Mint Genesis Block.
 */
function loadChain() {
    if (fs.existsSync(CHAIN_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(CHAIN_FILE, 'utf8'));
        } catch (e) {
            console.error("Error reading local chain file, starting fresh.");
        }
    }
    
    // THE ATK-MINT GENESIS BLOCK
    const genesisBlock = {
        height: 0,
        timestamp: 1710565200000,
        type: "GENESIS",
        signer_pubkey: "302a300506032b657003210085187c9322b928c2df50eeebaa39be0f787b3d099de5a22d51011175bf8a6656",
        nonce: 0,
        vm_result: "Int(100000000000)", // The 100 Billion Treasury
        previousHash: "0",
        hash: "000000GENESIS_HASH_ATK_MINT_CENTRAL_BANK",
        difficulty: 6
    };
    
    const newChain = [genesisBlock];
    saveChain(newChain);
    return newChain;
}

function saveChain(chain) {
    fs.writeFileSync(CHAIN_FILE, JSON.stringify(chain, null, 2));
}

/**
 * Calculates balance by scanning the entire ledger.
 * Now recognizes 'MINT' blocks for the ₳ 500 rewards.
 */
function getBalance(pubkey) {
    let balance = 0;
    const chain = loadChain();
    
    chain.forEach(block => {
        // 1. Check for Minting/Genesis (Money Creation)
        if ((block.type === 'GENESIS' || block.type === 'MINT') && block.signer_pubkey === pubkey) {
            const match = block.vm_result && block.vm_result.match(/Int\((-?\d+)\)/);
            if (match) balance += Number(match[1]);
        }
        
        // 2. Check for Transfers (Money Movement)
        if (block.type === 'TRANSFER') {
            const amount = Number(block.amount);
            if (block.signer_pubkey === pubkey) balance -= amount;
            if (block.recipient === pubkey) balance += amount;
        }
    });
    return balance;
}

/**
 * Helper to ensure the hash matches exactly what was signed.
 */
function buildCanonicalString(b) {
    return [
        String(b.signer_pubkey || ""), String(b.nonce ?? "0"), String(b.mining_nonce ?? "0"),
        String(b.recipient || ""), String(b.amount || ""), String(b.type || ""),
        String(b.vm_result || ""), String(b.mark_commit ?? "false"),
        String(b.compiler_payload_raw || ""), String(b.compiler_signature || ""),
        String(b.compiler_pubkey || ""), String(b.previousHash || "0")
    ].join('|');
}

// --- API ROUTES ---

// Get full ledger
app.get('/blocks', (req, res) => {
    res.json({ status: "Success", length: loadChain().length, blocks: loadChain() });
});

// Check current network difficulty
app.get('/difficulty', (req, res) => {
    const chain = loadChain();
    // Simplified: Static difficulty of 6 for local testing
    res.json({ difficulty: 6 });
});

// Check balance of any public key
app.get('/balance/:pubkey', (req, res) => {
    res.json({ 
        pubkey: req.params.pubkey, 
        balance: getBalance(req.params.pubkey),
        symbol: "₳"
    });
});

// Get next valid nonce for a wallet
app.get('/nonce/:pubkey', (req, res) => {
    const chain = loadChain();
    let maxNonce = -1;
    chain.forEach(b => {
        if (b.signer_pubkey === req.params.pubkey && b.nonce > maxNonce) {
            maxNonce = b.nonce;
        }
    });
    res.json({ 
        nonce: maxNonce + 1, 
        previousHash: chain[chain.length - 1].hash 
    });
});

/**
 * Receive and verify a mined block.
 */
app.post('/mine', (req, res) => {
    const block = req.body;
    let chain = loadChain();

    // 1. Verification: Correct Chain sequence?
    if (block.previousHash !== chain[chain.length - 1].hash) {
        return res.status(400).json({ error: "Chain Splice Detected. Sync required." });
    }

    // 2. Verification: Proof of Work?
    const dataStr = buildCanonicalString(block);
    const hash = crypto.createHash('sha256').update(dataStr).digest('hex');
    if (!hash.startsWith('000000')) {
        return res.status(400).json({ error: "Insufficient work (PoW failed)." });
    }

    // 3. Verification: Cryptographic Signature?
    try {
        const pubKeyObj = crypto.createPublicKey({
            key: Buffer.from(block.signer_pubkey, 'hex'),
            format: 'der',
            type: 'spki'
        });
        const isVerified = crypto.verify(null, Buffer.from(dataStr), pubKeyObj, Buffer.from(block.signature, 'hex'));
        if (!isVerified) return res.status(400).json({ error: "Invalid signature." });
    } catch (e) {
        return res.status(400).json({ error: "Signature verification error." });
    }

    // Block is Valid!
    block.hash = hash;
    block.timestamp = Date.now();
    block.height = chain.length;
    
    chain.push(block);
    saveChain(chain);
    
    console.log(`✅ Local Block #${block.height} accepted!`);
    res.json({ message: "Success!", block });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`-----------------------------------------`);
    console.log(`🛡️  ATK-Mint LOCAL SHADOW NODE ONLINE`);
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log(`📁 Chain: ${CHAIN_FILE}`);
    console.log(`-----------------------------------------`);
});