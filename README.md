# 🛡️ Autarky Network (ATK-MINT)

> **A Decoupled, Air-Gapped Architecture for Decentralized Proof-of-Work Consensus.**

Autarky is a highly secure, utility-focused Layer-1 blockchain built for the cloud-computing era. By fundamentally decoupling cryptographic key management from intensive computational hashing, ATK-Mint allows operators to mine the native **₳** asset across unsecured global servers without ever exposing their financial treasury.

**[🌐 View the Live Network Explorer](https://kevindaviesnz.github.io/atk-mint/explorer.html)** | **[📄 Read the Official Whitepaper](https://www.google.com/search?q=WHITEPAPER.md)**

-----

## ⚠️ Beta Software & Liability Disclaimer

**ATK-MINT IS EXPERIMENTAL BETA SOFTWARE.**
By cloning, compiling, running, or transacting on this network, you explicitly acknowledge that this is an experimental peer-to-peer system. You accept all risks associated with its use, including but not limited to the potential loss of funds, loss of data, or network failures. The creators and contributors hold **zero liability**.

**Do not use this software for high-value financial transactions.**

-----

## ✨ Core Architecture: The Autarky Advantage

ATK-Mint discards the legacy "monolithic node" design in favor of strict physical and logical decoupling:

  * **The Brain & The Muscle:** Network communication and state logic are handled by a lightweight, sandboxed JavaScript Control Layer (`mark.js`). Raw Proof-of-Work hashing is delegated to an OS-native, air-gapped Sovereign Engine (`atk`).
  * **The Identity Firewall:** Node identity (`autarky.key`) is separated from financial wealth (`wallet.json`). You can deploy thousands of cloud mining nodes; even if a server is completely compromised, the attacker only gains a disconnected hashing calculator, while your ₳ wealth remains mathematically untouchable.
  * **The Gravity Shield:** The network features a Dynamic Difficulty Engine that continuously adjusts the hashing target based on global computational power to maintain a steady block cadence.
  * **Hybrid-to-Hydra Topology:** In its current Compliance Phase, state is arbitrated by a highly secure Vault via HTTPS/DuckDNS, paving the way for the Phase 2 transition to "Hydra"—a fully decentralized WebSocket gossip protocol.

-----

## 🚀 Quick Start (For Users & Investors)

You do not need to run a computationally heavy server to participate in the economy. The Control Layer acts as a secure, lightweight client.

### 1\. Clone & Setup

```bash
git clone https://github.com/kevindaviesnz/atk-mint.git
cd atk-mint
npm install
```

### 2\. Generate Your Financial Wallet

Initialize your local environment to create your `wallet.json` file. This is your "Bank Account" where your ₳ balances are stored. **Keep this file secure and never upload it to a cloud server.**

```bash
node mark.js init --accept-risks
```

### 3\. Check Your Balance

```bash
node mark.js balance
```

### 4\. Transact on the Network

Send ₳ to another public key. The Control Layer will sign the transaction locally and securely broadcast it to the global ledger.

```bash
node mark.js transfer <RECIPIENT_PUBLIC_KEY> <AMOUNT>
```

-----

## 🖥️ Run a Sovereign Node (For Miners)

Want to secure the network and earn the **₳ 500** block reward? You can deploy a Sovereign Engine on any Mac or Linux machine.

### 1\. Initialize the Air-Gapped Environment

Run the setup script. This will automatically detect your OS, promote the correct native binary (`atk-linux` or `atk-mac`) into the active `bin/` directory, and generate your node's unique `autarky.key` (Work ID).

```bash
./setup.sh
```

### 2\. Start the Mining Rig

Once initialized, launch your miner. The engine will begin grinding hashes to discover a valid block nonce.

```bash
./miner.sh "My Sovereign Node"
```

*Note: For Phase 1, ensure your node can reach the Vault on **Port 3000 (HTTP API)**. Phase 2 (Hydra) will utilize **Port 6000 (P2P)**.*

-----

## 📊 The Web3 Explorer

Autarky features a native, browser-based Analytics Dashboard that reads directly from the blockchain state to display the global rich list, circulating supply, and a live block feed.

It runs entirely client-side and can be accessed securely here:
👉 **[Autarky Global Dashboard](https://kevindaviesnz.github.io/atk-mint/explorer.html)**

-----

## 📜 License

MIT License. See `LICENSE` for details.

