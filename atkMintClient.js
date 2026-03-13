const { exec } = require('child_process');
const fs = require('fs');

// We still track the nonce locally to know what to sign, 
// but in a production chain, you would fetch this from the network first.
const STATE_FILE = './state.json';

if (!fs.existsSync(STATE_FILE)) {
    console.log("[Node Client] Initializing sovereign state...");
    const initialState = {
        address: "32bd9b3ed7c6be16393e23d46a2dd0a10321e10fdacc4ee7a97a1900920f8033",
        next_nonce: 1
    };
    fs.writeFileSync(STATE_FILE, JSON.stringify(initialState, null, 2));
}

let state = JSON.parse(fs.readFileSync(STATE_FILE));

const compute = process.argv[2] || 10;
const credits = process.argv[3] || 5;
const currentNonce = state.next_nonce;

// The Local Blockchain RPC Endpoint (Your new express server)
const RPC_ENDPOINT = "http://localhost:3000/mine"; 

console.log(`[Autarky Node] Waking Sovereign Engine... (Nonce: ${currentNonce})`);

// Executing the native compiler against the active linear contract
const cmd = `/usr/local/bin/atk --file main.aut --compute ${compute} --credits ${credits} --nonce ${currentNonce} --json`;

exec(cmd, async (error, stdout) => {
    if (error) {
        console.error("❌ Protocol Halted:", error.message);
        return;
    }

    try {
        const envelope = JSON.parse(stdout);
        const payload = JSON.parse(envelope.payload);

        if (payload.status === "success") {
            console.log(`✅ Execution Verified: Result is ${payload.vm_result}`);
            console.log(`📡 Broadcasting cryptographic proof to the network...`);

            // Broadcast the signed transaction to the blockchain
            const response = await fetch(RPC_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(envelope)
            });

            if (response.ok) {
                console.log(`\n🧱 BLOCKCHAIN ACCEPTED: Transaction successfully mined!`);
                console.log(`[Network Hash]: ${envelope.proof_signature.substring(0, 24)}...`);
                
                // Increment local nonce only after the network accepts the block
                state.next_nonce = currentNonce + 1;
                fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
                console.log(`[State] Nonce incremented to ${state.next_nonce}. Ready for next block.\n`);
            } else {
                console.error(`🚨 NETWORK REJECTED: The blockchain node refused the payload.`);
                
                // Fetch and display the exact reason the network rejected it
                const errorData = await response.json().catch(() => ({}));
                if (errorData.error) {
                    console.error(`[Reason]: ${errorData.error}`);
                }
            }
        }
    } catch (parseError) {
        console.error("❌ Failed to parse Engine output:", parseError.message);
        console.log("Raw Output:", stdout);
    }
});