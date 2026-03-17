require('dotenv').config();
const fs = require('fs');
const http = require('http');

// 1. Parse Command Line Arguments
const recipient = process.argv[2];
const amount = parseInt(process.argv[3], 10);

if (!recipient || isNaN(amount)) {
    console.log("Autarky Transfer Client");
    console.log("Usage: node atkTransfer.js <recipient_address> <amount>");
    process.exit(1);
}

// 2. Load Local Sovereign Identity
if (!fs.existsSync('wallet.json')) {
    console.log("❌ wallet.json is missing. Cannot authorize transfer.");
    process.exit(1);
}

if (!process.env.WALLET_PASS) {
    console.log("❌ WALLET_PASS is missing in .env. Cannot unlock private key.");
    process.exit(1);
}

const walletData = JSON.parse(fs.readFileSync('wallet.json', 'utf8'));
const senderAddress = walletData.publicKey;

// ---------------------------------------------------------
// ⚠️ Drop your existing AES-256-GCM decryption logic here
// const privateKey = decrypt(walletData.encryptedPrivateKey, walletData.iv, process.env.WALLET_PASS);
//
// ⚠️ Drop your existing Ed25519 signing logic here
// const signature = signTransaction(senderAddress, recipient, amount, privateKey);
// ---------------------------------------------------------

// Construct the transaction payload
const transactionPayload = JSON.stringify({
    sender: senderAddress,
    recipient: recipient,
    amount: amount,
    signature: "INSERT_GENERATED_SIGNATURE_HERE", // Replace with your actual signature variable
    timestamp: Date.now()
});

console.log(`💸 Initiating transfer of ${amount} atk-mint to ${recipient.substring(0, 16)}...`);

// 3. Broadcast to the Central Bank (Local Node)
const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/transactions', // Adjust if your server endpoint is named differently
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(transactionPayload)
    }
};

const req = http.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
            console.log("✅ Transaction verified and accepted into the mempool.");
            console.log("Run 'node mark.js balance' to see your updated funds.");
        } else {
            console.log(`❌ Transaction REJECTED by Double-Spend Firewall (Status: ${res.statusCode})`);
            console.log(`Reason: ${data}`);
        }
    });
});

req.on('error', (e) => {
    console.log(`❌ Failed to reach the local Autarky node: ${e.message}`);
    console.log("   Make sure 'node server.js' is running.");
});

req.write(transactionPayload);
req.end();