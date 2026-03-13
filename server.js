const express = require('express');
const crypto = require('express'); // Note: actually we need 'crypto' from Node's standard library
// Let me correct that standard library import:
const cryptoNode = require('crypto');
const fs = require('fs');

const app = express();
app.use(express.json());

const PORT = 3000;
const CHAIN_FILE = './chain.json';

// Initialize the Blockchain Ledger if it doesn't exist
if (!fs.existsSync(CHAIN_FILE)) {
    console.log("[Blockchain Network] Initializing Genesis Block...");
    fs.writeFileSync(CHAIN_FILE, JSON.stringify([], null, 2));
}

// The Mining Endpoint (Receives broadcasts from your atkMintClient)
app.post('/mine', (req, res) => {
    const envelope = req.body;
    
    if (!envelope.payload || !envelope.proof_signature || !envelope.signer_pubkey) {
        return res.status(400).json({ error: "Invalid broadcast format." });
    }

    try {
        // 1. Cryptographic Verification
        const isValid = cryptoNode.verify(
            null,
            Buffer.from(envelope.payload),
            {
                key: Buffer.from(`302a300506032b6570032100${envelope.signer_pubkey}`, 'hex'), // DER formatting for Ed25519
                format: 'der',
                type: 'spki',
            },
            Buffer.from(envelope.proof_signature, 'hex')
        );

        if (!isValid) {
            console.error(`🚨 [NETWORK REJECTED] Invalid signature from ${envelope.signer_pubkey.substring(0, 8)}...`);
            return res.status(401).json({ error: "Cryptographic signature mismatch." });
        }

        const payloadData = JSON.parse(envelope.payload);
        const incomingNonce = payloadData.nonce;

        // 2. Replay Attack Prevention (Check Nonce)
        let chain = JSON.parse(fs.readFileSync(CHAIN_FILE));
        
        // Find the last transaction from this specific wallet address
        const userTxs = chain.filter(tx => tx.signer_pubkey === envelope.signer_pubkey);
        const lastTx = userTxs[userTxs.length - 1];
        
        if (lastTx) {
            const lastPayload = JSON.parse(lastTx.payload);
            if (incomingNonce <= lastPayload.nonce) {
                console.error(`🚨 [NETWORK REJECTED] Replay attack detected! Nonce ${incomingNonce} already spent.`);
                return res.status(409).json({ error: "Nonce too low. Replay attack prevented." });
            }
        }

        // 3. Consensus Achieved - Add to Blockchain
        const newBlock = {
            block_height: chain.length + 1,
            timestamp: Date.now(),
            network_hash: cryptoNode.createHash('sha256').update(envelope.proof_signature).digest('hex'),
            ...envelope
        };

        chain.push(newBlock);
        fs.writeFileSync(CHAIN_FILE, JSON.stringify(chain, null, 2));

        console.log(`\n🧱 [BLOCK MINED] Height: ${newBlock.block_height} | Result: ${payloadData.vm_result} | Nonce: ${incomingNonce}`);
        console.log(`🔗 Network Hash: ${newBlock.network_hash}`);

        return res.status(200).json({ message: "Block successfully mined.", block_height: newBlock.block_height });

    } catch (error) {
        console.error("❌ Internal Network Error:", error.message);
        return res.status(500).json({ error: "Failed to process block." });
    }
});

app.listen(PORT, () => {
    console.log(`\n🌐 Autarky Blockchain Network Live on port ${PORT}`);
    console.log(`Listening for cryptographically secured blocks...\n`);
});