const { exec } = require('child_process');

// Ingest dynamic arguments
const compute = parseInt(process.argv[2], 10) || 1;
const credits = parseInt(process.argv[3], 10) || 1;

console.log(`[Node Client] Waking the Native MacOS Autarky Engine...`);
console.log(`[Node Client] Requesting ${compute} compute hours and ${credits} diag credits.\n`);

// Directly invoke the native MacOS binary with the new JSON flag
const cmd = `/usr/local/bin/atk --file mint_test.aut --compute ${compute} --credits ${credits} --json`;

exec(cmd, (error, stdout, stderr) => {
    if (error) {
        console.error(`[Node Client Error]: Execution failed.`, error.message);
        if (stderr) console.error(`[STDERR]: ${stderr}`);
        return;
    }

    try {
        // Parse the beautiful JSON output from your Rust compiler
        const response = JSON.parse(stdout.trim());

        if (response.status === "success") {
            console.log(`[Node Client] --- ATK-MINT LIFECYCLE COMPLETE ---`);
            console.log(`[Node Client] Status: VERIFIED`);
            console.log(`[Node Client] VM Result: ${response.vm_result}`);
            console.log(`[Node Client] Injected: Compute(${response.injected_resources.compute}), Credits(${response.injected_resources.credits})`);
            console.log(`\n✅ The Autarky AI Troubleshooter is authorized to proceed.`);
        } else {
            console.error(`[Node Client] ❌ DENIED: Protocol halted by Autarky engine.`);
        }
    } catch (parseError) {
        console.error(`[Node Client Error]: Failed to parse Autarky JSON output.`, parseError.message);
        console.log(`Raw Output:\n${stdout}`);
    }
});