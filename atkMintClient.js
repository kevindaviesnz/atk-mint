const crypto = require('crypto');
const fs = require('fs');

const STATE_FILE = './state.json';
const RPC_ENDPOINT = "http://localhost:3000/mine";
const DIFFICULTY_ENDPOINT = "http://localhost:3000/difficulty";

async function mine() {
    if (!fs.existsSync(STATE_FILE)) {
        console.error("❌ State file missing. Please create a wallet.");
        process.exit(1);
    }

    let state = JSON.parse(fs.readFileSync(STATE_FILE));
    const senderAddress = state.address;
    const currentNonce = state.next_nonce;

    console.log(`📡 Fetching network difficulty target from endpoint...`);
    let networkDifficulty = 4; // Default fallback
    try {
        const diffResponse = await fetch(DIFFICULTY_ENDPOINT);
        if (diffResponse.ok) {
            const data = await diffResponse.json();
            networkDifficulty = data.difficulty;
        }
    } catch (e) {
        console.log("⚠️ Could not reach network for difficulty, defaulting to 4.");
    }

    console.log(`\n⛏️  Initiating Proof of Work... Target: ${networkDifficulty} zeros.`);
    const targetPrefix = '0'.repeat(networkDifficulty);
    let miningNonce = 0;
    let blockHash = "";
    const startTime = Date.now();

    while (true) {
        const dataToHash = `${senderAddress}-${currentNonce}-${miningNonce}`;
        blockHash = crypto.createHash('sha256').update(dataToHash).digest('hex');

        if (blockHash.startsWith(targetPrefix)) {
            break; 
        }
        miningNonce++;
        
        if (miningNonce % 500000 === 0) {
            process.stdout.write('.');
        }
    }

    const timeTaken = (Date.now() - startTime) / 1000;
    console.log(`\n💎 Block Found!`);
    console.log(`[Hash]:   ${blockHash}`);
    console.log(`[Time]:   ${timeTaken} seconds\n`);

    const commitEnvelope = {
        signer_pubkey: senderAddress,
        nonce: currentNonce,
        mining_nonce: miningNonce,
        is_mint: true
    };

    console.log(`📡 Broadcasting block to the decentralized network...`);

    const response = await fetch(RPC_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commitEnvelope)
    });

    if (response.ok) {
        console.log(`🧱 BLOCK MINED & ACCEPTED by consensus!`);
        state.next_nonce = currentNonce + 1;
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    } else {
        const errorData = await response.json().catch(() => ({}));
        console.error(`🚨 NETWORK REJECTED: ${errorData.error || "Consensus failed."}`);
    }
}

mine();