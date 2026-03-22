import express from 'express';
import cors from 'cors';
import fs from 'fs';
import crypto from 'crypto';

const app = express();
app.use(cors());
app.use(express.json());

// Allow port to be set by environment variable for local P2P testing
const PORT = process.env.PORT || 3000;
const CHAIN_FILE = `chain_${PORT}.json`; // Unique file per port so nodes don't overwrite each other

const TREASURY_ADDR = "3056301006072a8648ce3d020106052b8104000a0342000431cf5a9df07b34fbabf6900251c7745c70ead9dfc9e81d7585f2f03553a110d72d6094f07e259734be5a3d069167765215147bf368e7deef63876f713620d293"; 
const GENESIS_ALLOCATION = "10000000000";

let chain = [];
let mempool = [];
let peers = new Set(); // 🌍 NEW: The Address Book

// --- 1. INITIALIZATION ---
if (fs.existsSync(CHAIN_FILE)) {
    try {
        chain = JSON.parse(fs.readFileSync(CHAIN_FILE, 'utf8'));
        console.log(`📡 Vault Online (Port ${PORT}): ${chain.length} blocks loaded.`);
    } catch (e) { chain = []; }
} 

if (chain.length === 0) {
    chain.push({
        height: 0, type: "GENESIS", signer_pubkey: TREASURY_ADDR, amount: GENESIS_ALLOCATION,
        timestamp: 1742515200000, hash: "000000genesis_sovereign_block_atk_mint",
        previousHash: "0", message: "ATK-Mint Official Genesis"
    });
    fs.writeFileSync(CHAIN_FILE, JSON.stringify(chain, null, 2));
}

// --- 2. UTILS & MONETARY POLICY ---
function getMiningReward(height) {
    const halvings = Math.floor(height / 210000);
    return BigInt(Math.floor(50000 / Math.pow(2, halvings))); 
}

function buildCanonicalString(b) {
    return [
        String(b.signer_pubkey || ""), String(b.nonce ?? "0"), String(b.mining_nonce ?? "0"),
        String(b.recipient || ""), String(b.amount || ""), String(b.type || ""),
        String(b.vm_result || ""), String(b.mark_commit ?? "false"), String(b.message || ""),             
        String(b.compiler_payload_raw || ""), String(b.compiler_signature || ""),
        String(b.compiler_pubkey || ""), String(b.previousHash || "0")         
    ].join('|');
}

function safeBigInt(val, fallback = "0") {
    try { return BigInt(String(val).replace(/[^0-9]/g, '') || fallback); } 
    catch (e) { return BigInt(fallback); }
}

// --- 🌍 3. P2P GOSSIP ENGINE ---
// Broadcast data to all known peers
async function broadcast(endpoint, data) {
    for (let peer of peers) {
        try {
            await fetch(`${peer}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } catch (e) {
            console.log(`[P2P] ⚠️ Peer unreachable: ${peer}`);
        }
    }
}

// Consensus: The Longest Chain Rule
async function resolveConflicts() {
    let longestChain = null;
    let maxLength = chain.length;

    for (let peer of peers) {
        try {
            const res = await fetch(`${peer}/blocks`);
            const peerChain = await res.json();
            
            // If the peer has a longer chain, we flag it for review
            if (peerChain.length > maxLength) {
                // In a production system, you would fully validate the peer's hashes here
                maxLength = peerChain.length;
                longestChain = peerChain;
            }
        } catch (e) { continue; }
    }

    if (longestChain) {
        chain = longestChain;
        fs.writeFileSync(CHAIN_FILE, JSON.stringify(chain, null, 2));
        console.log(`[P2P] 🔄 Consensus Applied! Replaced local chain with longer chain (Length: ${maxLength})`);
        return true;
    }
    return false;
}

// --- 4. NETWORK ROUTES ---
app.get('/', (req, res) => res.send(`🟢 ATK-Mint P2P Node Online. Port: ${PORT}, Peers: ${peers.size}`));
app.get('/blocks', (req, res) => res.json(chain));
app.get('/difficulty', (req, res) => res.json({ difficulty: 6 }));
app.get('/mempool', (req, res) => res.json(mempool));
app.get('/peers', (req, res) => res.json(Array.from(peers)));

app.get('/nonce/:pubkey', (req, res) => {
    const pubkey = req.params.pubkey;
    let nonce = 0;
    chain.forEach(b => { if (b.signer_pubkey === pubkey) nonce++; });
    const lastBlock = chain[chain.length - 1];
    res.json({ nonce, previousHash: lastBlock ? lastBlock.hash : "0", height: chain.length - 1 });
});

app.get('/balance/:pubkey', (req, res) => {
    const target = req.params.pubkey;
    let balance = BigInt(0);
    chain.forEach(block => {
        const address = (block.signer_pubkey || "").trim();
        const recipient = (block.recipient || "").trim();
        if (block.type === 'GENESIS') {
            if (address === target) balance += BigInt(GENESIS_ALLOCATION);
        } else if (block.type === 'MINT' || block.type === 'TRANSFER') {
            if (address === target) balance += getMiningReward(block.height);
            if (block.type === 'TRANSFER') {
                const tAmount = safeBigInt(block.amount, "0");
                if (address === target) balance -= tAmount;
                if (recipient === target) balance += tAmount;
            }
        }
    });
    res.json({ balance: balance.toString() });
});

// --- 5. RECEIVE DATA (WITH GOSSIP) ---

// Register a new peer
app.post('/register-node', (req, res) => {
    const newNodeUrl = req.body.nodeUrl;
    if (newNodeUrl && !peers.has(newNodeUrl)) {
        peers.add(newNodeUrl);
        console.log(`[P2P] 🤝 New peer connected: ${newNodeUrl}`);
    }
    res.json({ message: "Node registered successfully", totalPeers: peers.size });
});

// Trigger the node to seek consensus
app.get('/consensus', async (req, res) => {
    const updated = await resolveConflicts();
    res.json({ message: updated ? "Chain updated" : "Chain is already authoritative", chainLength: chain.length });
});

app.post('/transactions', (req, res) => {
    const tx = req.body;
    if (!tx.signature || !tx.signer_pubkey) return res.status(400).json({ error: "Invalid TX" });
    
    // Prevent infinite gossip loops (don't add if we already have it)
    if (mempool.some(existing => existing.signature === tx.signature)) {
        return res.json({ message: "Already in mempool" });
    }

    mempool.push(tx);
    console.log(`📥 Anchor Received: ${tx.message.substring(0,30)}...`);
    
    // 🌍 GOSSIP: Tell everyone else about this transaction!
    broadcast('/transactions', tx);
    res.json({ success: true, message: "Added and broadcasted" });
});

app.post('/blocks', (req, res) => {
    const block = req.body;
    
    // Prevent infinite gossip loops
    if (chain.some(b => b.hash === block.hash)) return res.json({ message: "Block already known" });

    if (!block.hash || !block.hash.startsWith('000000')) return res.status(400).json({ error: "Invalid PoW" });
    if (crypto.createHash('sha256').update(buildCanonicalString(block)).digest('hex') !== block.hash) return res.status(400).json({ error: "Hash mismatch" });
    
    const lastBlock = chain[chain.length - 1];
    if (block.previousHash !== (lastBlock ? lastBlock.hash : "0")) {
        // We received a block that doesn't fit our chain. Trigger consensus to catch up!
        resolveConflicts();
        return res.status(400).json({ error: "Chain out of sync. Seeking consensus..." });
    }

    if (block.type === 'MINT') block.vm_result = `Int(${getMiningReward(chain.length).toString()})`;
    if (mempool.length > 0) block.mempool_payload = [...mempool];

    block.height = chain.length;
    chain.push(block);
    mempool = []; 
    fs.writeFileSync(CHAIN_FILE, JSON.stringify(chain, null, 2));
    
    console.log(`✅ Accepted Block #${block.height} from ${block.signer_pubkey.substring(0,8)}...`);
    
    // 🌍 GOSSIP: Tell everyone else about this solved block!
    broadcast('/blocks', block);
    res.json({ message: "Block accepted & broadcasted", height: block.height });
});

app.listen(PORT, () => console.log(`🏦 ATK-Mint P2P Node running on port ${PORT}`));
