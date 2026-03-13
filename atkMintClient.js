const { exec } = require('child_process');
const crypto = require('crypto');

const compute = process.argv[2] || 4;
const credits = process.argv[3] || 2;

const cmd = `/usr/local/bin/atk --file mint_test.aut --compute ${compute} --credits ${credits} --json`;

exec(cmd, (error, stdout) => {
    if (error) {
        console.error("❌ Compiler Error:", error.message);
        return;
    }

    const { payload, proof_signature, signer_pubkey } = JSON.parse(stdout);

    // Verify the Ed25519 signature
    const isValid = crypto.verify(
        null,
        Buffer.from(payload),
        {
            key: Buffer.from(`302a300506032b6570032100${signer_pubkey}`, 'hex'), // DER prefix for Ed25519
            format: 'der',
            type: 'spki',
        },
        Buffer.from(proof_signature, 'hex')
    );

    if (isValid) {
        const data = JSON.parse(payload);
        console.log(`\n✅ PROOF VERIFIED: ${data.vm_result} is authentic.`);
        console.log(`[Asset Signature]: ${proof_signature.substring(0, 16)}...`);
    } else {
        console.error("\n🚨 SECURITY ALERT: Cryptographic signature mismatch!");
    }
});