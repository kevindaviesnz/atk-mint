const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const crypto = require('crypto');
const WebSocket = require('ws'); 

const HTTP_PORT = process.env.HTTP_PORT || 3000;
const P2P_PORT = process.env.P2P_PORT || 6000;
const INITIAL_PEERS = process.env.PEERS ? process.env.PEERS.split(',') : [];

const CHAIN_FILE = `./chain_${HTTP_PORT}.json`; 
const WALLET_FILE = './wallet.json';
const DIFFICULTY = 4;

const app = express();
app.use(bodyParser.json());
let sockets = []; 

// Assign Genesis Pre-mine to local wallet if it exists
let GENESIS_ADDRESS = '32bd9b3ed7c6be16393e23d46a2dd0a10321e10fdacc4ee7a97a1900920f8033'; // Fallback to old key
if (fs.existsSync(WALLET_FILE)) {
    GENESIS_ADDRESS = JSON.parse(fs.readFileSync(WALLET_FILE)).publicKey;
}

const GENESIS_BLOCK = {
    height: 0,
    timestamp: 1710565200000, 
    type: 'GENESIS',
    signer_pubkey: GENESIS_ADDRESS,
    vm_result: 'Int(100000000000)', 
    hash: '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f', 
    previousHash: '0'
};

const MessageType = { QUERY_LATEST: 0, QUERY_ALL: 1, RESPONSE_BLOCKCHAIN: 2 };

function loadChain() {
    if (!fs.existsSync(CHAIN_FILE)) {
        console.log('📦 Initializing fresh ledger with the Genesis Block...');
        saveChain([GENESIS_BLOCK]);
        return [GENESIS_BLOCK];
    }
    return JSON.parse(fs.readFileSync(CHAIN_FILE));
}

function saveChain(chain) {
    fs.writeFileSync(CHAIN_FILE, JSON.stringify(chain, null, 2));
}

let blockchain = loadChain();

function getBalance(address, chain) {
    let balance = 0;
    chain.forEach(block => {
        if ((block.type === 'MINT' || block.type === 'GENESIS') && block.signer_pubkey === address) {
            const match = block.vm_result.match(/Int\((\d+)\)/);
            if (match) {
                const amount = parseInt(match[1], 10);
                if (block.mark_commit) balance -= amount; // Gas Burn
                else balance += amount; // Mining Reward
            }
        }
        if (block.type === 'TRANSFER' && block.recipient === address) balance += parseInt(block.amount, 10);
        if (block.type === 'TRANSFER' && block.sender === address) balance -= parseInt(block.amount, 10);
    });
    return balance;
}

// ---------------------------------------------------------
// P2P Networking Functions
// ---------------------------------------------------------
function initP2PServer() {
    const server = new WebSocket.Server({ port: P2P_PORT });
    server.on('connection', ws => initConnection(ws));
    console.log(`🌐 P2P WebSocket Server listening on port ${P2P_PORT}`);
}

function initConnection(ws) {
    sockets.push(ws);
    initMessageHandler(ws);
    initErrorHandler(ws);
    write(ws, queryChainLengthMsg());
}

function initMessageHandler(ws) {
    ws.on('message', data => {
        const message = JSON.parse(data);
        switch (message.type) {
            case MessageType.QUERY_LATEST: write(ws, responseLatestMsg()); break;
            case MessageType.QUERY_ALL: write(ws, responseChainMsg()); break;
            case MessageType.RESPONSE_BLOCKCHAIN: handleBlockchainResponse(message); break;
        }
    });
}

function initErrorHandler(ws) {
    const closeConnection = (ws) => { sockets.splice(sockets.indexOf(ws), 1); };
    ws.on('close', () => closeConnection(ws));
    ws.on('error', () => closeConnection(ws));
}

function connectToPeers(newPeers) {
    newPeers.forEach(peer => {
        const ws = new WebSocket(peer);
        ws.on('open', () => initConnection(ws));
    });
}

function handleBlockchainResponse(message) {
    const receivedData = JSON.parse(message.data);
    const receivedBlocks = receivedData.filter(b => b !== null);
    if (receivedBlocks.length === 0) return;
    receivedBlocks.sort((b1, b2) => (b1.height - b2.height));
    const latestBlockReceived = receivedBlocks[receivedBlocks.length - 1];
    const latestBlockHeld = blockchain[blockchain.length - 1];
    if (latestBlockReceived.height > latestBlockHeld.height) {
        if (latestBlockHeld.hash === latestBlockReceived.previousHash) {
            blockchain.push(latestBlockReceived);
            saveChain(blockchain);
            broadcast(responseLatestMsg());
        } else if (receivedBlocks.length === 1) {
            broadcast(queryAllMsg());
        } else {
            blockchain = receivedBlocks;
            saveChain(blockchain);
            broadcast(responseLatestMsg());
        }
    }
}

const queryChainLengthMsg = () => ({ 'type': MessageType.QUERY_LATEST });
const queryAllMsg = () => ({ 'type': MessageType.QUERY_ALL });
const responseChainMsg = () => ({ 'type': MessageType.RESPONSE_BLOCKCHAIN, 'data': JSON.stringify(blockchain) });
const responseLatestMsg = () => ({ 'type': MessageType.RESPONSE_BLOCKCHAIN, 'data': JSON.stringify([blockchain[blockchain.length - 1]]) });
const write = (ws, message) => ws.send(JSON.stringify(message));
const broadcast = (message) => sockets.forEach(socket => write(socket, message));

// ---------------------------------------------------------
// HTTP API Endpoints
// ---------------------------------------------------------
app.get('/balance/:address', (req, res) => {
    res.json({ address: req.params.address, balance: getBalance(req.params.address, blockchain) });
});

app.get('/peers', (req, res) => {
    res.json(sockets.map(s => s._socket.remoteAddress + ':' + s._socket.remotePort));
});

app.post('/addPeer', (req, res) => {
    connectToPeers([req.body.peer]);
    res.json({ message: "Peer added" });
});

app.post('/mine', (req, res) => {
    const payload = req.body;
    
    // 1. ASYMMETRIC SIGNATURE VERIFICATION (The Un-hackable Lock)
    try {
        const pubKeyBuffer = Buffer.from(payload.signer_pubkey, 'hex');
        const pubKeyObj = crypto.createPublicKey({ key: pubKeyBuffer, format: 'der', type: 'spki' });
        const dataToVerify = Buffer.from(`${payload.signer_pubkey}-${payload.nonce}-${payload.mining_nonce}`);
        const isValid = crypto.verify(null, dataToVerify, pubKeyObj, Buffer.from(payload.signature, 'hex'));
        
        if (!isValid) return res.status(401).json({ error: "Invalid signature. Spoofing attempt detected." });
    } catch (err) {
        return res.status(400).json({ error: "Malformed public key or signature." });
    }

    // 2. STATE TRANSITION & DOUBLE-SPEND FIREWALL
    const currentBalance = getBalance(payload.signer_pubkey, blockchain);
    let requiredAmount = 0;
    
    if (payload.mark_commit) {
        const match = payload.vm_result.match(/Int\((\d+)\)/);
        if (match) requiredAmount = parseInt(match[1], 10);
    } else if (payload.type === 'TRANSFER') {
        requiredAmount = parseInt(payload.amount, 10);
    }

    if (currentBalance < requiredAmount) {
        return res.status(400).json({ error: `Insufficient funds to pay Gas. Balance: ${currentBalance}, Required: ${requiredAmount}` });
    }

    // 3. PROOF OF WORK VERIFICATION
    const targetPrefix = '0'.repeat(DIFFICULTY);
    const dataToHash = `${payload.signer_pubkey}-${payload.nonce}-${payload.mining_nonce}`;
    const hash = crypto.createHash('sha256').update(dataToHash).digest('hex');

    if (!hash.startsWith(targetPrefix)) return res.status(400).json({ error: "Hash does not meet network difficulty." });

    // 4. REPLAY ATTACK PREVENTION
    const lastTx = blockchain.slice().reverse().find(b => b.signer_pubkey === payload.signer_pubkey);
    if (lastTx && payload.nonce <= lastTx.nonce) return res.status(400).json({ error: "Nonce too low. Replay attack prevented." });

    const block = {
        height: blockchain.length,
        timestamp: Date.now(),
        type: 'MINT',
        hash: hash,
        previousHash: blockchain[blockchain.length - 1].hash,
        ...payload
    };
    
    blockchain.push(block);
    saveChain(blockchain);
    
    console.log(`🧱 [SECURE BLOCK MINED] Height: ${block.height} | Gas Burned: ${block.vm_result}`);
    broadcast(responseLatestMsg());
    
    res.json({ message: "Block securely anchored", block: block });
});

app.listen(HTTP_PORT, () => console.log(`[HTTP Layer] Autarky Secure API listening on port ${HTTP_PORT}`));
initP2PServer();