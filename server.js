const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const crypto = require('crypto');
const WebSocket = require('ws');
const nacl = require('tweetnacl');

// Enable BigInt serialization for JSON
BigInt.prototype.toJSON = function() { return this.toString(); };

const HTTP_PORT = process.env.HTTP_PORT || 3000;
const P2P_PORT = process.env.P2P_PORT || 6000;
const CHAIN_FILE = `./chain_${HTTP_PORT}.json`;

// --- The "Hack Killer" Constants ---
const INITIAL_DIFFICULTY = 8; // 🛡️ Hard wall for hackers (Network Base)
const MAX_REORG_DEPTH = 10; 
const STAKE_DIFFICULTY_MULTIPLIER = 10000000000n; // 🛡️ 10 Billion ATK per reduction

const app = express();
app.use(bodyParser.json());
let sockets = [];
let mineQueue = Promise.resolve();

function buildCanonicalString(b) {
    return `${b.signer_pubkey}|${b.nonce}|${b.mining_nonce}|${b.recipient || ''}|${b.amount || ''}|${b.type}|${b.vm_result || ''}|${b.mark_commit || false}|${b.compiler_payload_raw || ''}|${b.compiler_signature || ''}|${b.compiler_pubkey || ''}|${b.difficulty || INITIAL_DIFFICULTY}`;
}

const GENESIS_ADDRESS = '302a300506032b657003210083411777f268293212a776deea48c0212d08b43bd05dfb27d7b81e9417037f67'; 

const GENESIS_BLOCK = {
    height: 0,
    timestamp: 1710565200000,
    type: 'GENESIS',
    signer_pubkey: GENESIS_ADDRESS,
    nonce: 0,
    mining_nonce: 0,
    vm_result: 'Int(100000000000)',
    previousHash: '0',
    difficulty: INITIAL_DIFFICULTY
};
GENESIS_BLOCK.hash = crypto.createHash('sha256').update(buildCanonicalString(GENESIS_BLOCK)).digest('hex');

// --- Blockchain Core Logic ---

function loadChain() {
    if (!fs.existsSync(CHAIN_FILE)) {
        console.log(`📦 [Port ${HTTP_PORT}] Initializing Fixed-Base Stake-Weighted Ledger...`);
        saveChain([GENESIS_BLOCK]);
        return [GENESIS_BLOCK];
    }
    const chain = JSON.parse(fs.readFileSync(CHAIN_FILE), (key, value) => {
        if (key === 'amount' || (typeof value === 'string' && /^\d+$/.test(value) && key.includes('balance'))) return BigInt(value);
        return value;
    });
    
    if (!isChainValid(chain)) {
        console.error("🚨 CRITICAL ERROR: Local chain fails validation.");
        process.exit(1);
    }
    return chain;
}

function saveChain(chain) { 
    fs.writeFileSync(CHAIN_FILE, JSON.stringify(chain, null, 2)); 
}

function getBalance(address, chain) {
    let balance = 0n;
    chain.forEach(block => {
        if ((block.type === 'MINT' || block.type === 'GENESIS') && block.signer_pubkey === address) {
            const match = block.vm_result.match(/Int\((-?\d+)\)/);
            if (match) {
                const amount = BigInt(match[1]);
                if (block.mark_commit) balance -= amount;
                else balance += amount;
            }
        }
        if (block.type === 'TRANSFER') {
            const amt = BigInt(block.amount);
            if (block.recipient === address) balance += amt;
            if (block.signer_pubkey === address) balance -= amt;
        }
    });
    return balance;
}

function getDifficulty(chain, minerAddress) {
    // 🛡️ Lock the base difficulty so the Billionaire doesn't accidentally subsidize the network
    let baseDiff = INITIAL_DIFFICULTY; 
    
    // Stake Weighting Logic
    if (minerAddress) {
        const balance = getBalance(minerAddress, chain);
        const reduction = Number(balance / STAKE_DIFFICULTY_MULTIPLIER);
        return Math.max(1, baseDiff - reduction); 
    }
    return baseDiff;
}

function verifyBlockSignature(block) {
    try {
        if (block.type === 'GENESIS') return true;
        const pubKeyObj = crypto.createPublicKey({ key: Buffer.from(block.signer_pubkey, 'hex'), format: 'der', type: 'spki' });
        return crypto.verify(null, Buffer.from(buildCanonicalString(block)), pubKeyObj, Buffer.from(block.signature, 'hex'));
    } catch (e) { return false; }
}

function isChainValid(chain) {
    if (chain[0].hash !== GENESIS_BLOCK.hash) return false;
    for (let i = 1; i < chain.length; i++) {
        const b = chain[i];
        const prevBlock = chain[i - 1];
        
        const historicalDiff = getDifficulty(chain.slice(0, i), b.signer_pubkey);
        if (b.difficulty !== historicalDiff) return false; 

        const rehash = crypto.createHash('sha256').update(buildCanonicalString(b)).digest('hex');
        if (b.previousHash !== prevBlock.hash || rehash !== b.hash || !rehash.startsWith('0'.repeat(historicalDiff))) return false;
        if (!verifyBlockSignature(b)) return false;
    }
    return true;
}

// --- P2P Networking ---

const MessageType = { QUERY_LATEST: 0, QUERY_ALL: 1, RESPONSE_BLOCKCHAIN: 2 };

function initP2PServer() {
    const server = new WebSocket.Server({ port: P2P_PORT });
    server.on('connection', ws => {
        sockets.push(ws);
        ws.on('message', data => {
            const msg = JSON.parse(data);
            if (msg.type === MessageType.QUERY_LATEST) write(ws, { 'type': MessageType.RESPONSE_BLOCKCHAIN, 'data': JSON.stringify([blockchain[blockchain.length - 1]]) });
            if (msg.type === MessageType.RESPONSE_BLOCKCHAIN) handleResponse(msg);
        });
        write(ws, { 'type': MessageType.QUERY_LATEST });
    });
    console.log(`🌐 P2P WebSocket Listening: ${P2P_PORT}`);
}

function handleResponse(message) {
    const received = JSON.parse(message.data, (key, value) => {
        if (key === 'amount' || (typeof value === 'string' && /^\d+$/.test(value) && key.includes('balance'))) return BigInt(value);
        return value;
    });
    if (received.length === 0) return;
    
    const latestReceived = received[received.length - 1];
    const latestHeld = blockchain[blockchain.length - 1];
    
    if (latestReceived.height > latestHeld.height) {
        if (latestHeld.hash === latestReceived.previousHash) {
            blockchain.push(latestReceived);
            saveChain(blockchain);
            broadcast({ 'type': MessageType.RESPONSE_BLOCKCHAIN, 'data': JSON.stringify([latestHeld]) });
        } else if (received.length === 1) {
            broadcast({ 'type': MessageType.QUERY_ALL });
        } else {
            if (isChainValid(received) && received.length > blockchain.length) {
                const checkpoint = Math.max(0, blockchain.length - MAX_REORG_DEPTH);
                let validReorg = true;
                for (let i = 0; i < checkpoint; i++) {
                    if (blockchain[i].hash !== received[i].hash) validReorg = false;
                }
                if (validReorg) {
                    blockchain = received;
                    saveChain(blockchain);
                    broadcast({ 'type': MessageType.RESPONSE_BLOCKCHAIN, 'data': JSON.stringify([blockchain[blockchain.length - 1]]) });
                }
            }
        }
    }
}

function write(ws, message) { ws.send(JSON.stringify(message)); }
function broadcast(message) { sockets.forEach(s => write(s, message)); }

// --- API ---

app.get('/chain', (req, res) => res.json(blockchain));

app.get('/status/:address', (req, res) => {
    const userBlocks = blockchain.filter(b => b.signer_pubkey === req.params.address);
    const nextNonce = userBlocks.length === 0 ? 1 : Math.max(...userBlocks.map(b => b.nonce || 0)) + 1;
    res.json({ nonce: nextNonce, currentDifficulty: getDifficulty(blockchain, req.params.address) });
});

app.post('/addPeer', (req, res) => {
    const ws = new WebSocket(req.body.peer);
    ws.on('open', () => { sockets.push(ws); write(ws, { 'type': MessageType.QUERY_LATEST }); });
    res.send({ message: "Peer added." });
});

app.post('/mine', (req, res) => {
    mineQueue = mineQueue.then(async () => {
        const payload = req.body;
        if (!verifyBlockSignature(payload)) return res.status(401).json({ error: "Invalid signature." });

        const currentBalance = getBalance(payload.signer_pubkey, blockchain);
        let requiredAmount = 0n;
        
        if (payload.mark_commit) {
            try {
                const rawPayload = payload.compiler_payload_raw.trim();
                const isCompilerValid = nacl.sign.detached.verify(
                    Buffer.from(rawPayload), Buffer.from(payload.compiler_signature, 'hex'), Buffer.from(payload.compiler_pubkey, 'hex')
                );
                if (!isCompilerValid) return res.status(401).json({ error: "Compiler signature mismatch." });
                const secureData = JSON.parse(rawPayload);
                if (payload.vm_result !== secureData.vm_result || secureData.nonce !== payload.nonce) return res.status(400).json({ error: "Compiler data mismatch." });
            } catch (e) { return res.status(400).json({ error: "Security check failed." }); }
            const match = payload.vm_result.match(/Int\((-?\d+)\)/);
            if (match) requiredAmount = BigInt(match[1]);
        }

        if (currentBalance < requiredAmount) return res.status(400).json({ error: "Insufficient funds." });

        const diff = getDifficulty(blockchain, payload.signer_pubkey);
        const hash = crypto.createHash('sha256').update(buildCanonicalString(payload)).digest('hex');
        if (!hash.startsWith('0'.repeat(diff))) return res.status(400).json({ error: "Invalid Proof of Work." });
        
        blockchain.push({ height: blockchain.length, timestamp: Date.now(), hash, previousHash: blockchain[blockchain.length - 1].hash, difficulty: diff, ...payload });
        saveChain(blockchain);
        console.log(`🧱 [BLOCK MINED] Height: ${blockchain.length - 1} | Diff: ${diff}`);
        broadcast({ 'type': MessageType.RESPONSE_BLOCKCHAIN, 'data': JSON.stringify([blockchain[blockchain.length - 1]]) });
        res.json({ message: "Success", hash });
    }).catch(err => console.error(err));
});

let blockchain = loadChain();
app.listen(HTTP_PORT, () => console.log(`🚀 Autarky HTTP Online: ${HTTP_PORT}`));
initP2PServer();