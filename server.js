const express = require('express');
const WebSocket = require('ws');
const fs = require('fs');
const crypto = require('crypto');

const HTTP_PORT = process.env.HTTP_PORT || 3000;
const P2P_PORT = process.env.P2P_PORT || 6000;
const PEERS = process.env.PEERS ? process.env.PEERS.split(',') : [];
const CHAIN_FILE = `./chain_${HTTP_PORT}.json`;

// --- Thermostat Constants ---
const BLOCK_GENERATION_INTERVAL = 15; // Target 15 seconds per block
const DIFFICULTY_ADJUSTMENT_INTERVAL = 10; // Evaluate network speed every 10 blocks

// --- Blockchain State ---
let blockchain = [];

const genesisBlock = {
    height: 0,
    timestamp: 1700000000000,
    hash: "0000genesisblock",
    previousHash: "0",
    difficulty: 4,
    mining_nonce: 0,
    signer_pubkey: "genesis"
};

if (fs.existsSync(CHAIN_FILE)) {
    // Read the chain and immediately filter out any corrupt null data
    const rawChain = JSON.parse(fs.readFileSync(CHAIN_FILE));
    blockchain = rawChain.filter(block => block !== null && block !== undefined);
    
    // Save the newly cleaned chain back to the hard drive
    fs.writeFileSync(CHAIN_FILE, JSON.stringify(blockchain, null, 2));
} else {
    blockchain = [genesisBlock];
    fs.writeFileSync(CHAIN_FILE, JSON.stringify(blockchain, null, 2));
}

// --- Thermostat Logic ---
function getDifficulty(chain) {
    const latestBlock = chain[chain.length - 1];
    if (latestBlock.height % DIFFICULTY_ADJUSTMENT_INTERVAL === 0 && latestBlock.height !== 0) {
        return getAdjustedDifficulty(latestBlock, chain);
    } else {
        return latestBlock.difficulty || 4; 
    }
}

function getAdjustedDifficulty(latestBlock, chain) {
    const prevAdjustmentBlock = chain.find(b => b && b.height === latestBlock.height - DIFFICULTY_ADJUSTMENT_INTERVAL);
    
    if (!prevAdjustmentBlock) {
        return latestBlock.difficulty || 4;
    }

    const expectedTime = BLOCK_GENERATION_INTERVAL * DIFFICULTY_ADJUSTMENT_INTERVAL;
    const actualTime = (latestBlock.timestamp - prevAdjustmentBlock.timestamp) / 1000;

    console.log(`\n[Thermostat] Epoch Complete. Expected: ${expectedTime}s | Actual: ${actualTime}s`);

    if (actualTime < expectedTime / 2) {
        console.log(`[Thermostat] Network running hot. Increasing difficulty.`);
        return (prevAdjustmentBlock.difficulty || 4) + 1;
    } else if (actualTime > expectedTime * 2) {
        console.log(`[Thermostat] Network struggling. Decreasing difficulty.`);
        return Math.max(1, (prevAdjustmentBlock.difficulty || 4) - 1); 
    } else {
        console.log(`[Thermostat] Network stable. Maintaining difficulty.`);
        return prevAdjustmentBlock.difficulty || 4;
    }
}

// --- Express HTTP Server ---
const app = express();
app.use(express.json());

app.get('/blocks', (req, res) => res.json(blockchain));

app.get('/difficulty', (req, res) => {
    res.json({ difficulty: getDifficulty(blockchain) });
});

// RESTORED: The Accounting Endpoint
app.get('/balance/:address', (req, res) => {
    const address = req.params.address;
    let balance = 0;
    
    blockchain.forEach(block => {
        // Mining rewards (+50 per block)
        if (block.signer_pubkey === address && block.is_mint) {
            balance += 50; 
        }
        // Gas fees spent for VCS commits (-5 per commit)
        if (block.signer_pubkey === address && block.mark_commit) {
            balance -= 5; 
        }
        // Explicit peer-to-peer transfers
        if (block.type === 'TRANSFER') {
            if (block.sender === address) balance -= block.amount;
            if (block.recipient === address) balance += block.amount;
        }
    });
    
    res.json({ address: address, balance: balance });
});

app.post('/mine', (req, res) => {
    const blockData = req.body;
    const latestBlock = blockchain[blockchain.length - 1];
    const currentDifficulty = getDifficulty(blockchain);
    
    const dataToHash = `${blockData.signer_pubkey}-${blockData.nonce}-${blockData.mining_nonce}`;
    const blockHash = crypto.createHash('sha256').update(dataToHash).digest('hex');
    
    const targetPrefix = '0'.repeat(currentDifficulty);
    
    if (!blockHash.startsWith(targetPrefix)) {
        return res.status(400).json({ error: `🚨 Consensus Failed: Invalid Proof of Work. Expected ${currentDifficulty} zeros.` });
    }

    const newBlock = {
        height: latestBlock.height + 1,
        timestamp: Date.now(),
        previousHash: latestBlock.hash,
        hash: blockHash,
        difficulty: currentDifficulty,
        ...blockData
    };

    blockchain.push(newBlock);
    fs.writeFileSync(CHAIN_FILE, JSON.stringify(blockchain, null, 2));
    
    console.log(`\n🧱 New Block Anchored! Height: ${newBlock.height} | Difficulty: ${currentDifficulty}`);
    broadcast(JSON.stringify({ type: 'NEW_BLOCK', block: newBlock }));
    
    res.json({ message: "Block accepted", block: newBlock });
});

// --- WebSocket P2P Server ---
const sockets = [];
const wsServer = new WebSocket.Server({ port: P2P_PORT });

wsServer.on('connection', ws => initConnection(ws));

function initConnection(ws) {
    sockets.push(ws);
    ws.on('message', data => handleMessage(ws, data));
    ws.on('close', () => sockets.splice(sockets.indexOf(ws), 1));
    
    ws.send(JSON.stringify({ type: 'QUERY_LATEST' }));
}

function handleMessage(ws, data) {
    const message = JSON.parse(data);
    if (message.type === 'QUERY_LATEST') {
        ws.send(JSON.stringify({ type: 'RESPONSE_CHAIN', chain: [blockchain[blockchain.length - 1]] }));
    } else if (message.type === 'RESPONSE_CHAIN') {
        const receivedChain = message.chain;
        if (receivedChain.length > 0 && receivedChain[receivedChain.length - 1].height > blockchain[blockchain.length - 1].height) {
            console.log(`[P2P] Received longer chain. Replacing local ledger.`);
            blockchain = receivedChain;
            fs.writeFileSync(CHAIN_FILE, JSON.stringify(blockchain, null, 2));
            broadcast(JSON.stringify({ type: 'RESPONSE_CHAIN', chain: blockchain }));
        }
    } else if (message.type === 'NEW_BLOCK') {
        const newBlock = message.block;
        if (newBlock.height === blockchain[blockchain.length - 1].height + 1) {
            blockchain.push(newBlock);
            fs.writeFileSync(CHAIN_FILE, JSON.stringify(blockchain, null, 2));
            console.log(`[P2P] Synced new block: ${newBlock.height}`);
        }
    }
}

function broadcast(message) {
    sockets.forEach(s => s.send(message));
}

PEERS.forEach(peer => {
    const ws = new WebSocket(peer);
    ws.on('open', () => initConnection(ws));
    ws.on('error', () => console.log(`[P2P] Connection failed: ${peer}`));
});

app.listen(HTTP_PORT, () => {
    console.log(`[Autarky Engine] HTTP server listening on port ${HTTP_PORT}`);
    console.log(`[Autarky Network] P2P Node active on port ${P2P_PORT}`);
    console.log(`[Thermostat] Network Heartbeat: 1 block per ${BLOCK_GENERATION_INTERVAL} seconds.`);
});