import fs from 'fs';
import path from 'path';

// --- CONFIGURATION ---
const CONFIG = {
    IP_URL: "http://23.95.216.127:3000",
    DOMAIN_URL: "https://atk-mint-vault.duckdns.org",
    REQUIRED_ROUTES: [ "/blocks", "/difficulty", "/mempool" ]
};

/**
 * Helper to test a specific network endpoint
 */
async function testEndpoint( name, url ) {
    console.log( `\n🔍 Testing ${name}: ${url}` );
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout( () => controller.abort(), 5000 ); // 5s timeout

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
            console.log( `   ❌ Server responded with error: ${res.status}` );
            // Try to see if it's a 404 (Route missing) or 500 (Code crash)
            const text = await res.text();
            console.log( `      Message: ${text.substring( 0, 50 )}` );
            return false;
        }
    } catch ( e ) {
        console.log( `   🚨 CONNECTION FAILED: ${e.message}` );
        
        if ( e.message.includes( 'CERT' ) || e.message.includes( 'ssl' ) ) {
            console.log( `      💡 Tip: SSL/HTTPS certificate issue. Use the Raw IP (http) instead.` );
        } else if ( e.message.includes( 'ECONNREFUSED' ) ) {
            console.log( `      💡 Tip: The VPS is up, but Port 3000 is closed or PM2 has crashed.` );
        } else if ( e.name === 'AbortError' ) {
            console.log( `      💡 Tip: Connection timed out. Check your VPS Firewall or Mac internet.` );
        }
        return false;
    }
}

/**
 * Main Diagnostic Runner
 */
async function runDiagnostics() {
    console.log( "\n🚀 Starting Autarky Network Diagnostics..." );
    console.log( "============================================" );

    // 1. Test Raw IP (The "Truth" Test)
    // This tells us if the VPS hardware and Port 3000 are actually alive.
    const ipWorks = await testEndpoint( "Raw VPS IP", `${CONFIG.IP_URL}/blocks` );

    // 2. Test Domain (The "DNS" Test)
    // This tells us if DuckDNS is correctly pointing to your VPS.
    const domainWorks = await testEndpoint( "DuckDNS Domain", `${CONFIG.DOMAIN_URL}/blocks` );

    // 3. Test Miner Routes (The "Plumbing" Test)
    // If the IP works, we check if the specific API routes for mining are present.
    if ( ipWorks ) {
        console.log( "\n🧪 Checking Miner API Routes..." );
        for ( const route of CONFIG.REQUIRED_ROUTES ) {
            await testEndpoint( `Route [ ${route} ]`, `${CONFIG.IP_URL}${route}` );
        }
    }

    console.log( "\n============================================" );
    
    if ( ipWorks && domainWorks ) {
        console.log( "🏁 VERDICT: Network is 100% Healthy. DNS and IP are synced." );
    } else if ( ipWorks && !domainWorks ) {
        console.log( "🏁 VERDICT: VPS is alive, but DuckDNS is failing. Use the IP in mark.js." );
    } else {
        console.log( "🏁 VERDICT: Critical Connection Failure. Check Racknerd VPS status." );
    }
    console.log( "============================================\n" );
}

// Start the check
runDiagnostics();