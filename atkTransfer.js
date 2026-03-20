const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = 3000; 
const CHAIN_FILE = path.join(__dirname, 'chain_local.json');

function loadChain() {
    if (fs.existsSync(CHAIN_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(CHAIN_FILE, 'utf8'));
        } catch (e) {
            console.error("❌ Error reading chain file.");
        }
    }
    
    const genesisBlock = {
        height: 0,
        timestamp: 1710565200000,
        type: "GENESIS",
        signer_pubkey: "302a300506032b6570032100166c1ef3780ee130bfc07e42ca4af7c56a319c656ce787a934928f0b62c4602d",
        nonce: 0,
        vm_result: "Int(100000000000)", 
        previousHash: "0",
        hash: "000000GENESIS_HASH_AUTARKY_CENTRAL_BANK_NODE_000000",
        difficulty: 6,
        message: "The Era of Autarky Begins"
    };
    
    const newChain = [genesisBlock];
    saveChain(newChain);
    return newChain;
}

function saveChain(chain) {
    fs.writeFileSync(CHAIN_FILE, JSON.stringify(chain, null, 2));
}

function getBalance(pubkey) {
    let balance = BigInt(0);
    const chain = loadChain();
    const targetKey = String(pubkey).trim();

    chain.forEach(block => {
        const blockSigner = String(block.signer_pubkey || "").trim();

        if ((block.type === 'GENESIS' || block.type === 'MINT') && blockSigner === targetKey) {
            if (block.type === 'GENESIS' && String(block.vm_result).includes("100000000000")) {
                balance += BigInt("100000000000");
            } else {
                const match = block.vm_result && String(block.vm_result).match(/Int\(([^)]+)\)/);
                if (match) balance += BigInt(match);
            }
        }
        
        if (block.type === 'TRANSFER') {
            const amount = BigInt(block.amount || 0);
            const recipientKey = String(block.recipient || "").trim();
            if (blockSigner === targetKey) balance -= amount;
            if (recipientKey === targetKey) balance += amount;
        }
    });
    return balance.toString(); // Return as string to avoid JSON precision loss
}

function buildCanonicalString(b) {
    return [
        String(b.signer_pubkey || ""), String(b.nonce ?? "0"), String(b.mining_nonce ?? "0"),
        String(b.recipient || ""), String(b.amount || ""), String(b.type || ""),
        String(b.vm_result || ""), String(b.mark_commit ?? "false"),
        String(b.compiler_payload_raw || ""), String(b.compiler_signature || ""),
        String(b.compiler_pubkey || ""), String(b.previousHash || "0")
    ].join('|');
}

app.get('/blocks', (req, res) => {
    const chain = loadChain();
    res.json({ status: "Success", length: chain.length, blocks: chain });
});

app.get('/balance/:pubkey', (req, res) => {
    res.json({ 
        pubkey: req.params.pubkey, 
        balance: getBalance(req.params.pubkey),
        symbol: "₳"
    });
});

app.get('/nonce/:pubkey', (req, res) => {
    const chain = loadChain();
    let maxNonce = -1;
    chain.forEach(b => {
        if (String(b.signer_pubkey).trim() === String(req.params.pubkey).trim() && b.nonce > maxNonce) {
            maxNonce = b.nonce;
        }
    });
    res.json({ nonce: maxNonce + 1, previousHash: chain[chain.length - 1].hash });
});

app.post('/mine', (req, res) => {
    const block = req.body;
    let chain = loadChain();
    if (block.previousHash !== chain[chain.length - 1].hash) return res.status(400).json({ error: "Sync required." });
    
    const dataStr = buildCanonicalString(block);
    const hash = crypto.createHash('sha256').update(dataStr).digest('hex');
    
    if (!hash.startsWith('000000')) return res.status(400).json({ error: "PoW check failed." });

    try {
        const pubKeyObj = crypto.createPublicKey({
            key: Buffer.from(block.signer_pubkey, 'hex'),
            format: 'der',
            type: 'spki'
        });
        const isVerified = crypto.verify(null, Buffer.from(dataStr), pubKeyObj, Buffer.from(block.signature, 'hex'));
        if (!isVerified) return res.status(400).json({ error: "Invalid signature." });
    } catch (e) { return res.status(400).json({ error: "Crypto error." }); }

    block.hash = hash;
    block.timestamp = Date.now();
    block.height = chain.length;
    chain.push(block);
    saveChain(chain);
    console.log(`✅ Block accepted!`);
    res.json({ message: "Success!", block });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🛡️  ATK-Mint VAULT ONLINE (Port ${PORT})`);
});