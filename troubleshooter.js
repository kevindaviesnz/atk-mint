const { authorizeDebugCycle, analyzeStackTrace } = require('./atkMintClient');

console.log("=== Autonomous DevOps Troubleshooter ===");
console.log("Status: ONLINE. Monitoring CI/CD pipeline...");

// Simulate a pipeline failure occurring after 2 seconds
setTimeout(async () => {
    console.log("\n[!] ALERT: Pipeline deployment failed.");
    const dummyLog = "FATAL: process exited with code 137 (OOMKilled)";
    
    // Agent calculates it needs 4 hours of compute and 2 credits to solve this
    const hoursNeeded = 4;
    const creditsNeeded = 2;
    
    // 1. Ask the mathematical void for authorization
    const isAuthorized = await authorizeDebugCycle(hoursNeeded, creditsNeeded);
    
    if (isAuthorized) {
        // 2. If paid for, run the analysis
        await analyzeStackTrace(dummyLog);
        console.log("\n[Agent] Fix deployed. Resuming monitoring...");
    } else {
        // 3. If broke, halt
        console.log("\n[Agent] Insufficient funds to debug this error. Escalating to human admin.");
        process.exit(1);
    }
}, 2000);
