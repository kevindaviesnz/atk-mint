const fs = require('fs');
const STATE_FILE = './state.json';

// Initialize state if it doesn't exist
if (!fs.existsSync(STATE_FILE)) {
    console.log("[Node Client] No state found. Initializing new sovereign state...");
    const initialState = {
        // This address would ideally be fetched from the 'atk' binary's public key
        address: "32bd9b3ed7c6be16393e23d46a2dd0a10321e10fdacc4ee7a97a1900920f8033",
        next_nonce: 1
    };
    fs.writeFileSync(STATE_FILE, JSON.stringify(initialState, null, 2));
}

let state = JSON.parse(fs.readFileSync(STATE_FILE));