const fs = require('fs');
const crypto = require('crypto');

const SERVER_URL = 'http://23.95.216.127:3000';
const DIFFICULTY = 6; 

const WALLET_FILE = './wallet.json';

if (!fs.existsSync(WALLET_FILE)) {
    console.error("❌ No wallet.json found! Please run atkMintClient.js first to generate a wallet and mine some coins.");
    process.exit(1);
}

// 📂 Load Sender Wallet
const data = JSON.parse(fs.readFileSync(WALLET_FILE));
const senderKeys = {
    publicKey: crypto.createPublicKey({ key: Buffer.from(data.publicKey, 'hex'), format: 'der', type: 'spki' }),
    privateKey: crypto.createPrivateKey({ key: Buffer.from(data.privateKey, 'hex'), format: 'der', type: 'pkcs8' })
};
const senderPubkey = senderKeys.publicKey.export({ format: 'der', type: 'spki' }).subarray(12).toString('hex');

// 👽 Generate a Dummy Wallet (Recipient)
const dummyKeys = crypto.generateKeyPairSync('ed25519');
const dummyPubkey = dummyKeys.publicKey.export({ format: 'der', type: 'spki' }).subarray(12).toString('hex');

function buildCanonicalString(b) {
    return `${b.signer_pubkey}|${b.nonce}|${b.mining_nonce}|${b.recipient || ''}|${b.amount || ''}|${b.type}|${b.vm_result || ''}|${b.mark_commit || false}|${b.compiler_payload || ''}|${b.compiler_signature || ''}|${b.compiler_pubkey || ''}|${b.previousHash}`;
}

async function getChainState() {
    const res = await fetch(`${SERVER_URL}/nonce/${senderPubkey}`);
    return await res.json();
}

async function checkBalance(pubkey) {
    const res = await fetch(`${SERVER_URL}/balance/${pubkey}`);
    const data = await res.json();
    return data.balance;
}

async function sendTransfer(amount) {
    console.log(`\n🏦 Sender Pubkey: ${senderPubkey.slice(0, 16)}...`);
    const balance = await checkBalance(senderPubkey);
    console.log(`💰 Current Balance: ${balance} atk-mint`);
    
    if (balance < amount) {
        console.error(`❌ Insufficient funds to send ${amount}.`);
        process.exit(1);
    }

    console.log(`\n🚀 Initiating Transfer of ${amount} to:`);
    console.log(`👽 Recipient: ${dummyPubkey.slice(0, 16)}...`);

    const state = await getChainState();
    
    const payload = {
        signer_pubkey: senderPubkey,
        nonce: state.nonce,
        mining_nonce: 0,
        type: "TRANSFER",
        recipient: dummyPubkey,
        amount: amount,
        previousHash: state.previousHash
    };

    console.log(`\n⏳ Mining the Transfer Block (Difficulty ${DIFFICULTY})...`);
    let hash = "";
    let dataStr = "";

    while (true) {
        dataStr = buildCanonicalString(payload);
        hash = crypto.createHash('sha256').update(dataStr).digest('hex');
        if (hash.startsWith('0'.repeat(DIFFICULTY))) break;
        payload.mining_nonce++;
        if (payload.mining_nonce % 500000 === 0) process.stdout.write('.');
    }

    console.log(`\n💎 Block Found! Hash: ${hash}`);
    payload.signature = crypto.sign(null, Buffer.from(dataStr), senderKeys.privateKey).toString('hex');

    const res = await fetch(`${SERVER_URL}/mine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    
    const result = await res.json();
    if (res.ok) {
        console.log(`✅ TRANSFER SUCCESSFUL! Sent ${amount} atk-mint.`);
        const newBalance = await checkBalance(senderPubkey);
        console.log(`🏦 New Balance: ${newBalance} atk-mint`);
    } else {
        console.log(`🚨 REJECTED: ${result.error}`);
    }
}

sendTransfer(10);
