const { exec } = require('child_process');
const fs = require('fs');

const STATE_FILE = './state.json';

// 1. Load Persistence Layer
let state = { next_nonce: 1 };
if (fs.existsSync(STATE_FILE)) {
    state = JSON.parse(fs.readFileSync(STATE_FILE));
}

const compute = process.argv[2] || 10;
const credits = process.argv[3] || 5;
const currentNonce = state.next_nonce;

console.log(`[Node Client] Waking Engine... (Nonce: ${currentNonce})`);

// 2. Execute Autarky Protocol
const cmd = `/usr/local/bin/atk --file mint_test.aut --compute ${compute} --credits ${credits} --nonce ${currentNonce} --json`;

exec(cmd, (error, stdout) => {
    if (error) {
        console.error("❌ Protocol Halted:", error.message);
        return;
    }

    const envelope = JSON.parse(stdout);
    const payload = JSON.parse(envelope.payload);

    if (payload.status === "success") {
        console.log(`✅ Transaction Confirmed: ${payload.vm_result}`);
        
        // 3. Atomic State Update
        state.next_nonce = currentNonce + 1;
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
        
        console.log(`[State] Nonce incremented to ${state.next_nonce}. Proof saved.`);
    }
});