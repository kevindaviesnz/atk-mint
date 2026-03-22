import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config'; 

// --- ES MODULE FIX: Recreate __dirname ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VAULT_URL = "https://atk-mint-vault.duckdns.org";
const WALLET_FILE = path.join(__dirname, 'wallet.json');


// --- ADD THIS FUNCTION ---
function initWallet() {
    if (fs.existsSync(WALLET_FILE)) {
        console.log("ℹ️  wallet.json already exists. Skipping generation.");
        return;
    }
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
        namedCurve: 'secp256k1',
        publicKeyEncoding: { type: 'spki', format: 'der' },
        privateKeyEncoding: { type: 'pkcs8', format: 'der' }
    });
    const wallet = {
        privateKey: privateKey.toString('hex'),
        publicKey: publicKey.toString('hex')
    };
    fs.writeFileSync(WALLET_FILE, JSON.stringify(wallet, null, 2));
    console.log("✅ New identity generated and saved to wallet.json");
}

function buildCanonicalString(b) {
    return [
        String(b.signer_pubkey || ""), 
        String(b.nonce ?? "0"), 
        String(b.mining_nonce ?? "0"),
        String(b.recipient || ""), 
        String(b.amount || ""), 
        String(b.type || ""),
        String(b.vm_result || ""), 
        String(b.mark_commit ?? "false"),
        String(b.message || ""),             
        String(b.compiler_payload_raw || ""), 
        String(b.compiler_signature || ""),
        String(b.compiler_pubkey || ""), 
        String(b.previousHash || "0")         
    ].join('|');
}

async function getNetworkState(pubkey) {
    try {
        const response = await fetch(`${VAULT_URL}/nonce/${pubkey}`);
        if (!response.ok) throw new Error("Vault unreachable");
        return await response.json();
    } catch (e) {
        console.error("❌ Network Sync Failed:", e.message);
        process.exit(1);
    }
}

function mineBlock(block) {
    let hash = "";
    console.log(`⛏️  Mining MINT block (Difficulty: 6)...`);
    
    while (!hash.startsWith('000000')) {
        block.mining_nonce++;
        const dataStr = buildCanonicalString(block);
        hash = crypto.createHash('sha256').update(dataStr).digest('hex');
    }
    
    block.hash = hash;
    return block;
}

// --- 📉 MONETARY POLICY HELPER ---
function getMiningReward(height) {
    const INITIAL_REWARD = 50000; // 50k ATK
    const HALVING_INTERVAL = 210000; 
    const halvings = Math.floor(height / HALVING_INTERVAL);
    
    // Reward halves every 210,000 blocks
    let reward = INITIAL_REWARD / Math.pow(2, halvings);
    return Math.floor(reward); 
}

// --- ⛏️ THE MINING ENGINE ---
async function mineCommit(message) {

    if (!fs.existsSync(WALLET_FILE)) return console.log("❌ wallet.json not found. Run 'init' first.");
    const wallet = JSON.parse(fs.readFileSync(WALLET_FILE, 'utf8'));

    console.log("📡 Syncing with Vault...");
    const state = await getNetworkState(wallet.publicKey);
    
    // Calculate the reward for the NEXT block being mined
    const nextHeight = state.height + 1;
    const currentReward = getMiningReward(nextHeight);

    let block = {
        signer_pubkey: wallet.publicKey,
        nonce: state.nonce,
        mining_nonce: 0,
        type: "MINT",
        vm_result: `Int(${currentReward})`, // Dynamic reward (starts at 50,000)
        message: message || "ATK-Mint Cloud Block",
        mark_commit: true,
        previousHash: state.previousHash,
        timestamp: Date.now()
    };

    console.log(`\n⛏️  Mining Block #${nextHeight}...`);
    console.log(`💰 Target Reward: ₳ ${currentReward} ATK`);
    
    // 1. Solve the Proof of Work
    const minedBlock = mineBlock(block); 

    // 2. Sign the completed block
    const dataToSign = buildCanonicalString(minedBlock);
    const privateKey = crypto.createPrivateKey({
        key: Buffer.from(wallet.privateKey, 'hex'),
        format: 'der',
        type: 'pkcs8'
    });
    minedBlock.signature = crypto.sign(null, Buffer.from(dataToSign), privateKey).toString('hex');

    // 3. Transmit to Racknerd Vault
    console.log("🚀 Submitting block to network...");
    try {
        const response = await fetch(`${VAULT_URL}/blocks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(minedBlock)
        });

        const result = await response.json();

        if (response.ok) {
            console.log(`✅ SUCCESS! Block #${result.height} accepted.`);
            console.log(`🔗 Hash: ${minedBlock.hash.substring(0, 16)}...`);
        } else {
            console.error(`❌ Vault Rejected Block: ${JSON.stringify(result)}`);
        }
    } catch (e) {
        console.error(`❌ Network Error: ${e.message}`);
    }
}

async function checkBalance() {
    // Check if an address was provided in the command (process.argv)
    // If not, fall back to the local wallet.json
    const targetAddress = process.argv[3] || (fs.existsSync(WALLET_FILE) ? JSON.parse(fs.readFileSync(WALLET_FILE, 'utf8')).publicKey : null);
    if (!targetAddress) {
        return console.log("❌ No address provided and no wallet.json found.");
    }
    
    try {
        const res = await fetch(`${VAULT_URL}/balance/${targetAddress.trim()}`);
        const data = await res.json();
        
        // We use targetAddress here so the printout matches what you asked for
        console.log(`\n💳 Wallet Address: ${targetAddress}`);
        console.log(`💰 Confirmed Balance: ₳ ${data.balance} ATK\n`);
    } catch (e) {
        console.log("❌ Network Error:", e.message);
    }
}

function showAddress() {
    if (!fs.existsSync(WALLET_FILE)) return console.log("❌ wallet.json not found.");
    const wallet = JSON.parse(fs.readFileSync(WALLET_FILE, 'utf8'));
    console.log(`\n🔑 Your Public Key:\n${wallet.publicKey}\n`);
}

async function transferATK(recipient, amount, message = "") {
    if (!fs.existsSync(WALLET_FILE)) return console.log("❌ wallet.json not found.");
    const wallet = JSON.parse(fs.readFileSync(WALLET_FILE, 'utf8'));
    const state = await getNetworkState(wallet.publicKey);

    // 1. Create the transaction object
    let tx = {
        signer_pubkey: wallet.publicKey,
        nonce: state.nonce,
        recipient: recipient.trim(),
        amount: amount.toString(),
        message: message, // Anchor data goes here
        type: "TRANSFER",
        timestamp: Date.now()
    };

    // 2. Sign it (No mining required!)
    const dataToSign = JSON.stringify(tx); // Simplified for the mempool
    const privateKey = crypto.createPrivateKey({
        key: Buffer.from(wallet.privateKey, 'hex'),
        format: 'der',
        type: 'pkcs8'
    });
    tx.signature = crypto.sign(null, Buffer.from(dataToSign), privateKey).toString('hex');

    // 3. Send to the NEW /transactions endpoint
    try {
        const response = await fetch(`${VAULT_URL}/transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tx)
        });

        if (response.ok) {
            console.log(`✅ Success! Asset broadcasted to Vault Mempool.`);
        } else {
            const err = await response.json();
            console.log(`❌ Vault Rejected: ${err.error}`);
        }
    } catch (e) {
        console.log(`❌ Network Error: ${e.message}`);
    }
}

// --- NEW HELPER FOR THE GALLERY ---
async function getTransactionHistory(address) {
    try {
        const blockRes = await fetch(`${VAULT_URL}/blocks`);
        const blocks = blockRes.ok ? await blockRes.json() : [];

        // 🎯 THE FIX: Unpack the embedded assets from mined blocks
        let chainHistory = [];
        blocks.forEach(b => {
            chainHistory.push(b);
            if (b.mempool_payload) {
                // Give them the block height so the gallery knows they are anchored
                const anchoredAssets = b.mempool_payload.map(tx => ({ ...tx, height: b.height }));
                chainHistory.push(...anchoredAssets);
            }
        });

        const mempoolRes = await fetch(`${VAULT_URL}/mempool`);
        const mempool = mempoolRes.ok ? await mempoolRes.json() : [];
        const pendingTxs = mempool.map(tx => ({ ...tx, isPending: true }));

        return [...chainHistory, ...pendingTxs];
    } catch (e) {
        return [];
    }
}

// --- CLI ROUTER ---
const command = (process.argv[2] || "").trim();
const message = process.argv[3] || "ATK-Mint Cloud Block";

switch (command) {

    case 'verify': {
        const filePath = process.argv[3];

        if (!filePath || !fs.existsSync(filePath)) {
            console.log("❌ Error: File to verify not found. Check your path.");
            process.exit(1);
        }

        // 1. Generate the hash of the local file
        const absolutePath = path.resolve(filePath.trim());
        const fileBuffer = fs.readFileSync(absolutePath);
        const localHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

        console.log(`🔍 Scanning local file: ${path.basename(absolutePath)}`);
        console.log(`🧬 Local Fingerprint: ${localHash}\n`);
        console.log("📡 Auditing Sovereign Ledger...\n");

        if (!fs.existsSync(WALLET_FILE)) {
            console.log("❌ wallet.json not found.");
            process.exit(1);
        }
        const myAddress = JSON.parse(fs.readFileSync(WALLET_FILE, 'utf8')).publicKey;
        
        // 2. Scan the blockchain for that exact hash
        const history = await getTransactionHistory(myAddress);
        let verified = false;

        history.forEach(tx => {
            const msg = tx.message || (tx.data && tx.data.message) || "";
            if (msg.includes(localHash)) {
                verified = true;
                console.log(`✅ VERIFIED: This file is mathematically authentic!`);
                console.log(`🧱 Found securely anchored in Block: #${tx.height || tx.index || 'Unknown'}`);
            }
        });

        if (!verified) {
            console.log("❌ UNVERIFIED: This exact file fingerprint does not exist on your blockchain.");
            console.log("   (If even a single comma was changed in the file, the fingerprint will fail).");
        }
        break;
    }
        
    case 'gallery': {
        console.log("📂 --- Your Sovereign Digital Asset Gallery ---");
        
        const myAddress = JSON.parse(fs.readFileSync(WALLET_FILE, 'utf8')).publicKey;
        const history = await getTransactionHistory(myAddress);
        
        let assetsFound = false;

        history.forEach(tx => {
            const msg = tx.message || (tx.data && tx.data.message) || "";
            
            // 🎯 THE FIX: Check that the signer_pubkey matches myAddress
            if (msg && msg.startsWith('ATK_ASSET|') && tx.signer_pubkey === myAddress) {
                assetsFound = true;
                const parts = msg.split('|');
                const name = parts[1] || "Unknown Asset";
                const hash = parts[2] ? parts[2].replace('HASH:', '') : 'Unknown';
                
                // Check if this came from the mempool or the chain
                const statusLabel = tx.isPending ? "⏳ PENDING (Awaiting Block)" : `🧱 ANCHORED (Block #${tx.height})`;
                
                console.log(`✅ Asset: ${name}`);
                console.log(`   🧬 Fingerprint: ${hash}`);
                console.log(`   🛡️ Status: ${statusLabel}`);
                console.log('--------------------------------------------');
            }
        });

        if (!assetsFound) {
            console.log("📭 Your gallery is currently empty.");
        }
        break;
    }
        
    case 'anchor': {

        const assetPath = process.argv[3];
        const assetName = process.argv[3] || 'Untitled Asset';
        
        if (!assetPath || !fs.existsSync(assetPath)) {
            console.log("❌ Error: File not found. Check your file path.");
            process.exit(1);
        }

        if (!fs.existsSync(WALLET_FILE)) {
            console.log("❌ wallet.json not found.");
            process.exit(1);
        }
        
        const myAddress = JSON.parse(fs.readFileSync(WALLET_FILE, 'utf8')).publicKey;

        // 1. Generate the unique Digital Fingerprint (SHA-256)
        const fileBuffer = fs.readFileSync(assetPath);
        const hashSum = crypto.createHash('sha256');
        hashSum.update(fileBuffer);
        const hexHash = hashSum.digest('hex');

        // 2. Format the metadata string
        const metadata = `ATK_ASSET|${assetName}|HASH:${hexHash}`;

        // 3. Trigger a self-transfer with the metadata
        console.log(`🔗 Anchoring Asset: ${assetName}...`);
        console.log(`🧬 Fingerprint: ${hexHash}`);
        
        // Use transfer instead of mining for instant submission to the Mempool
        transferATK(myAddress, 0.0001, metadata); 
        
        console.log("✅ Asset broadcasted to Vault Mempool!");
        console.log("⏳ It will be permanently anchored when the next block is mined.");

        break;
    }

    case 'init':
        initWallet();
        break;
    case 'send':
    case 'transfer':
        transferATK(process.argv[3], process.argv[4]);
        break;
    case 'commit':
    case 'mine':
        mineCommit(process.argv[3] || "Cloud Block");
        break;
    case 'balance':
        checkBalance();
        break;
    case 'address':
        showAddress();
        break;
    default:
        console.log(`❌ Invalid command: '${command}'. Use init, send, balance, or mine.`);
}