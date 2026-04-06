import fs from 'fs';
import path from 'path';

// --- CONFIGURATION ---
const CONFIG = {
    IP_URL: "http://23.95.216.127:3000",
    DOMAIN_URL: "https://atk-mint-vault.duckdns.org",
    REQUIRED_ROUTES: [ "/blocks", "/difficulty", "/mempool", "/transactions" ]
};

/**
 * Helper to test GET connectivity
 */
async function testEndpoint( name, url ) {
    console.log( `\n🔍 Testing ${name}: ${url}` );
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout( () => controller.abort(), 5000 );

        const start = Date.now();
        const res = await fetch( url, { 
            method: 'GET', 
            signal: controller.signal 
        } );
        
        clearTimeout( timeoutId );
        const duration = Date.now() - start;

        if ( res.ok ) {
            console.log( `   ✅ Connected! (${res.status}) - ${duration}ms` );
            return true;
        } else {
            const text = await res.text();
            console.log( `   ❌ Server Error (${res.status}): ${text.substring( 0, 50 )}` );
            return false;
        }
    } catch ( e ) {
        console.log( `   🚨 CONNECTION FAILED: ${e.message}` );
        return false;
    }
}

/**
 * The "Logic Check": Tests if the server crashes when receiving data
 * This would have caught the "block is not defined" error!
 */
async function testTransactionLogic() {
    console.log( `\n💸 Testing Transaction Logic (POST) to: ${CONFIG.IP_URL}/transactions` );
    
    // We send a minimal valid-looking dummy transaction
    const dummyTx = { 
        signer_pubkey: "DIAGNOSTIC_TEST_KEY", 
        amount: "0", 
        recipient: "DIAGNOSTIC_RECIPIENT",
        type: "TRANSFER",
        message: "Network Health Check"
    };

    try {
        const res = await fetch( `${CONFIG.IP_URL}/transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify( dummyTx )
        } );

        if ( res.ok ) {
            console.log( "   ✅ Logic Verified: Server accepted the POST request without crashing." );
            return true;
        } else {
            const errText = await res.text();
            console.log( `   ❌ LOGIC CRASH (HTTP ${res.status}):` );
            console.log( `      Server says: ${errText.substring( 0, 150 ).replace( /\n/g, ' ' )}` );
            return false;
        }
    } catch ( e ) {
        console.log( `   🚨 POST FAILED: ${e.message}` );
        return false;
    }
}

/**
 * Main Diagnostic Runner
 */
async function runDiagnostics() {
    console.log( "\n🚀 Starting Autarky Full System Smoke Test..." );
    console.log( "============================================" );

    // 1. Check basic hardware/port connectivity
    const ipWorks = await testEndpoint( "Raw VPS IP", `${CONFIG.IP_URL}/blocks` );

    // 2. Check DNS resolution
    const domainWorks = await testEndpoint( "DuckDNS Domain", `${CONFIG.DOMAIN_URL}/blocks` );

    // 3. Verify all required miner API routes are "visible"
    if ( ipWorks ) {
        console.log( "\n🧪 Checking API Route Visibility..." );
        for ( const route of CONFIG.REQUIRED_ROUTES ) {
            await testEndpoint( `Route [ ${route} ]`, `${CONFIG.IP_URL}${route}` );
        }

        // 4. THE CRITICAL TEST: Verify the server logic actually works
        const logicWorks = await testTransactionLogic();
        
        console.log( "\n============================================" );
        if ( ipWorks && logicWorks ) {
            console.log( "🏁 VERDICT: System is fully operational." );
        } else if ( ipWorks && !logicWorks ) {
            console.log( "🏁 VERDICT: VPS is online but THE CODE IS CRASHING. Check server.js." );
        }
    } else {
        console.log( "\n============================================" );
        console.log( "🏁 VERDICT: VPS is offline. Check Racknerd or PM2." );
    }
    console.log( "============================================\n" );
}

runDiagnostics();