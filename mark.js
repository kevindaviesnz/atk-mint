require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { execSync } = require('child_process');

// --------------------------------------------------
// Configuration
// --------------------------------------------------
const SERVER_URL = 'http://23.95.216.127:3000'; 
const WALLET_FILE = 'wallet.json';
const ATK_BINARY = os.platform() === 'linux' ? './bin/atk-linux' : './bin/atk';

const command = process.argv[2];
const args = process.argv.slice(3);

// --------------------------------------------------
// Identity & Wallet
// --------------------------------------------------
function getWallet() {
    if (!fs.existsSync(WALLET_FILE)) return null;
    try { return JSON.parse(fs.readFileSync(WALLET_FILE, 'utf8')); } 
    catch (e) { return null; }
}

const wallet = getWallet();
const SIGNER_PUBKEY = wallet ? String(wallet.publicKey) : "";

// --------------------------------------------------
// Cryptography Helpers
// --------------------------------------------------
function buildCanonicalString(b) {
    return [
        String(b.signer_pubkey || ""), String(b.nonce ?? "0"), String(b.mining_nonce ?? "0"),
        String(b.recipient || ""), String(b.amount || ""), String(b.type || ""),
        String(b.vm_result || ""), String(b.mark_commit ?? "false"),
        String(b.compiler_payload_raw || ""), String(b.compiler_signature || ""),
        String(b.compiler_pubkey || ""), String(b.previousHash || "0")
    ].join('|');
}

// --------------------------------------------------
// Core Logic: Commit (Mint)
// --------------------------------------------------
async function commitCode(message) {
    console.log("[Mark VCS] Starting Fort Knox Commit Process...");
    if (!wallet) return console.log("❌ No wallet found! Run 'node mark.js init --accept-risks'");

    try {
        const nonceRes = await fetch(`${SERVER_URL}/nonce/${SIGNER_PUBKEY}`);
        const nonceData = await nonceRes.json();
        const nonce = nonceData.nonce ?? 0;
        const previousHash = nonceData.previousHash ?? "0";
        
        const balRes = await fetch(`${SERVER_URL}/balance/${SIGNER_PUBKEY}`);
        const balData = await balRes.json();
        const rawBalanceString = String(balData.balance); 

        if (!fs.existsSync('.mark')) fs.mkdirSync('.mark');
        const gasFile = '.mark/gas.aut';
        const gasScript = `(SYS_COMPUTE, SYS_CREDITS)`;
        fs.writeFileSync(gasFile, gasScript);
        
        console.log(`[Mark VCS] Verifying Linear Logic with Local Compiler...`);
        const output = execSync(`${ATK_BINARY} --file ${gasFile} --json --nonce ${nonce} --compute 1000 --credits ${rawBalanceString}`, { stdio: 'pipe' }).toString().trim();
        const compilerData = JSON.parse(output);
        
        let payload = { 
            signer_pubkey: SIGNER_PUBKEY, nonce, type: 'MINT', mark_commit: true, 
            vm_result: String(compilerData.vm_result || "Int(0)"), compiler_payload_raw: gasScript,
            compiler_signature: String(compilerData.proof_signature || ""), compiler_pubkey: String(compilerData.signer_pubkey || ""),
            previousHash: String(previousHash), message: message || "One Rule to Rule Them All", treeHash: "0" 
        };

        const diffRes = await fetch(`${SERVER_URL}/difficulty`);
        const diffData = await diffRes.json();
        const networkDifficulty = diffData.difficulty;

        console.log(`⛏️  Mining (Dynamic Difficulty: ${networkDifficulty})...`);
        let miningNonce = 0;
        const target = '0'.repeat(networkDifficulty);
        const startTime = Date.now();
        
        while (true) {
            payload.mining_nonce = miningNonce;
            const hash = crypto.createHash('sha256').update(buildCanonicalString(payload)).digest('hex');
            if (hash.startsWith(target)) { payload.hash = hash; break; }
            miningNonce++;
            if (miningNonce % 500000 === 0) process.stdout.write('.');
        }
        
        console.log(`\n✅ Block Mined in ${((Date.now() - startTime) / 1000).toFixed(2)}s!`);

        const privKeyObj = crypto.createPrivateKey({ key: Buffer.from(wallet.privateKey, 'hex'), format: 'der', type: 'pkcs8' });
        payload.signature = crypto.sign(null, Buffer.from(buildCanonicalString(payload)), privKeyObj).toString('hex');

        const payloadPath = 'pending_block.json';
        fs.writeFileSync(payloadPath, JSON.stringify(payload, null, 2));
        console.log(`\x1b[36mcurl -X POST -H "Content-Type: application/json" -d @${payloadPath} ${SERVER_URL}/mine\x1b[0m\n`);

    } catch (e) { console.error(`\n🚨 COMPILER ERROR: ${e.message}`); }
}

// --------------------------------------------------
// Core Logic: Transfer (New!)
// --------------------------------------------------
async function transferFunds(recipientPubKey, amount) {
    console.log(`[Mark VCS] Initiating Transfer of ${amount} ATK-MINT...`);
    if (!wallet) return console.log("❌ No wallet found! Run 'node mark.js init --accept-risks'");

    try {
        const nonceRes = await fetch(`${SERVER_URL}/nonce/${SIGNER_PUBKEY}`);
        const nonceData = await nonceRes.json();
        const nonce = nonceData.nonce ?? 0;
        const previousHash = nonceData.previousHash ?? "0";

        let payload = { 
            signer_pubkey: SIGNER_PUBKEY, 
            nonce, 
            type: 'TRANSFER', 
            recipient: recipientPubKey,
            amount: String(amount),
            previousHash: String(previousHash)
        };

        const diffRes = await fetch(`${SERVER_URL}/difficulty`);
        const diffData = await diffRes.json();
        const networkDifficulty = diffData.difficulty;

        console.log(`⛏️  Mining Transfer (Dynamic Difficulty: ${networkDifficulty})...`);
        let miningNonce = 0;
        const target = '0'.repeat(networkDifficulty);
        const startTime = Date.now();
        
        while (true) {
            payload.mining_nonce = miningNonce;
            const hash = crypto.createHash('sha256').update(buildCanonicalString(payload)).digest('hex');
            if (hash.startsWith(target)) { payload.hash = hash; break; }
            miningNonce++;
            if (miningNonce % 500000 === 0) process.stdout.write('.');
        }
        
        console.log(`\n✅ Transfer Mined in ${((Date.now() - startTime) / 1000).toFixed(2)}s!`);

        const privKeyObj = crypto.createPrivateKey({ key: Buffer.from(wallet.privateKey, 'hex'), format: 'der', type: 'pkcs8' });
        payload.signature = crypto.sign(null, Buffer.from(buildCanonicalString(payload)), privKeyObj).toString('hex');

        const payloadPath = 'pending_transfer.json';
        fs.writeFileSync(payloadPath, JSON.stringify(payload, null, 2));
        
        console.log(`\n--- READY FOR TRANSMISSION ---`);
        console.log(`Run this command to push the transfer to the network:`);
        console.log(`\x1b[36mcurl -X POST -H "Content-Type: application/json" -d @${payloadPath} ${SERVER_URL}/mine\x1b[0m\n`);

    } catch (e) { console.error(`\n🚨 ERROR: ${e.message}`); }
}

// --------------------------------------------------
// Router
// --------------------------------------------------
async function main() {
    switch (command) {
        case 'init':
            if (args[0] !== '--accept-risks') {
                console.log("\n===========================================================");
                console.log("⚠️  WARNING: ATK-MINT IS EXPERIMENTAL BETA SOFTWARE ⚠️");
                console.log("===========================================================");
                console.log("By generating a wallet, you acknowledge that this is an");
                console.log("experimental network. You accept all risks, including the");
                console.log("potential loss of funds or data. The creators hold no liability.");
                console.log("===========================================================\n");
                console.log("To proceed and generate your sovereign identity, run:\n");
                console.log("\x1b[36mnode mark.js init --accept-risks\x1b[0m\n");
                return;
            }

            if (fs.existsSync(WALLET_FILE)) return console.log('✅ Wallet already exists.');
            const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
                publicKeyEncoding: { type: 'spki', format: 'der' },
                privateKeyEncoding: { type: 'pkcs8', format: 'der' }
            });
            fs.writeFileSync(WALLET_FILE, JSON.stringify({ publicKey: publicKey.toString('hex'), privateKey: privateKey.toString('hex') }, null, 2));
            console.log(`✅ Terms accepted. Wallet generated and saved.`);
            break;
            
        case 'commit': await commitCode(args[0]); break;
        case 'transfer': await transferFunds(args[0], args[1]); break;
        case 'balance': 
            try {
                const res = await fetch(`${SERVER_URL}/balance/${SIGNER_PUBKEY}`);
                const data = await res.json();
                console.log(`\n💰 Balance: ${data.balance} ATK-MINT\n`);
            } catch (e) { console.log("❌ Could not reach server."); }
            break;
            
        case 'address': 
            if (wallet) console.log(`\n📬 Address: ${SIGNER_PUBKEY}\n`);
            break;
            
        default: console.log("Usage: node mark.js <init|commit|transfer|balance|address>");
    }
}

main();