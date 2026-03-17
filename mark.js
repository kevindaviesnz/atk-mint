const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

// Configuration
const WALLET_FILE = path.join(__dirname, 'wallet.json');
const SERVER_URL = 'https://atk-mint-vault.duckdns.org';

// Terminal Styling
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function log(msg) { console.log(`${CYAN}[ATK-Mint]${RESET} ${msg}`); }

/**
 * Creates a new Ed25519 Wallet and saves it to disk.
 */
function initWallet() {
    if (fs.existsSync(WALLET_FILE)) {
        return log(`${YELLOW}Wallet already exists at ${WALLET_FILE}${RESET}`);
    }

    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
        publicKeyEncoding: { type: 'spki', format: 'der' },
        privateKeyEncoding: { type: 'pkcs8', format: 'der' }
    });

    const walletData = {
        publicKey: publicKey.toString('hex'),
        privateKey: privateKey.toString('hex')
    };

    fs.writeFileSync(WALLET_FILE, JSON.stringify(walletData, null, 2));
    
    log(`${GREEN}${BOLD}✔ Sovereign Identity Created!${RESET}`);
    log(`Address: ${CYAN}${walletData.publicKey}${RESET}`);
}

function getWallet() {
    if (!fs.existsSync(WALLET_FILE)) {
        console.error(`${RED}No wallet found. Run 'node mark.js init' first.${RESET}`);
        process.exit(1);
    }
    return JSON.parse(fs.readFileSync(WALLET_FILE, 'utf8'));
}

async function getNetworkState(pubkey) {
    const res = await fetch(`${SERVER_URL}/nonce/${pubkey}`);
    return await res.json();
}

function buildCanonicalString(b) {
    return [
        String(b.signer_pubkey || ""), String(b.nonce ?? "0"), String(b.mining_nonce ?? "0"),
        String(b.recipient || ""), String(b.amount || ""), String(b.type || ""),
        String(b.vm_result || ""), String(b.mark_commit ?? "false"),
        String(b.compiler_payload_raw || ""), String(b.compiler_signature || ""),
        String(b.compiler_pubkey || ""), String(b.previousHash || "0")
    ].join('|');
}

/**
 * Mines a new block.
 */
async function commit(message) {
    const wallet = getWallet();
    log(`Syncing with ${BOLD}ATK-Mint Vault${RESET}...`);
    
    // Fetch nonce for THIS wallet and the latest global hash
    const { nonce, previousHash } = await getNetworkState(wallet.publicKey);
    
    const diffRes = await fetch(`${SERVER_URL}/difficulty`);
    const { difficulty } = await diffRes.json();

    log(`Mining Wallet Nonce #${nonce} | Difficulty: ${difficulty}...`);

    let block = {
        signer_pubkey: wallet.publicKey,
        nonce: nonce,
        type: "MINT",
        message: message || "Automated Network Validator",
        vm_result: "Int(500)", // ₳ 500 Reward
        mark_commit: true,
        previousHash: previousHash
    };

    let mining_nonce = 0;
    const target = '0'.repeat(difficulty);
    const start = Date.now();

    while (true) {
        block.mining_nonce = mining_nonce;
        const hash = crypto.createHash('sha256').update(buildCanonicalString(block)).digest('hex');
        if (hash.startsWith(target)) {
            block.hash = hash;
            break;
        }
        mining_nonce++;
        if (mining_nonce % 500000 === 0) process.stdout.write(".");
    }

    const privKey = crypto.createPrivateKey({ 
        key: Buffer.from(wallet.privateKey, 'hex'), 
        format: 'der', 
        type: 'pkcs8' 
    });
    
    block.signature = crypto.sign(null, Buffer.from(buildCanonicalString(block)), privKey).toString('hex');

    fs.writeFileSync('pending_block.json', JSON.stringify(block, null, 2));
    
    const time = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`\n${GREEN}${BOLD}✔ Block Mined!${RESET} (${time}s)`);
    console.log(`${YELLOW}Stored in pending_block.json${RESET}\n`);
}

async function checkBalance() {
    const wallet = getWallet();
    const res = await fetch(`${SERVER_URL}/balance/${wallet.publicKey}`);
    const data = await res.json();
    console.log(`\n${BOLD}Wallet Address:${RESET} ${CYAN}${wallet.publicKey}${RESET}`);
    console.log(`${BOLD}Confirmed Balance:${RESET} ${GREEN}₳ ${new Intl.NumberFormat().format(data.balance)} ATK${RESET}\n`);
}

// CLI Routing
const [,, cmd, arg1, arg2] = process.argv;
if (cmd === 'init') initWallet();
else if (cmd === 'address') console.log(getWallet().publicKey);
else if (cmd === 'balance') checkBalance();
else if (cmd === 'commit') commit(arg1);
else {
    console.log(`Usage: node mark.js [init|address|balance|commit]`);
}