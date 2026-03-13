const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const crypto = require('crypto');
const WebSocket = require('ws'); 

// ---------------------------------------------------------
// Configuration & Environment Setup
// ---------------------------------------------------------
const HTTP_PORT = process.env.HTTP_PORT || 3000;
const P2P_PORT = process.env.P2P_PORT || 6000;
const INITIAL_PEERS = process.env.PEERS ? process.env.PEERS.split(',') : [];

const CHAIN_FILE = `./chain_${HTTP_PORT}.json`; 
const DIFFICULTY = 4;

const app = express();
app.use(bodyParser.json());

let sockets = []; 

// ---------------------------------------------------------
// Message Types for the P2P Network
// ---------------------------------------------------------
const MessageType = {
    QUERY_LATEST: 0,
    QUERY_ALL: 1,
    RESPONSE_BLOCKCHAIN: 2
};

// ---------------------------------------------------------
// Core Ledger Functions
// ---------------------------------------------------------
function loadChain() {
    if (!fs.existsSync(CHAIN_FILE)) {
        // Auto-migrate the old chain.json if we are the main node
        if (HTTP_PORT == 3000 && fs.existsSync('./chain.json')) {
            console.log('📦 Migrating old chain.json history to chain_3000.json...');
            const oldChain = JSON.parse(fs.readFileSync('./chain.json'));
            fs.writeFileSync(CHAIN_FILE, JSON.stringify(oldChain, null, 2));
            return oldChain;
        }
        return [];
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
        if (block.type === 'MINT' && block.signer_pubkey === address) {
            const match = block.vm_result.match(/Int\((\d+)\)/);
            if (match) balance += parseInt(match[1], 10);
        }
        if (block.type === 'TRANSFER' && block.recipient === address) {
            balance += parseInt(block.amount, 10);
        }
        if (block.type === 'TRANSFER' && block.sender === address) {
            balance -= parseInt(block.amount, 10);
        }
    });
    return balance;
}

// ---------------------------------------------------------
// P2P Networking Functions (The Global Bridge)
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
            case MessageType.QUERY_LATEST:
                write(ws, responseLatestMsg());
                break;
            case MessageType.QUERY_ALL:
                write(ws, responseChainMsg());
                break;
            case MessageType.RESPONSE_BLOCKCHAIN:
                handleBlockchainResponse(message);
                break;
        }
    });
}

function initErrorHandler(ws) {
    const closeConnection = (ws) => {
        console.log('[P2P] Connection failed or closed by peer.');
        sockets.splice(sockets.indexOf(ws), 1);
    };
    ws.on('close', () => closeConnection(ws));
    ws.on('error', () => closeConnection(ws));
}

function connectToPeers(newPeers) {
    newPeers.forEach(peer => {
        const ws = new WebSocket(peer);
        ws.on('open', () => initConnection(ws));
        ws.on('error', () => {
            console.log(`[P2P] Connection failed to peer: ${peer}`);
        });
    });
}

// Consensus Rule: Longest Valid Chain Wins
function handleBlockchainResponse(message) {
    const receivedData = JSON.parse(message.data);
    
    // Protect against nulls or empty arrays
    const receivedBlocks = receivedData.filter(b => b !== null);
    if (receivedBlocks.length === 0) {
        console.log('[P2P] Peer chain is empty. Waiting for blocks...');
        return;
    }

    receivedBlocks.sort((b1, b2) => (b1.height - b2.height));
    const latestBlockReceived = receivedBlocks[receivedBlocks.length - 1];
    const latestBlockHeld = blockchain.length > 0 ? blockchain[blockchain.length - 1] : { height: 0 };

    if (latestBlockReceived.height > latestBlockHeld.height) {
        console.log(`[P2P] Peer has longer chain (${latestBlockReceived.height} vs our ${latestBlockHeld.height}). Resolving consensus...`);
        
        if (latestBlockHeld.height === 0 || latestBlockHeld.hash === latestBlockReceived.previousHash) {
            console.log(`[P2P] Appending received block to our chain.`);
            blockchain.push(latestBlockReceived);
            saveChain(blockchain);
            broadcast(responseLatestMsg());
        } else if (receivedBlocks.length === 1) {
            console.log(`[P2P] We have to query the full chain from our peer.`);
            broadcast(queryAllMsg());
        } else {
            console.log(`[P2P] Replacing our local chain with peer's longer chain.`);
            blockchain = receivedBlocks;
            saveChain(blockchain);
            broadcast(responseLatestMsg());
        }
    } else {
        console.log('[P2P] Received blockchain is not longer than current blockchain. In sync.');
    }
}

const queryChainLengthMsg = () => ({ 'type': MessageType.QUERY_LATEST });
const queryAllMsg = () => ({ 'type': MessageType.QUERY_ALL });
const responseChainMsg = () => ({ 'type': MessageType.RESPONSE_BLOCKCHAIN, 'data': JSON.stringify(blockchain) });
const responseLatestMsg = () => {
    // Return empty array if we have no blocks, preventing the null crash
    if (blockchain.length === 0) {
        return { 'type': MessageType.RESPONSE_BLOCKCHAIN, 'data': JSON.stringify([]) };
    }
    return { 'type': MessageType.RESPONSE_BLOCKCHAIN, 'data': JSON.stringify([blockchain[blockchain.length - 1]]) };
};

const write = (ws, message) => ws.send(JSON.stringify(message));
const broadcast = (message) => sockets.forEach(socket => write(socket, message));

// ---------------------------------------------------------
// HTTP API Endpoints (Local Client Interactions)
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
    
    // Proof of Work Verification
    const targetPrefix = '0'.repeat(DIFFICULTY);
    const dataToHash = `${payload.signer_pubkey}-${payload.nonce}-${payload.mining_nonce}`;
    const hash = crypto.createHash('sha256').update(dataToHash).digest('hex');

    if (!hash.startsWith(targetPrefix)) {
        return res.status(400).json({ error: "Hash does not meet network difficulty." });
    }

    const lastTx = blockchain.slice().reverse().find(b => b.signer_pubkey === payload.signer_pubkey);
    if (lastTx && payload.nonce <= lastTx.nonce) {
        return res.status(400).json({ error: "Nonce too low. Replay attack prevented." });
    }

    const block = {
        height: blockchain.length + 1,
        timestamp: Date.now(),
        type: 'MINT',
        hash: hash,
        previousHash: blockchain.length > 0 ? blockchain[blockchain.length - 1].hash : "0",
        ...payload
    };
    
    blockchain.push(block);
    saveChain(blockchain);
    
    console.log(`🧱 [BLOCK MINED] Height: ${block.height} | Result: ${block.vm_result}`);
    
    // THE CRITICAL P2P STEP: Broadcast the new block to the world!
    broadcast(responseLatestMsg());
    
    res.json({ message: "Block mined successfully", block: block });
});

app.listen(HTTP_PORT, () => {
    console.log(`[HTTP Layer] Autarky Client API listening on port ${HTTP_PORT}`);
});

initP2PServer();
connectToPeers(INITIAL_PEERS);