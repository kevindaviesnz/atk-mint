async function test() {
    const url = 'http://127.0.0.1:54321/blocks';
    console.log(`Checking ${url}...`);
    try {
        const res = await fetch(url);
        const text = await res.text();
        console.log("RESPONSE:", text.substring(0, 100));
    } catch (e) {
        console.log("FETCH ERROR:", e.message);
    }
}
test();