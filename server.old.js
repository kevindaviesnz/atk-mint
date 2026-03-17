const fs = require('fs');
const crypto = require('crypto');

const envPath = fs.existsSync('./node.env') ? './node.env' : './client.env';
require('dotenv').config({ path: envPath });

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors'); // <-- CORS unlocked

const app = express();
app.use(cors());              // <-- CORS applied to the app
app.use(bodyParser.json());

const PORT = process.env.HTTP_PORT || 3000;
const CHAIN_FILE = './chain_3000.json';
const DIFFICULTY = 6; 

const peers = new Set(); 

function loadChain() {
    if (fs.existsSync(CHAIN_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(CHAIN_FILE, 'utf8'));
        } catch (e) {
            console.error("⚠️ Error reading chain file.");
        }
    }
    
    // 👑 THE CENTRAL BANK ALLOCATION
    const genesisBlock = {
        height: 0,
        timestamp: 1710565200000,
        type: "GENESIS",
        signer_pubkey: "2f8cc210d9af359599c930d2de0f8e454668989c64e4a6379484771903a0ebc8",
        nonce: 0,
        mining_nonce: 0,
        vm_result: "Int(100000000000)",
        previousHash: "0",
        hash: "000000GENESIS_HASH_AUTARKY_CENTRAL_BANK_NODE_000000"
    };
    
    const newChain = [genesisBlock];
    saveChain(newChain);
    return newChain;
}

function saveChain(chain) {
    fs.writeFileSync(CHAIN_FILE, JSON.stringify(chain, null, 2));
}

function buildCanonicalString(b) {
    return `${b.signer_pubkey}|${b.nonce}|${b.mining_nonce}|${b.recipient || ''}|${b.amount || ''}|${b.type}|${b.vm_result || ''}|${b.mark_commit || false}|${b.compiler_payload || ''}|${b.compiler_signature || ''}|${b.compiler_pubkey || ''}|${b.previousHash}`;
}

function getBalance(pubkey) {
    let balance = 0;
    const chain = loadChain();
    
    chain.forEach(block => {
        // 💰 Grant the Genesis Allocation
        if (block.type === 'GENESIS' && block.signer_pubkey === pubkey) {
            balance += 100000000000; 
        }
        if (block.type === 'MINT' && block.signer_pubkey === pubkey) {
            balance += 50; 
        }
        if (block.type === 'TRANSFER') {
            if (block.signer_pubkey === pubkey) balance -= Number(block.amount);
            if (block.recipient === pubkey) balance += Number(block.amount);
        }
    });
    return balance;
}

function isValidChain(chainToVerify) {
    const localChain = loadChain();
    if (JSON.stringify(chainToVerify[0]) !== JSON.stringify(localChain[0])) return false;

    for (let i = 1; i < chainToVerify.length; i++) {
        const currentBlock = chainToVerify[i];
        const previousBlock = chainToVerify[i - 1];

        if (currentBlock.previousHash !== previousBlock.hash) return false;

        const dataStr = buildCanonicalString(currentBlock);
        const hash = crypto.createHash('sha256').update(dataStr).digest('hex');
        if (currentBlock.hash !== hash || !hash.startsWith('0'.repeat(DIFFICULTY))) return false;

        let isVerified = false;
        const msgBuffer = Buffer.from(dataStr);
        const sigBuffer = Buffer.from(currentBlock.signature, 'hex');
        const rawPubkey = Buffer.from(currentBlock.signer_pubkey, 'hex');

        try {
            const ed25519Header = Buffer.from([0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00]);
            const wrappedKey = Buffer.concat([ed25519Header, rawPubkey]);
            isVerified = crypto.verify(null, msgBuffer, { key: wrappedKey, format: 'der', type: 'spki' }, sigBuffer);
        } catch (e) {
            try {
                isVerified = crypto.verify(null, msgBuffer, rawPubkey, sigBuffer);
            } catch (innerE) {
                isVerified = false;
            }
        }
        if (!isVerified) return false;
    }
    return true;
}

app.get('/blocks', (req, res) => res.json({ status: "Success", length: loadChain().length, blocks: loadChain() })); 

app.get('/nonce/:pubkey', (req, res) => {
    const chain = loadChain();
    const lastBlock = chain[chain.length - 1];
    let maxNonce = -1;
    chain.forEach(block => {
        if (block.signer_pubkey === req.params.pubkey && block.nonce > maxNonce) maxNonce = block.nonce;
    });
    res.json({ nonce: maxNonce + 1, previousHash: lastBlock.hash });
});

app.get('/balance/:pubkey', (req, res) => {
    res.json({ pubkey: req.params.pubkey, balance: getBalance(req.params.pubkey) });
});

app.post('/register-node', (req, res) => {
    const { nodeUrl } = req.body;
    if (nodeUrl) {
        peers.add(nodeUrl);
        console.log(`🌍 New peer connected: ${nodeUrl}`);
        res.json({ message: "Node added", totalPeers: peers.size });
    } else {
        res.status(400).json({ error: "Please provide a valid nodeUrl" });
    }
});

app.get('/consensus', async (req, res) => {
    let chain = loadChain();
    let longestChain = null;
    let maxLength = chain.length;

    console.log(`⚖️ Checking consensus with ${peers.size} peers...`);
    for (const peer of peers) {
        try {
            const response = await fetch(`${peer}/blocks`);
            if (response.ok) {
                const data = await response.json();
                const peerChain = data.blocks;
                if (peerChain.length > maxLength && isValidChain(peerChain)) {
                    maxLength = peerChain.length;
                    longestChain = peerChain;
                }
            }
        } catch (e) {
            console.log(`⚠️ Peer ${peer} is unresponsive.`);
        }
    }

    if (longestChain) {
        console.log(`🔄 Local chain replaced! New height: ${longestChain.length}`);
        saveChain(longestChain);
        res.json({ message: "Our chain was behind. Replaced with longest chain.", newChain: longestChain });
    } else {
        res.json({ message: "Our chain is authoritative.", chain: chain });
    }
});

app.post('/mine', (req, res) => {
    const payload = req.body;
    let chain = loadChain();
    const lastBlock = chain[chain.length - 1];

    if (payload.previousHash !== lastBlock.hash) return res.status(400).json({ error: "Chain Splice Detected. Please run /consensus." });

    if (payload.type === "TRANSFER") {
        const balance = getBalance(payload.signer_pubkey);
        const transferAmount = Number(payload.amount);
        
        if (!payload.recipient || isNaN(transferAmount) || transferAmount <= 0) {
            return res.status(400).json({ error: "Invalid transfer recipient or amount." });
        }
        if (balance < transferAmount) {
            return res.status(400).json({ error: `Insufficient funds. Balance: ${balance}, Attempted: ${transferAmount}` });
        }
    }

    const dataStr = buildCanonicalString(payload);
    const hash = crypto.createHash('sha256').update(dataStr).digest('hex');
    
    if (!hash.startsWith('0'.repeat(DIFFICULTY))) return res.status(400).json({ error: "Insufficient Work" });

    let isVerified = false;
    const msgBuffer = Buffer.from(dataStr);
    const sigBuffer = Buffer.from(payload.signature, 'hex');
    const rawPubkey = Buffer.from(payload.signer_pubkey, 'hex');

    try {
        const ed25519Header = Buffer.from([0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00]);
        const wrappedKey = Buffer.concat([ed25519Header, rawPubkey]);
        isVerified = crypto.verify(null, msgBuffer, { key: wrappedKey, format: 'der', type: 'spki' }, sigBuffer);
    } catch (e) {
        try {
            isVerified = crypto.verify(null, msgBuffer, rawPubkey, sigBuffer);
        } catch (innerError) {
             console.log("❌ Identity mismatch detected.");
        }
    }

    if (!isVerified) return res.status(400).json({ error: "Cryptographic identity mismatch." });

    payload.hash = hash;
    payload.timestamp = Date.now();
    chain.push(payload);
    saveChain(chain);
    
    console.log(`💎 BLOCK ACCEPTED | Height: ${chain.length - 1} | Type: ${payload.type}`);
    res.status(200).json({ message: "Success!", block: payload });
});

app.listen(PORT, () => console.log(`🛡️ Autarky P2P Node Online | Port: ${PORT} | Difficulty: ${DIFFICULTY}`));