# 🛡️ Autarky Network (ATK-MINT)

> **A fully autonomous, mathematically verifiable Layer 1 Blockchain and decentralized economy.**

Autarky is a lightweight, high-security Proof-of-Work (PoW) blockchain built from the ground up. It features a custom formal-verification compiler (written in Rust), a peer-to-peer gossip protocol (Hydra), and dynamic Nakamoto Consensus—all orchestrated by a lean Node.js runtime.

**[🌐 View the Live Network Explorer](https://kevindaviesnz.github.io/atk-mint/explorer.html)**

---

## ⚠️ Beta Software & Liability Disclaimer
**ATK-MINT IS EXPERIMENTAL BETA SOFTWARE.**
By cloning, compiling, running, or transacting on this network, you explicitly acknowledge that this is an experimental peer-to-peer system. You accept all risks associated with its use, including but not limited to the potential loss of funds, loss of data, or network failures. The creators and contributors hold **zero liability**. 

**Do not use this software for high-value financial transactions.**

---

## ✨ Core Architecture

* **The Vault (Rust VM):** All transactions are formally verified by a custom, strictly-scoped Rust binary (`atk`) before they can enter the mempool. It only understands linear, predictable logic to prevent smart-contract vulnerabilities.
* **Nakamoto Consensus:** The network dynamically adjusts mining difficulty based on global hash power to maintain steady block times.
* **The Hydra Protocol:** Nodes communicate via a custom WebSocket P2P gossip protocol on Port 6000, ensuring state consensus and automatically resolving chain splits in favor of the heaviest chain.
* **Ed25519 Cryptography:** Wallets and transactions are secured using military-grade Ed25519 elliptic curve signatures.

---

## 🚀 Quick Start (For Users)

Want to join the economy? You don't need to run a server to transact. Just use the built-in CLI client.

### 1. Clone & Setup
```bash
git clone [https://github.com/kevindaviesnz/atk-mint.git](https://github.com/kevindaviesnz/atk-mint.git)
cd atk-mint
npm install

```

### 2. Generate Your Sovereign Identity

To interact with the network, you must first generate a local keypair. This will create a `wallet.json` file. **Keep this file secure and never commit it to Git.**

```bash
node mark.js init --accept-risks

```

### 3. Check Your Balance & Address

```bash
node mark.js address
node mark.js balance

```

### 4. Send ATK

Send funds to another public key. Your CPU will automatically grind the Proof-of-Work to mine the transfer into the global ledger.

```bash
node mark.js transfer <RECIPIENT_PUBLIC_KEY> <AMOUNT>

```

---

## 🖥️ Run a Full Node (For Miners/Operators)

Want to decentralize the network and process transactions? You can spin up an Autarky Vault using Docker.

1. Ensure Docker and OpenSSL are installed on your machine.
2. Run the initialization script to generate your node's sovereign compiler secret:
```bash
./setup.sh

```


3. Deploy the generated `node.env` file and the `Dockerfile` to your server.
4. Open ports **3000 (HTTP API)** and **6000 (P2P Protocol)** on your firewall.

---

## 📊 The Web3 Explorer

Autarky features a native, browser-based Analytics Dashboard that reads directly from the blockchain state to display the global rich list, circulating supply, and a live block feed.

It runs entirely client-side and can be accessed securely here:
👉 **[Autarky Global Dashboard](https://www.google.com/url?sa=E&source=gmail&q=https://kevindaviesnz.github.io/atk-mint/explorer.html)**

---

## 📜 License

MIT License. See `LICENSE` for details.

```



