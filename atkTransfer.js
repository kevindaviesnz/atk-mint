const fs = require('fs');
const crypto = require('crypto');

const STATE_FILE = './state.json';
const RPC_ENDPOINT = "http://localhost:3000/transfer";

// Get command line arguments
const recipient = process.argv[2];
const amount = parseInt(process.argv[3], 10);

if (!recipient || isNaN(amount) || amount <= 0) {
    console.log("Usage: node atkTransfer.js <recipient_address> <amount>");
    process.exit(1);
}

if (!fs.existsSync(STATE_FILE)) {
    console.error("❌ State file missing. Cannot sign transaction.");
    process.exit(1);
}

let state = JSON.parse(fs.readFileSync(STATE_FILE));
const senderAddress = state.address;
const currentNonce = state.next_nonce;

console.log(`\n[Autarky Wallet] Preparing Transfer...`);
console.log(`[From]: ${senderAddress.substring(0, 12)}...`);
console.log(`[To]:   ${recipient.substring(0, 12)}...`);
console.log(`[Amt]:  ${amount} ATK`);

// Generate a cryptographic hash of the transaction to act as the signature payload
// In production, this is signed by the private key corresponding to the public address
const txString = `${senderAddress}-${recipient}-${amount}-${currentNonce}`;
const signature = crypto.createHash('sha256').update(txString).digest('hex');

const payload = {
    sender: senderAddress,
    recipient: recipient,
    amount: amount,
    nonce: currentNonce,
    signature: signature
};

async function broadcastTransfer() {
    try {
        console.log(`📡 Broadcasting signed transaction to the network...`);
        const response = await fetch(RPC_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            console.log(`\n✅ TRANSFER ACCEPTED: Funds successfully moved!`);
            
            // Advance the local state only on network consensus
            state.next_nonce = currentNonce + 1;
            fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
        } else {
            const errorData = await response.json().catch(() => ({}));
            console.error(`\n🚨 NETWORK REJECTED: ${errorData.error}`);
        }
    } catch (error) {
        console.error("❌ Failed to connect to the Autarky node.", error.message);
    }
}

broadcastTransfer();