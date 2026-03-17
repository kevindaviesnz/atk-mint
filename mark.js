const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const WALLET_FILE = path.join(__dirname, 'wallet.json');
const SERVER_URL = 'https://atk-mint-vault.duckdns.org';

// Colors for the Terminal
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function log(msg) { console.log(`${CYAN}[ATK-Mint]${RESET} ${msg}`); }

function initWallet() {
    if (fs.existsSync(WALLET_FILE)) return log(`${YELLOW}Wallet already exists.${RESET}`);
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
        publicKeyEncoding: { type: 'spki', format: 'der' },
        privateKeyEncoding: { type: 'pkcs8', format: 'der' }
    });
    fs.writeFileSync(WALLET_FILE, JSON.stringify({
        publicKey: publicKey.toString('hex'),
        privateKey: privateKey.toString('hex')
    }, null, 2));
    log(`${GREEN}${BOLD}Sovereign Identity Created!${RESET} Saved to wallet.json`);
}

function getWallet() {
    if (!fs.existsSync(WALLET_FILE)) {
        console.error("No wallet found. Run 'node mark.js init' first.");
        process.exit(1);
    }
    return JSON.parse(fs.readFileSync(WALLET_FILE, 'utf8'));
}

async function getNonceAndHash(pubkey) {
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

async function commit(message) {
    const wallet = getWallet();
    log(`Syncing with ${BOLD}ATK-Mint Vault${RESET}...`);
    
    const { nonce, previousHash } = await getNonceAndHash(wallet.publicKey);
    const diffRes = await fetch(`${SERVER_URL}/difficulty`);
    const { difficulty } = await diffRes.json();

    log(`Mining Block #${nonce} | Difficulty: ${difficulty}...`);

    let block = {
        signer_pubkey: wallet.publicKey,
        nonce: nonce,
        type: "MINT",
        message: message,
        vm_result: "Int(500)", // Fixed mining reward
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
        if (mining_nonce % 100000 === 0) process.stdout.write(".");
    }

    const privKey = crypto.createPrivateKey({ key: Buffer.from(wallet.privateKey, 'hex'), format: 'der', type: 'pkcs8' });
    block.signature = crypto.sign(null, Buffer.from(buildCanonicalString(block)), privKey).toString('hex');

    fs.writeFileSync('pending_block.json', JSON.stringify(block, null, 2));
    
    const time = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`\n${GREEN}${BOLD}✔ Block Mined!${RESET} (${time}s)`);
    console.log(`${YELLOW}Run this to broadcast:${RESET}\ncurl -X POST -H "Content-Type: application/json" -d @pending_block.json ${SERVER_URL}/mine\n`);
}

async function checkBalance() {
    const wallet = getWallet();
    const res = await fetch(`${SERVER_URL}/balance/${wallet.publicKey}`);
    const data = await res.json();
    console.log(`\n${BOLD}Wallet Address:${RESET} ${CYAN}${wallet.publicKey}${RESET}`);
    console.log(`${BOLD}Confirmed Balance:${RESET} ${GREEN}₳ ${new Intl.NumberFormat().format(data.balance)} ATK${RESET}\n`);
}

async function transfer(to, amount) {
    const wallet = getWallet();
    const { nonce, previousHash } = await getNonceAndHash(wallet.publicKey);
    
    log(`Preparing transfer of ${BOLD}₳ ${amount}${RESET} to ${to.substring(0,10)}...`);

    let block = {
        signer_pubkey: wallet.publicKey,
        nonce: nonce,
        type: "TRANSFER",
        recipient: to,
        amount: amount,
        previousHash: previousHash
    };

    const diffRes = await fetch(`${SERVER_URL}/difficulty`);
    const { difficulty } = await diffRes.json();
    const target = '0'.repeat(difficulty);
    let mining_nonce = 0;

    while (true) {
        block.mining_nonce = mining_nonce;
        const hash = crypto.createHash('sha256').update(buildCanonicalString(block)).digest('hex');
        if (hash.startsWith(target)) { break; }
        mining_nonce++;
    }

    const privKey = crypto.createPrivateKey({ key: Buffer.from(wallet.privateKey, 'hex'), format: 'der', type: 'pkcs8' });
    block.signature = crypto.sign(null, Buffer.from(buildCanonicalString(block)), privKey).toString('hex');

    fs.writeFileSync('pending_block.json', JSON.stringify(block, null, 2));
    log(`${GREEN}Transfer Authored!${RESET} Run the curl command to send.`);
}

const [,, cmd, arg1, arg2] = process.argv;
if (cmd === 'init') initWallet();
if (cmd === 'address') console.log(getWallet().publicKey);
if (cmd === 'balance') checkBalance();
if (cmd === 'commit') commit(arg1);
if (cmd === 'transfer') transfer(arg1, arg2);