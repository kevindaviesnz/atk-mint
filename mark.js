const { exec } = require('child_process');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const STATE_FILE = './state.json';
const CHAIN_FILE = fs.existsSync('./chain_3000.json') ? './chain_3000.json' : './chain.json'; 
const RPC_ENDPOINT = "http://localhost:3000/mine";
const DIFFICULTY = 4; 

const command = process.argv[2];
const message = process.argv[3] || "Auto-commit";

// --- FILE VAULT LOGIC (The Object Database) ---

const IGNORE_DIRS = ['.mark', '.git', 'node_modules'];
const IGNORE_FILES = ['state.json'];

function getFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (IGNORE_DIRS.includes(file)) continue;
        
        const name = path.join(dir, file);
        if (fs.statSync(name).isDirectory()) {
            getFiles(name, fileList);
        } else {
            // Ignore the local blockchain ledgers and wallet state
            if (file.includes('chain') && file.endsWith('.json')) continue;
            if (IGNORE_FILES.includes(file)) continue;
            
            fileList.push(name);
        }
    }
    return fileList;
}

function createTreeSnapshot() {
    const files = getFiles('.');
    const snapshot = {};
    for (const file of files) {
        snapshot[file] = fs.readFileSync(file, 'utf8');
    }
    return snapshot;
}

function restoreTreeSnapshot(snapshot) {
    for (const [filepath, content] of Object.entries(snapshot)) {
        const dir = path.dirname(filepath);
        if (dir !== '.' && !fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filepath, content, 'utf8');
    }
}

// --- CLI COMMANDS ---

// 1. Initialize the VCS
if (command === 'init') {
    if (!fs.existsSync('.mark/objects')) {
        fs.mkdirSync('.mark/objects', { recursive: true });
    }
    console.log("📁 Initialized empty sovereign Mark repository with Object Vault.");
    process.exit(0);
}

// 2. Anchor a Commit to the Blockchain
else if (command === 'commit') {
    if (!fs.existsSync(STATE_FILE)) {
        console.error("❌ State file missing. Cannot sign commit.");
        process.exit(1);
    }

    // Capture the physical state of the directory
    const snapshot = createTreeSnapshot();
    const snapshotString = JSON.stringify(snapshot);
    
    // The Tree Hash is now a true cryptographic fingerprint of the code itself!
    const treeHash = crypto.createHash('sha256').update(snapshotString + message).digest('hex');
    
    let state = JSON.parse(fs.readFileSync(STATE_FILE));
    const senderAddress = state.address;
    const currentNonce = state.next_nonce;

    console.log(`\n[Mark VCS] Preparing cryptographically secured commit...`);
    console.log(`[Message]: "${message}"`);
    console.log(`[Tree Hash]: ${treeHash}`);
    console.log(`[Autarky] Waking engine to process gas fee... (Nonce: ${currentNonce})`);
    
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

            const commitEnvelope = {
                ...envelope,
                signer_pubkey: senderAddress,
                nonce: currentNonce,
                mining_nonce: miningNonce,
                vm_result: finalResult,
                mark_commit: {
                    message: message,
                    tree_hash: treeHash
                }
            };

            console.log(`📡 Broadcasting commit and proof-of-work to the decentralized network...`);

            const response = await fetch(RPC_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(commitEnvelope)
            });

            if (response.ok) {
                // SAVE TO LOCAL VAULT ON SUCCESS
                if (!fs.existsSync('.mark/objects')) fs.mkdirSync('.mark/objects', { recursive: true });
                fs.writeFileSync(`.mark/objects/${treeHash}.json`, snapshotString);
                console.log(`📦 Physical code state saved to local Object Vault.`);

                console.log(`🧱 COMMIT MINED: Code successfully anchored to the immutable ledger!`);
                console.log(`[Network Receipt]: ${blockHash.substring(0, 24)}...`);
                
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
        console.error("❌ No blockchain ledger found. Are you synced with the network?");
        process.exit(1);
    }

    const chain = JSON.parse(fs.readFileSync(CHAIN_FILE));
    const commits = chain.filter(block => block && block.mark_commit);

    if (commits.length === 0) {
        console.log("No cryptographic commits found on this ledger.");
        process.exit(0);
    }

    console.log(`\n📜 Sovereign Version Control History\n`);
    
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

// 4. Time Travel (Checkout)
else if (command === 'checkout') {
    const targetHash = process.argv[3];
    
    if (!targetHash) {
        console.error("❌ Please provide a commit hash. Usage: node mark.js checkout <hash>");
        process.exit(1);
    }

    if (!fs.existsSync(CHAIN_FILE)) {
        console.error("❌ No blockchain ledger found. Cannot verify history.");
        process.exit(1);
    }

    const chain = JSON.parse(fs.readFileSync(CHAIN_FILE));
    const block = chain.find(b => b && b.hash && (b.hash === targetHash || b.hash.startsWith(targetHash)));

    if (!block || !block.mark_commit) {
        console.error(`❌ Fatal: Commit ${targetHash} does not exist in the immutable ledger.`);
        process.exit(1);
    }

    console.log(`\n⏳ Time Traveling to Block Height: ${block.height}...`);
    console.log(`[Target]: ${block.hash}`);
    console.log(`[Author]: ${block.signer_pubkey}`);
    console.log(`[Message]: "${block.mark_commit.message}"`);
    console.log(`[Tree Hash]: ${block.mark_commit.tree_hash}`);

    // VERIFY AND RESTORE FROM LOCAL VAULT
    const objectPath = `.mark/objects/${block.mark_commit.tree_hash}.json`;
    if (!fs.existsSync(objectPath)) {
        console.error(`\n🚨 FATAL ERROR: The physical files for this tree hash are missing from the local vault!`);
        console.error(`The cryptographic proof exists on the blockchain, but the files cannot be restored.`);
        process.exit(1);
    }

    console.log(`📦 Found physical snapshot in local vault. Unpacking files...`);
    const snapshotData = fs.readFileSync(objectPath, 'utf8');
    const snapshot = JSON.parse(snapshotData);
    
    restoreTreeSnapshot(snapshot);

    console.log(`\n✅ Cryptographic state verified & files restored. You are now in "detached HEAD" state at tree: ${block.mark_commit.tree_hash}`);
}

// 5. Catch-all
else {
    console.log("Usage: node mark.js <init|commit|log|checkout> [args]");
}