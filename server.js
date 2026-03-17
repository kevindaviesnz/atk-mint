const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const WebSocket = require('ws');

const envPath = fs.existsSync(path.join(__dirname, 'node.env')) ? path.join(__dirname, 'node.env') : path.join(__dirname, 'client.env');
require('dotenv').config({ path: envPath });

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.HTTP_PORT || 3000;
const P2P_PORT = process.env.P2P_PORT || 6000;
const CHAIN_FILE = path.join(__dirname, 'chain_3000.json');

const BLOCK_TIME_TARGET = 15000; 
const ADJUSTMENT_INTERVAL = 5;   

const ATK_BINARY = os.platform() === 'linux' ? path.join(__dirname, 'bin', 'atk-linux') : path.join(__dirname, 'bin', 'atk');

function loadChain() {
    if (fs.existsSync(CHAIN_FILE)) {
        try { return JSON.parse(fs.readFileSync(CHAIN_FILE, 'utf8')); } 
        catch (e) { console.error("⚠️ Error reading chain file."); }
    }
    const genesisBlock = {
        height: 0, timestamp: 1710565200000, type: "GENESIS",
        signer_pubkey: "302a300506032b657003210085187c9322b928c2df50eeebaa39be0f787b3d099de5a22d51011175bf8a6656",
        nonce: 0, mining_nonce: 0, vm_result: "Int(100000000000)", previousHash: "0",
        hash: "000000GENESIS_HASH_AUTARKY_CENTRAL_BANK_NODE_000000", difficulty: 6
    };
    const newChain = [genesisBlock];
    saveChain(newChain);
    return newChain;
}

function saveChain(chain) {
    fs.writeFileSync(CHAIN_FILE, JSON.stringify(chain, null, 2));
}

function getCurrentDifficulty(chain) {
    const latestBlock = chain[chain.length - 1];
    const currentDiff = latestBlock.difficulty || 6;
    if (chain.length % ADJUSTMENT_INTERVAL !== 0 || chain.length < ADJUSTMENT_INTERVAL) return currentDiff;
    const prevAdjustmentBlock = chain[chain.length - ADJUSTMENT_INTERVAL];
    const timeExpected = BLOCK_TIME_TARGET * ADJUSTMENT_INTERVAL;
    const timeTaken = latestBlock.timestamp - prevAdjustmentBlock.timestamp;
    if (timeTaken < timeExpected / 2) return currentDiff + 1;
    else if (timeTaken > timeExpected * 2) return Math.max(4, currentDiff - 1);
    return currentDiff;
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

function getBalance(pubkey) {
    let balance = 0;
    const chain = loadChain();
    chain.forEach(block => {
        if ((block.type === 'GENESIS' || block.type === 'MINT') && block.signer_pubkey === pubkey) {
            const match = block.vm_result.match(/Int\((-?\d+)\)/);
            if (match) balance += Number(match[1]);
        }
        if (block.type === 'TRANSFER') {
            const amt = Number(block.amount);
            if (block.signer_pubkey === pubkey) balance -= amt;
            if (block.recipient === pubkey) balance += amt;
        }
    });
    return balance;
}

app.get('/blocks', (req, res) => res.json({ status: "Success", length: loadChain().length, blocks: loadChain() })); 
app.get('/difficulty', (req, res) => res.json({ difficulty: getCurrentDifficulty(loadChain()) }));
app.get('/nonce/:pubkey', (req, res) => {
    const chain = loadChain();
    let maxNonce = -1;
    chain.forEach(block => { if (block.signer_pubkey === req.params.pubkey && block.nonce > maxNonce) maxNonce = block.nonce; });
    res.json({ nonce: maxNonce + 1, previousHash: chain[chain.length - 1].hash });
});
app.get('/balance/:pubkey', (req, res) => res.json({ pubkey: req.params.pubkey, balance: getBalance(req.params.pubkey) }));

app.post('/mine', (req, res) => {
    const payload = req.body;
    let chain = loadChain();
    const lastBlock = chain[chain.length - 1];

    if (payload.previousHash !== lastBlock.hash) return res.status(400).json({ error: "Chain Splice Detected." });

    if (payload.compiler_payload_raw) {
        try {
            const tempFilePath = path.join(os.tmpdir(), `script_${Date.now()}.aut`);
            fs.writeFileSync(tempFilePath, payload.compiler_payload_raw);
            execFileSync(ATK_BINARY, [
                '--file', tempFilePath, '--json', '--nonce', payload.nonce.toString(),
                '--compute', '1000', '--credits', getBalance(payload.signer_pubkey).toString() 
            ], { encoding: 'utf8', stdio: 'pipe' });
            fs.unlinkSync(tempFilePath); 
        } catch (error) {
            return res.status(400).json({ error: "Formal Verification Failed." });
        }
    } 
    
    const requiredDifficulty = getCurrentDifficulty(chain);
    const dataStr = buildCanonicalString(payload);
    const hash = crypto.createHash('sha256').update(dataStr).digest('hex');
    if (!hash.startsWith('0'.repeat(requiredDifficulty))) return res.status(400).json({ error: "Insufficient Work" });

    let isVerified = false;
    try {
        const pubKeyObj = crypto.createPublicKey({ key: Buffer.from(payload.signer_pubkey, 'hex'), format: 'der', type: 'spki' });
        isVerified = crypto.verify(null, Buffer.from(dataStr), pubKeyObj, Buffer.from(payload.signature, 'hex'));
    } catch (e) {}

    if (!isVerified) return res.status(400).json({ error: "Cryptographic identity mismatch." });

    payload.hash = hash;
    payload.timestamp = Date.now();
    payload.height = chain.length;
    payload.difficulty = requiredDifficulty; 
    
    chain.push(payload);
    saveChain(chain);
    
    console.log(`💎 BLOCK ACCEPTED | Height: ${payload.height} | Difficulty: ${requiredDifficulty}`);
    
    // 🕸️ HYDRA TRIGGER: Whisper the new block to all connected peers
    broadcast({ type: 'NEW_BLOCK', block: payload });
    
    res.status(200).json({ message: "Success!", block: payload });
});

// ---------------------------------------------------------
// The Hydra Network (P2P Gossip Protocol)
// ---------------------------------------------------------
const sockets = [];
// FORCE BIND TO 0.0.0.0 SO IT CAN BE REACHED EXTERNALLY
const p2pServer = new WebSocket.Server({ host: '0.0.0.0', port: P2P_PORT });

p2pServer.on('connection', ws => initConnection(ws));

function initConnection(ws) {
    sockets.push(ws);
    ws.on('message', data => handleMessage(ws, data));
    ws.on('error', () => sockets.splice(sockets.indexOf(ws), 1));
    ws.on('close', () => sockets.splice(sockets.indexOf(ws), 1));
    
    // Welcome the new node by sending it our entire history
    ws.send(JSON.stringify({ type: 'CHAIN_SYNC', chain: loadChain() }));
}

function broadcast(message) {
    sockets.forEach(socket => socket.send(JSON.stringify(message)));
}

function handleMessage(ws, message) {
    try {
        const data = JSON.parse(message);
        const currentChain = loadChain();
        const lastBlock = currentChain[currentChain.length - 1];

        if (data.type === 'NEW_BLOCK') {
            if (data.block.previousHash === lastBlock.hash) {
                console.log(`🕸️ Gossip Received: New block appended from peer. Height: ${data.block.height}`);
                currentChain.push(data.block);
                saveChain(currentChain);
                broadcast(data); // Forward the gossip
            } else if (data.block.height > lastBlock.height) {
                console.log(`⚠️ Peer has a longer chain! Requesting sync...`);
                ws.send(JSON.stringify({ type: 'REQUEST_CHAIN' }));
            }
        } else if (data.type === 'CHAIN_SYNC') {
            if (data.chain.length > currentChain.length) {
                console.log(`⚖️ Nakamoto Consensus: Adopting longer chain from peer. (Height: ${data.chain.length - 1})`);
                saveChain(data.chain);
                broadcast({ type: 'CHAIN_SYNC', chain: data.chain }); // Force others to sync
            }
        } else if (data.type === 'REQUEST_CHAIN') {
            ws.send(JSON.stringify({ type: 'CHAIN_SYNC', chain: loadChain() }));
        }
    } catch (e) { console.error("P2P Message Error"); }
}

if (process.env.PEERS) {
    process.env.PEERS.split(',').forEach(peer => {
        const ws = new WebSocket(peer);
        ws.on('open', () => initConnection(ws));
        ws.on('error', () => console.log(`❌ Could not connect to peer: ${peer}`));
    });
}

app.listen(PORT, '0.0.0.0', () => console.log(`🛡️ Autarky HTTP Node Online | Port: ${PORT}`));
console.log(`🕸️ Hydra P2P Network Online | Port: ${P2P_PORT}`);