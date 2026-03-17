const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const envPath = fs.existsSync(path.join(__dirname, 'node.env')) ? path.join(__dirname, 'node.env') : path.join(__dirname, 'client.env');
require('dotenv').config({ path: envPath });

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.HTTP_PORT || 3000;
const CHAIN_FILE = path.join(__dirname, 'chain_3000.json');
const DIFFICULTY = 6; 

const ATK_BINARY = os.platform() === 'linux' ? path.join(__dirname, 'bin', 'atk-linux') : path.join(__dirname, 'bin', 'atk');

function loadChain() {
    if (fs.existsSync(CHAIN_FILE)) {
        try { return JSON.parse(fs.readFileSync(CHAIN_FILE, 'utf8')); } 
        catch (e) { console.error("⚠️ Error reading chain file."); }
    }
    
    const genesisBlock = {
        height: 0,
        timestamp: 1710565200000,
        type: "GENESIS",
        signer_pubkey: "302a300506032b657003210085187c9322b928c2df50eeebaa39be0f787b3d099de5a22d51011175bf8a6656",
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

app.get('/nonce/:pubkey', (req, res) => {
    const chain = loadChain();
    const lastBlock = chain[chain.length - 1];
    let maxNonce = -1;
    chain.forEach(block => {
        if (block.signer_pubkey === req.params.pubkey && block.nonce > maxNonce) maxNonce = block.nonce;
    });
    res.json({ nonce: maxNonce + 1, previousHash: lastBlock.hash });
});

app.get('/balance/:pubkey', (req, res) => res.json({ pubkey: req.params.pubkey, balance: getBalance(req.params.pubkey) }));

app.post('/mine', (req, res) => {
    const payload = req.body;
    let chain = loadChain();
    const lastBlock = chain[chain.length - 1];

    if (payload.previousHash !== lastBlock.hash) return res.status(400).json({ error: "Chain Splice Detected." });

    const currentBalance = getBalance(payload.signer_pubkey);

    if (payload.compiler_payload_raw) {
        console.log(`🛡️ Intercepted Smart Contract. Executing Formal Verification...`);
        try {
            const tempFilePath = path.join(os.tmpdir(), `script_${Date.now()}.aut`);
            fs.writeFileSync(tempFilePath, payload.compiler_payload_raw);

            execFileSync(ATK_BINARY, [
                '--file', tempFilePath,
                '--json',
                '--nonce', payload.nonce.toString(),
                '--compute', '1000', 
                '--credits', currentBalance.toString() 
            ], { encoding: 'utf8', stdio: 'pipe' });

            fs.unlinkSync(tempFilePath); 
            console.log(`✅ Linear Types Verified.`);
        } catch (error) {
            console.error("🚨 REAL COMPILER ERROR REVEALED:");
            console.error("Message:", error.message);
            console.error("Stdout:", error.stdout ? error.stdout.toString() : "None");
            console.error("Stderr:", error.stderr ? error.stderr.toString() : "None");
            return res.status(400).json({ error: "Formal Verification Failed. Check Server Logs." });
        }
    } 
    
    const dataStr = buildCanonicalString(payload);
    const hash = crypto.createHash('sha256').update(dataStr).digest('hex');
    
    if (!hash.startsWith('0'.repeat(DIFFICULTY))) return res.status(400).json({ error: "Insufficient Work" });

    // --- THE FIX: Cleanly import the SPKI key without double-wrapping ---
    let isVerified = false;
    try {
        const pubKeyObj = crypto.createPublicKey({
            key: Buffer.from(payload.signer_pubkey, 'hex'),
            format: 'der',
            type: 'spki'
        });
        isVerified = crypto.verify(
            null, 
            Buffer.from(dataStr), 
            pubKeyObj, 
            Buffer.from(payload.signature, 'hex')
        );
    } catch (error) {
        console.error("❌ Key parsing error:", error.message);
    }

    if (!isVerified) return res.status(400).json({ error: "Cryptographic identity mismatch." });

    payload.hash = hash;
    payload.timestamp = Date.now();
    payload.height = chain.length;
    chain.push(payload);
    saveChain(chain);
    
    console.log(`💎 BLOCK ACCEPTED | Height: ${payload.height} | Type: ${payload.type}`);
    res.status(200).json({ message: "Success!", block: payload });
});

app.listen(PORT, () => console.log(`🛡️ Autarky Node Online | Port: ${PORT}`));