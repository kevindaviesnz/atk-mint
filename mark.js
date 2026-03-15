const fs = require('fs');
const crypto = require('crypto');
const { execSync } = require('child_process');

const SERVER_URL = 'http://localhost:3000';
const WALLET_FILE = './wallet.json';

// Use a stable 32-byte key for AES-256
const ENCRYPTION_KEY = crypto.createHash('sha256').update(process.env.WALLET_PASS || 'autarky_dev_secure').digest();

const args = process.argv.slice(2);
const command = args[0];

// Canonical string updated to match the new INITIAL_DIFFICULTY of 8
function buildCanonicalString(b) {
    return `${b.signer_pubkey}|${b.nonce}|${b.mining_nonce}|${b.recipient || ''}|${b.amount || ''}|${b.type}|${b.vm_result || ''}|${b.mark_commit || false}|${b.compiler_payload_raw || ''}|${b.compiler_signature || ''}|${b.compiler_pubkey || ''}|${b.difficulty || 8}`;
}

function getWalletKeys() {
    if (!fs.existsSync(WALLET_FILE)) return null;
    try {
        const raw = JSON.parse(fs.readFileSync(WALLET_FILE));
        const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, Buffer.from(raw.iv, 'hex'));
        decipher.setAuthTag(Buffer.from(raw.authTag, 'hex'));
        let decrypted = decipher.update(raw.data, 'hex', 'utf8') + decipher.final('utf8');
        return JSON.parse(decrypted);
    } catch (e) {
        console.error("❌ Failed to decrypt wallet. Check your WALLET_PASS.");
        return null;
    }
}

function generateWallet() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
        publicKeyEncoding: { type: 'spki', format: 'der' },
        privateKeyEncoding: { type: 'pkcs8', format: 'der' }
    });
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    const data = cipher.update(JSON.stringify({ publicKey: publicKey.toString('hex'), privateKey: privateKey.toString('hex') }), 'utf8', 'hex') + cipher.final('hex');
    fs.writeFileSync(WALLET_FILE, JSON.stringify({ iv: iv.toString('hex'), authTag: cipher.getAuthTag().toString('hex'), data }));
    console.log("Wallet Generated. Public Key:");
    console.log(publicKey.toString('hex'));
}

const keys = getWalletKeys();
const SIGNER_PUBKEY = keys ? keys.publicKey : '';

// --- Command: log ---
async function log() {
    console.log('[Mark VCS] Fetching Ledger History...\n');
    try {
        const chainRes = await fetch(`${SERVER_URL}/chain`);
        const chain = await chainRes.json();
        const commits = chain.filter(block => block.mark_commit === true);

        if (commits.length === 0) {
            console.log("No commits found on this chain.");
            return;
        }

        commits.reverse().forEach(commit => {
            console.log(`\x1b[33mcommit ${commit.hash}\x1b[0m`);
            console.log(`Author: ${commit.signer_pubkey}`);
            console.log(`Date:   ${new Date(commit.timestamp).toLocaleString()}`);
            console.log(`Result: ${commit.vm_result}`);
            console.log(`\n    ${commit.type} - Verified by Autarky Compiler (atk)\n`);
            console.log('--------------------------------------------------\n');
        });
    } catch (e) {
        console.error("❌ Failed to fetch chain. Is the server running?");
    }
}

// --- Command: balance ---
async function balance() {
    if (!SIGNER_PUBKEY) return console.log("No wallet found.");
    try {
        const chainRes = await fetch(`${SERVER_URL}/chain`);
        const chain = await chainRes.json();
        
        let bal = 0n;
        chain.forEach(block => {
            if ((block.type === 'MINT' || block.type === 'GENESIS') && block.signer_pubkey === SIGNER_PUBKEY) {
                const match = block.vm_result.match(/Int\((-?\d+)\)/);
                if (match) {
                    const amount = BigInt(match[1]);
                    if (block.mark_commit) bal -= amount;
                    else bal += amount;
                }
            }
            if (block.type === 'TRANSFER') {
                const amt = BigInt(block.amount);
                if (block.recipient === SIGNER_PUBKEY) bal += amt;
                if (block.signer_pubkey === SIGNER_PUBKEY) bal -= amt;
            }
        });
        
        console.log(`\n\x1b[32mWallet Balance:\x1b[0m ${bal.toLocaleString()} ATK`);
    } catch (e) {
        console.error("❌ Failed to calculate balance.");
    }
}

// --- Command: send ---
async function send(recipient, amount) {
    console.log(`[Mark VCS] Transferring ${amount} ATK to ${recipient}...`);
    if (!SIGNER_PUBKEY) return console.error("No wallet found.");

    const statusRes = await fetch(`${SERVER_URL}/status/${SIGNER_PUBKEY}`);
    const { nonce, currentDifficulty } = await statusRes.json();

    let payload = {
        signer_pubkey: SIGNER_PUBKEY,
        nonce: nonce,
        type: 'TRANSFER',
        recipient: recipient,
        amount: amount,
        difficulty: currentDifficulty
    };

    let miningNonce = 0;
    const target = '0'.repeat(currentDifficulty);
    process.stdout.write('Mining');
    while (true) {
        payload.mining_nonce = miningNonce;
        const hash = crypto.createHash('sha256').update(buildCanonicalString(payload)).digest('hex');
        if (hash.startsWith(target)) {
            payload.hash = hash;
            break;
        }
        miningNonce++;
        if (miningNonce % 100000 === 0) process.stdout.write('.');
    }

    const privKeyObj = crypto.createPrivateKey({ key: Buffer.from(keys.privateKey, 'hex'), format: 'der', type: 'pkcs8' });
    payload.signature = crypto.sign(null, Buffer.from(buildCanonicalString(payload)), privKeyObj).toString('hex');

    const response = await fetch(`${SERVER_URL}/mine`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload) 
    });
    console.log('\n', await response.json());
}

// --- Command: commit ---
async function commit(message) {
    console.log('[Mark VCS] Committing...');
    if (!SIGNER_PUBKEY) {
        console.error("❌ No wallet found! Run 'node mark.js init'");
        process.exit(1);
    }
    
    const statusRes = await fetch(`${SERVER_URL}/status/${SIGNER_PUBKEY}`);
    const { nonce, currentDifficulty } = await statusRes.json();
    
    if (!fs.existsSync('.mark')) fs.mkdirSync('.mark');
    const gasFile = '.mark/gas.atk';
    if (!fs.existsSync(gasFile)) fs.writeFileSync(gasFile, `add SYS_COMPUTE SYS_CREDITS`);
    
    const output = execSync(`./bin/atk --file ${gasFile} --json --nonce ${nonce} --compute 100 --credits 5`, { stdio: 'pipe' }).toString().trim();
    const compilerData = JSON.parse(output);
    const sanitizedPayloadRaw = compilerData.payload.trim();

    let payload = { 
        signer_pubkey: SIGNER_PUBKEY, 
        nonce: nonce, 
        type: 'MINT', 
        mark_commit: true, 
        vm_result: JSON.parse(sanitizedPayloadRaw).vm_result,
        compiler_payload_raw: sanitizedPayloadRaw,
        compiler_signature: compilerData.proof_signature, 
        compiler_pubkey: compilerData.signer_pubkey,
        difficulty: currentDifficulty
    };

    let miningNonce = 0;
    const target = '0'.repeat(currentDifficulty);
    process.stdout.write('Mining');
    while (true) {
        payload.mining_nonce = miningNonce;
        const hash = crypto.createHash('sha256').update(buildCanonicalString(payload)).digest('hex');
        if (hash.startsWith(target)) {
            payload.hash = hash;
            break;
        }
        miningNonce++;
        if (miningNonce % 100000 === 0) process.stdout.write('.');
    }

    const privKeyObj = crypto.createPrivateKey({ key: Buffer.from(keys.privateKey, 'hex'), format: 'der', type: 'pkcs8' });
    payload.signature = crypto.sign(null, Buffer.from(buildCanonicalString(payload)), privKeyObj).toString('hex');

    const response = await fetch(`${SERVER_URL}/mine`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    console.log('\n', await response.json());
}

async function run() {
    if (command === 'init') generateWallet();
    else if (command === 'commit') await commit(args[1]);
    else if (command === 'log') await log();
    else if (command === 'balance') await balance();
    else if (command === 'send') await send(args[1], args[2]);
    else {
        if (keys) console.log(`Your Public Key: \n${SIGNER_PUBKEY}`);
        else console.log("No wallet found. Run 'node mark.js init'");
    }
}

run();