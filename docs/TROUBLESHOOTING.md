# Troubleshooting Guide

### 🚨 Error: `fetch failed` during transmission
**Cause:** Mining took too long and the Node.js HTTP request timed out before the server could respond.
**Solution:** Your Mac successfully saved the signed block to `pending_block.json`. You do not need to remine. Simply push it manually:
`curl -X POST -H "Content-Type: application/json" -d @pending_block.json http://<SERVER_IP>:3000/mine`

### 🚨 Error: `Formal Verification Failed / Linear Logic Violation`
**Cause:** The server's OS executed the `atk-linux` binary, but the state data (like the balance or nonce) passed by the server didn't perfectly match what the client signed. 
**Solution:** Ensure the client and server are fully synced. Run `node mark.js balance` to ensure the correct string value is being passed to the compiler.

### 🚨 Error: `exec ./bin/atk-linux: no such file or directory` (Inside Docker)
**Cause:** The "Alpine Linux Trap." You are using `node:alpine` in your Dockerfile, which lacks the standard `glibc` library required to run standard Linux binaries.
**Solution:** Change your Dockerfile base image to `FROM node:20-slim`, then rebuild the container.

### 🚨 Error: `Cryptographic identity mismatch.`
**Cause:** The server failed to verify the Ed25519 signature. This usually happens if the public key is double-wrapped with an SPKI header, or if the `autarky.key` on the server does not match the `autarky.key` on the client.
**Solution:** Ensure the hex string inside `/opt/atk-mint-node/autarky.key` matches exactly between your local machine and the VPS.