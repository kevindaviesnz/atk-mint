const fs = require('fs');
const crypto = require('crypto');

// ---------------------------------------------------------
// Configuration
// ---------------------------------------------------------
const SERVER_URL = 'http://localhost:3000';
const DIFFICULTY = 4;
const CHAIN_FILE = './chain_3000.json';
const WALLET_FILE = './wallet.json';

const args = process.argv.slice(2);
const recipient = args[0];
const amount = args[1];

if (!recipient || !amount) {
    console.log("Usage: node atkTransfer.js <recipient_address> <amount>");
    process.exit(1);
}

if (!fs.existsSync(WALLET_FILE)) {
    console.log("🚨 ERROR: wallet.json not found. You need a secure wallet to send funds.");
    process.exit(1);
}

const keys = JSON.parse(fs.readFileSync(WALLET_FILE));
const SIGNER_PUBKEY = keys.publicKey;

function getNextNonce() {
    if (!fs.existsSync(CHAIN_FILE)) return 1;
    const chain = JSON.parse(fs.readFileSync(CHAIN_FILE));
    const userBlocks = chain.filter(b => b.signer_pubkey === SIGNER_PUBKEY);
    if (userBlocks.length === 0) return 1;
    return Math.max(...userBlocks.map(b => b.nonce || 0)) + 1;
}

// ---------------------------------------------------------
// Transfer Execution
// ---------------------------------------------------------
async function transfer() {
    console.log(`\n[Autarky Wallet] Initiating secure transfer of ${amount} atk-mint...`);
    console.log(`[To]: ${recipient.substring(0,32)}...`);
    
    const nonce = getNextNonce();
    let miningNonce = 0;
    let blockHash = '';
    const targetPrefix = '0'.repeat(DIFFICULTY);

    console.log(`⛏️  Performing Proof of Work to anchor transaction...`);
    while (true) {
        const dataToHash = `${SIGNER_PUBKEY}-${nonce}-${miningNonce}`;
        blockHash = crypto.createHash('sha256').update(dataToHash).digest('hex');
        if (blockHash.startsWith(targetPrefix)) break;
        miningNonce++;
    }

    // ASYMMETRIC CRYPTOGRAPHY: Sign the transaction
    const dataToSign = Buffer.from(`${SIGNER_PUBKEY}-${nonce}-${miningNonce}`);
    const privKeyObj = crypto.createPrivateKey({ key: Buffer.from(keys.privateKey, 'hex'), format: 'der', type: 'pkcs8' });
    const signature = crypto.sign(null, dataToSign, privKeyObj).toString('hex');

    const payload = {
        signer_pubkey: SIGNER_PUBKEY,
        nonce: nonce,
        mining_nonce: miningNonce,
        signature: signature,
        type: 'TRANSFER',
        recipient: recipient,
        amount: amount,
        mark_commit: false
    };

    try {
        const response = await fetch(`${SERVER_URL}/mine`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        if (response.ok) {
            console.log(`✅ SUCCESS: Transfer complete! Network Receipt: ${blockHash}\n`);
        } else {
            console.log(`🚨 REJECTED: ${result.error}\n`);
        }
    } catch (e) {
        console.log(`🚨 ERROR: Could not connect to Autarky node. Is server.js running?\n`);
    }
}

transfer();