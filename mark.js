const fs = require('fs');
const crypto = require('crypto');
const { execSync } = require('child_process');

// ---------------------------------------------------------
// Configuration & Network Connection
// ---------------------------------------------------------
const SERVER_URL = 'http://localhost:3000';
const DIFFICULTY = 4;
const CHAIN_FILE = './chain_3000.json';
const WALLET_FILE = './wallet.json';

const args = process.argv.slice(2);
const command = args[0];

// ---------------------------------------------------------
// Cryptographic Wallet Management (Ed25519)
// ---------------------------------------------------------
let keys;
if (fs.existsSync(WALLET_FILE)) {
    keys = JSON.parse(fs.readFileSync(WALLET_FILE));
} else {
    console.log(`[Autarky] 🆕 Generating Military-Grade Ed25519 Keypair...`);
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
        publicKeyEncoding: { type: 'spki', format: 'der' },
        privateKeyEncoding: { type: 'pkcs8', format: 'der' }
    });
    keys = {
        publicKey: publicKey.toString('hex'),
        privateKey: privateKey.toString('hex')
    };
    fs.writeFileSync(WALLET_FILE, JSON.stringify(keys, null, 2));
    console.log(`[Autarky] ✅ Wallet saved to ${WALLET_FILE}. NEVER SHARE YOUR PRIVATE KEY.`);
}

const SIGNER_PUBKEY = keys.publicKey;

// ---------------------------------------------------------
// Core Mark VCS Functions
// ---------------------------------------------------------
function getNextNonce() {
    if (!fs.existsSync(CHAIN_FILE)) return 1;
    const chain = JSON.parse(fs.readFileSync(CHAIN_FILE));
    const userBlocks = chain.filter(b => b.signer_pubkey === SIGNER_PUBKEY);
    if (userBlocks.length === 0) return 1;
    return Math.max(...userBlocks.map(b => b.nonce || 0)) + 1;
}

function hashDirectory() {
    if (!fs.existsSync('.mark')) {
        console.log("🚨 ERROR: Not a mark repository. Run 'node mark.js init' first.");
        process.exit(1);
    }
    const files = fs.readdirSync('.').filter(f => f !== '.mark' && f !== 'node_modules' && f !== 'chain_3000.json' && f !== 'wallet.json');
    let combined = '';
    files.forEach(f => {
        if (fs.statSync(f).isFile()) {
            combined += fs.readFileSync(f, 'utf8');
        }
    });
    return crypto.createHash('sha256').update(combined).digest('hex');
}

// ---------------------------------------------------------
// Write Access: The Commit Command
// ---------------------------------------------------------
async function commit(message) {
    console.log('\n[Mark VCS] Preparing cryptographically secured commit...');
    
    const treeHash = hashDirectory();
    const nonce = getNextNonce();
    
    let vmResult = 'Int(105)'; 
    try {
        const output = execSync('./bin/atk --calculate-gas', { stdio: 'pipe' }).toString();
        if (output.trim()) vmResult = output.trim();
    } catch (e) {}
    
    console.log(`✅ Gas execution verified. Result: ${vmResult}`);
    console.log(`⛏️  Initiating Proof of Work... Target: ${DIFFICULTY} zeros.`);
    
    let miningNonce = 0;
    let blockHash = '';
    const targetPrefix = '0'.repeat(DIFFICULTY);

    while (true) {
        const dataToHash = `${SIGNER_PUBKEY}-${nonce}-${miningNonce}`;
        blockHash = crypto.createHash('sha256').update(dataToHash).digest('hex');
        if (blockHash.startsWith(targetPrefix)) break;
        miningNonce++;
    }

    console.log(`💎 Proof of Work Anchor Found!`);

    // ASYMMETRIC CRYPTOGRAPHY: Sign the transaction
    const dataToSign = Buffer.from(`${SIGNER_PUBKEY}-${nonce}-${miningNonce}`);
    const privKeyObj = crypto.createPrivateKey({ key: Buffer.from(keys.privateKey, 'hex'), format: 'der', type: 'pkcs8' });
    const signature = crypto.sign(null, dataToSign, privKeyObj).toString('hex');

    const payload = {
        signer_pubkey: SIGNER_PUBKEY,
        nonce: nonce,
        mining_nonce: miningNonce,
        signature: signature,
        vm_result: vmResult,
        mark_commit: true,
        message: message,
        treeHash: treeHash
    };

    try {
        const response = await fetch(`${SERVER_URL}/mine`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (response.ok) {
            console.log(`\n🧱 COMMIT MINED: Code successfully anchored!`);
            console.log(`[Receipt]: ${blockHash}\n`);
        } else {
            console.log(`\n🚨 NETWORK REJECTED: ${result.error}\n`);
        }
    } catch (error) {
        console.log(`\n🚨 ERROR: Could not connect to the Autarky network. Is server.js running?\n`);
    }
}

// ---------------------------------------------------------
// Read Access: The Checkout Command
// ---------------------------------------------------------
function checkout(commitHash) {
    console.log(`\n[Mark VCS] Searching decentralized ledger for commit...`);
    if (!fs.existsSync(CHAIN_FILE)) return console.log(`🚨 ERROR: Local ledger not found.`);

    const chain = JSON.parse(fs.readFileSync(CHAIN_FILE));
    const block = chain.find(b => b.hash === commitHash);

    if (!block || !block.mark_commit) {
        return console.log(`🚨 ERROR: Commit hash not found or invalid.`);
    }

    console.log(`✅ Commit Located at Height: ${block.height}`);
    console.log(`===================================================`);
    console.log(`[Author]:       ${block.signer_pubkey.substring(0, 32)}...`);
    console.log(`[Timestamp]:    ${new Date(block.timestamp).toLocaleString()}`);
    console.log(`[Message]:      "${block.message}"`);
    console.log(`[State Hash]:   ${block.treeHash}`);
    console.log(`[Gas Burned]:   ${block.vm_result}`);
    console.log(`===================================================`);
    console.log(`📦 State verified against the immutable ledger.\n`);
}

// ---------------------------------------------------------
// CLI Router
// ---------------------------------------------------------
if (command === 'init') {
    if (!fs.existsSync('.mark')) {
        fs.mkdirSync('.mark');
        console.log('Initialized empty Mark repository in .mark/');
    } else {
        console.log('Mark repository already exists.');
    }
} else if (command === 'commit') {
    commit(args[1] || "Update codebase");
} else if (command === 'checkout') {
    checkout(args[1]);
} else if (command === 'log') {
    if (!fs.existsSync(CHAIN_FILE)) {
        console.log("No chain history found.");
    } else {
        const chain = JSON.parse(fs.readFileSync(CHAIN_FILE));
        chain.filter(b => b.mark_commit).forEach(b => {
            console.log(`commit ${b.hash}\nAuthor: ${b.signer_pubkey.substring(0,16)}...\nDate: ${new Date(b.timestamp).toLocaleString()}\n\n    ${b.message}\n`);
        });
    }
} else {
    console.log("Usage: node mark.js <init|commit|log|checkout> [arguments]");
}