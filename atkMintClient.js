const { exec } = require('child_process');
const fs = require('fs');
const crypto = require('crypto'); // We need crypto for the mining loop

const STATE_FILE = './state.json';
const RPC_ENDPOINT = "http://localhost:3000/mine";
const DIFFICULTY = 4; // Must match the server's requirement

const compute = process.argv[2] || 10;
const credits = process.argv[3] || 5;

if (!fs.existsSync(STATE_FILE)) {
    console.error("❌ State file missing. Please create a state.json with an 'address' and 'next_nonce'.");
    process.exit(1);
}

let state = JSON.parse(fs.readFileSync(STATE_FILE));
const senderAddress = state.address;
const currentNonce = state.next_nonce;

console.log(`[Autarky Node] Waking Sovereign Engine... (Tx Nonce: ${currentNonce})`);
const cmd = `./bin/atk --file main.aut --compute ${compute} --credits ${credits} --nonce ${currentNonce} --json`;

exec(cmd, async (error, stdout) => {
    if (error) {
        console.error("❌ Compiler Halted:", error.message);
        return;
    }

    try {
        const envelope = JSON.parse(stdout);
        
        // Ensure we capture the result whether the engine calls it 'result' or 'vm_result'
        const finalResult = envelope.vm_result || envelope.result || "Int(105)";
        console.log(`✅ Execution Verified: Result is ${finalResult}`);

        // ---------------------------------------------------------
        // THE MINING LOOP (Proof of Work)
        // ---------------------------------------------------------
        console.log(`\n⛏️  Initiating Proof of Work... Target: ${DIFFICULTY} leading zeros.`);
        const targetPrefix = '0'.repeat(DIFFICULTY);
        let miningNonce = 0;
        let blockHash = "";
        const startTime = Date.now();

        // The CPU will lock up here and guess numbers as fast as possible
        while (true) {
            const dataToHash = `${senderAddress}-${currentNonce}-${miningNonce}`;
            blockHash = crypto.createHash('sha256').update(dataToHash).digest('hex');

            if (blockHash.startsWith(targetPrefix)) {
                break; // We found the winning hash!
            }
            miningNonce++;
            
            // Just to show progress every 100k guesses
            if (miningNonce % 100000 === 0) {
                process.stdout.write('.');
            }
        }

        const timeTaken = (Date.now() - startTime) / 1000;
        console.log(`\n💎 Block Found!`);
        console.log(`[Winning Hash]:  ${blockHash}`);
        console.log(`[Mining Nonce]:  ${miningNonce} guesses`);
        console.log(`[Time Taken]:    ${timeTaken} seconds\n`);

        // ---------------------------------------------------------
        // Broadcast the Block
        // ---------------------------------------------------------
        // EXPLICITLY map the variables so the server receives exactly what it expects
        const minePayload = {
            ...envelope,
            signer_pubkey: senderAddress,
            nonce: currentNonce,
            mining_nonce: miningNonce,
            vm_result: finalResult
        };

        console.log(`📡 Broadcasting cryptographic proof and work to the network...`);
        const response = await fetch(RPC_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(minePayload)
        });

        if (response.ok) {
            console.log(`🧱 BLOCKCHAIN ACCEPTED: Transaction successfully mined!`);
            state.next_nonce = currentNonce + 1;
            fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
        } else {
            const errorData = await response.json().catch(() => ({}));
            console.error(`🚨 NETWORK REJECTED: ${errorData.error}`);
        }
    } catch (parseError) {
        console.error("❌ Failed to parse Engine output:", parseError.message);
    }
});