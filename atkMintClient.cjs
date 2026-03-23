const fs = require('fs');
const crypto = require('crypto');

const SERVER_URL = 'http://23.95.216.127:3000';
const DIFFICULTY = 6; 

// 🔐 Persistent Wallet System
const WALLET_FILE = './wallet.json';
let keys;

if (fs.existsSync(WALLET_FILE)) {
    const data = JSON.parse(fs.readFileSync(WALLET_FILE));
    keys = {
        publicKey: crypto.createPublicKey({ key: Buffer.from(data.publicKey, 'hex'), format: 'der', type: 'spki' }),
        privateKey: crypto.createPrivateKey({ key: Buffer.from(data.privateKey, 'hex'), format: 'der', type: 'pkcs8' })
    };
    console.log("📂 Loaded existing wallet.json");
} else {
    keys = crypto.generateKeyPairSync('ed25519');
    fs.writeFileSync(WALLET_FILE, JSON.stringify({
        publicKey: keys.publicKey.export({ format: 'der', type: 'spki' }).toString('hex'),
        privateKey: keys.privateKey.export({ format: 'der', type: 'pkcs8' }).toString('hex')
    }, null, 2));
    console.log("✨ Created new wallet.json");
}

const pubKeyHex = keys.publicKey.export({ format: 'der', type: 'spki' }).subarray(12).toString('hex');
const privateKey = keys.privateKey;

function buildCanonicalString(b) {
    return `${b.signer_pubkey}|${b.nonce}|${b.mining_nonce}|${b.recipient || ''}|${b.amount || ''}|${b.type}|${b.vm_result || ''}|${b.mark_commit || false}|${b.compiler_payload || ''}|${b.compiler_signature || ''}|${b.compiler_pubkey || ''}|${b.previousHash}`;
}

async function getChainState() {
    const res = await fetch(`${SERVER_URL}/nonce/${pubKeyHex}`);
    if (!res.ok) throw new Error("Failed to fetch state");
    return await res.json();
}

async function mineCoin() {
    console.log(`\n[Autarky Miner] Pubkey: ${pubKeyHex.slice(0, 16)}...`);
    const state = await getChainState();
    
    const payload = {
        signer_pubkey: pubKeyHex,
        nonce: state.nonce,
        mining_nonce: 0,
        type: "MINT",
        vm_result: "Int(50)",
        previousHash: state.previousHash
    };

    console.log(`⏳ Hashing... (Difficulty ${DIFFICULTY})`);
    let hash = "";
    let dataStr = "";

    while (true) {
        dataStr = buildCanonicalString(payload);
        hash = crypto.createHash('sha256').update(dataStr).digest('hex');
        if (hash.startsWith('0'.repeat(DIFFICULTY))) break;
        payload.mining_nonce++;
        if (payload.mining_nonce % 500000 === 0) process.stdout.write('.');
    }

    console.log(`\n💎 Success! Hash Found: ${hash}`);
    payload.signature = crypto.sign(null, Buffer.from(dataStr), privateKey).toString('hex');

    try {
        const res = await fetch(`${SERVER_URL}/mine`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (res.ok) console.log(`✅ BLOCK ACCEPTED: 50 atk-mint added to your wallet.`);
        else console.log(`🚨 REJECTED: ${result.error}`);
    } catch (e) {
        console.error("❌ Failed to submit block to the server.");
    }
}

async function startMining() {
    console.log("🚀 Autopilot Engaged. Press Ctrl+C to stop.");
    while (true) {
        await mineCoin();
        console.log("⏳ Resting for 2 seconds...\n");
        await new Promise(resolve => setTimeout(resolve, 2000)); 
    }
}

startMining();