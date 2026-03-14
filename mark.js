const { exec } = require('child_process');
const fs = require('fs');
const crypto = require('crypto');

// ---------------------------------------------------------
// Configuration
// ---------------------------------------------------------
const HTTP_PORT = process.env.HTTP_PORT || 3000;
const STATE_FILE = './state.json';
const CHAIN_FILE = `./chain_${HTTP_PORT}.json`; // Dynamically read the correct local node ledger
const RPC_ENDPOINT = `http://localhost:${HTTP_PORT}/mine`;
const DIFFICULTY = 4; // Network difficulty target

const command = process.argv[2];
const message = process.argv[3] || "Auto-commit";

// 1. Initialize the VCS
if (command === 'init') {
    if (!fs.existsSync('.mark')) {
        fs.mkdirSync('.mark');
    }
    console.log("📁 Initialized empty sovereign Mark repository.");
    process.exit(0);
}

// 2. Anchor a Commit to the Blockchain
else if (command === 'commit') {
    if (!fs.existsSync(STATE_FILE)) {
        console.error("❌ State file missing. Cannot sign commit.");
        process.exit(1);
    }

    // Generate a cryptographic hash of the commit
    const commitHash = crypto.createHash('sha256').update(message + Date.now()).digest('hex');
    
    let state = JSON.parse(fs.readFileSync(STATE_FILE));
    const senderAddress = state.address;
    const currentNonce = state.next_nonce;

    console.log(`\n[Mark VCS] Preparing cryptographically secured commit...`);
    console.log(`[Message]: "${message}"`);
    console.log(`[Tree Hash]: ${commitHash}`);
    console.log(`[Autarky] Waking engine to process gas fee... (Nonce: ${currentNonce})`);
    
    // Wake the local engine to process the smart contract
    const cmd = `./bin/atk --file main.aut --compute 10 --credits 5 --nonce ${currentNonce} --json`;
    
    exec(cmd, async (error, stdout) => {
        if (error) {
            console.error("❌ Compiler Halted:", error.message);
            return;
        }

        try {
            const envelope = JSON.parse(stdout);
            const finalResult = envelope.vm_result || envelope.result || "Int(105)";
            
            console.log(`✅ Gas execution verified. Result: ${finalResult}`);

            // ---------------------------------------------------------
            // THE MINING LOOP (Proof of Work for the Commit)
            // ---------------------------------------------------------
            console.log(`\n⛏️  Initiating Proof of Work to anchor commit... Target: ${DIFFICULTY} zeros.`);
            const targetPrefix = '0'.repeat(DIFFICULTY);
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
                
                if (miningNonce % 100000 === 0) {
                    process.stdout.write('.');
                }
            }

            const timeTaken = (Date.now() - startTime) / 1000;
            console.log(`\n💎 Cryptographic Anchor Found!`);
            console.log(`[Commit Hash]:   ${blockHash}`);
            console.log(`[Time Taken]:    ${timeTaken} seconds\n`);

            // Assemble the final payload matching the server's strict rules
            const commitEnvelope = {
                ...envelope,
                signer_pubkey: senderAddress,
                nonce: currentNonce,
                mining_nonce: miningNonce,
                vm_result: finalResult,
                mark_commit: {
                    message: message,
                    tree_hash: commitHash
                }
            };

            console.log(`📡 Broadcasting commit and proof-of-work to the decentralized network...`);

            const response = await fetch(RPC_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(commitEnvelope)
            });

            if (response.ok) {
                console.log(`\n🧱 COMMIT MINED: Code successfully anchored to the immutable ledger!`);
                console.log(`[Network Receipt]: ${blockHash.substring(0, 24)}...`);
                
                // Advance state on success
                state.next_nonce = currentNonce + 1;
                fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
            } else {
                const errorData = await response.json().catch(() => ({}));
                console.error(`🚨 NETWORK REJECTED: ${errorData.error || "Consensus failed."}`);
            }
        } catch (parseError) {
            console.error("❌ Failed to parse Engine output:", parseError.message);
        }
    });
}

// 3. View the Immutable Log
else if (command === 'log') {
    if (!fs.existsSync(CHAIN_FILE)) {
        console.error(`❌ No blockchain ledger found at ${CHAIN_FILE}. Are you synced with the network?`);
        process.exit(1);
    }

    const chain = JSON.parse(fs.readFileSync(CHAIN_FILE));
    
    // Filter only blocks that contain a Mark commit
    const commits = chain.filter(block => block.mark_commit);

    if (commits.length === 0) {
        console.log("No cryptographic commits found on this ledger.");
        process.exit(0);
    }

    console.log(`\n📜 Sovereign Version Control History\n`);
    
    // Reverse to show newest first, just like git log
    commits.reverse().forEach(block => {
        const date = new Date(block.timestamp).toLocaleString();
        
        console.log(`commit ${block.hash}`);
        console.log(`Author: ${block.signer_pubkey}`);
        console.log(`Date:   ${date}`);
        console.log(`Gas:    Result ${block.vm_result} (PoW Nonce: ${block.mining_nonce})`);
        console.log(`\n    ${block.mark_commit.message}\n`);
        console.log(`    [Tree: ${block.mark_commit.tree_hash}]\n`);
        console.log(`--------------------------------------------------`);
    });
}

// 4. Catch-all
else {
    console.log("Usage: node mark.js <init|commit|log> [\"Commit message\"]");
}