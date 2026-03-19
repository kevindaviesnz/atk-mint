# 🛡️ Autarky Network (ATK-MINT)

## **"The World's Most Secure Node Architecture"**

> **A Decoupled, Air-Gapped Architecture for Decentralized Proof-of-Work Consensus.**

Autarky is a highly secure, utility-focused Layer-1 blockchain built for the cloud-computing era. By fundamentally decoupling cryptographic key management from intensive computational hashing, ATK-Mint allows operators to mine the native **₳** asset across unsecured global servers without ever exposing their financial treasury.

**[🌐 View the Live Network Explorer](https://kevindaviesnz.github.io/atk-mint/explorer.html)** | **[📄 Read the Official Whitepaper](https://www.google.com/search?q=WHITEPAPER.md)**

-----

## ⚠️ Beta Software & Liability Disclaimer

**ATK-MINT IS EXPERIMENTAL BETA SOFTWARE.**
By cloning, compiling, running, or transacting on this network, you explicitly acknowledge that this is an experimental peer-to-peer system. The creators and contributors hold **zero liability**. **Do not use this software for high-value financial transactions.**

-----

## 🐳 Recommended: Universal Docker Node (Mine Anywhere)

The most secure and stable way to run the ATK-Mint engine is via our containerized, OS-agnostic Docker image. This guarantees a pristine Linux compilation of the Rust engine on any machine (Mac, Windows, or Linux) without polluting your host system.

### Prerequisites
* **Docker Desktop** installed and running.
* *(Windows Users Only)*: Use **Git Bash** or WSL to run the setup script.

### 1. Generate Your Sovereign Identity
Run this locally to securely generate your unique private keys and initialize your wallet. **Never run this inside the container.**
```bash
./setup.sh
```
*(This creates your `autarky.key`, `compiler.pub`, and `wallet.json`)*

### 2. Forge the Universal Engine
Tell Docker to pull down a clean environment, compile the Rust execution engine, and package it into a lightweight, isolated container.
```bash
docker build -t atk-universal .
```

### 3. Start the Mining Rig
Spin up the container and open a secure volume mount to your local wallet. The isolated engine will mine blocks and save the **₳** rewards directly to your host machine's `wallet.json`.
```bash
docker run -it --rm -v "$(pwd)/wallet.json:/app/wallet.json" atk-universal
```

-----

## 💻 Alternative: Local CLI Installation

If you prefer to run the client directly on your host machine for quick wallet management and manual transactions, you can install the global CLI.

### 1. Clone & Dependencies
```bash
git clone [https://github.com/kevindaviesnz/atk-mint.git](https://github.com/kevindaviesnz/atk-mint.git)
cd atk-mint
npm install
```

### 2. Global Installation
Link the `atk-mint` command to your system path:
```bash
chmod +x miner.sh
sudo cp atk-mint /usr/local/bin/atk-mint
sudo chmod +x /usr/local/bin/atk-mint
```

### 3. Initialize Your Wallet
Create your local `wallet.json`. This is your "Bank Account." **Keep this file secure and never upload it to a cloud server.**
```bash
atk-mint init
```

-----

## 🕹️ Command Reference (Local CLI)

Once the local CLI is installed, use the following commands from any terminal window:

| Command | Action |
| :--- | :--- |
| `atk-mint balance` | Query the Vault for your confirmed **₳** balance. |
| `atk-mint address` | Display your Public Key (Your receiving address). |
| `atk-mint send <ADDR> <AMT>` | Securely sign, mine, and broadcast a transfer. |
| `atk-mint mine` | Launch the continuous Proof-of-Work mining rig locally. |

*(Note: For continuous background mining, the Docker method above is highly recommended over the local CLI).*

-----

## ⚡ The Hacker’s Challenge: Security by Architecture

ATK-Mint is built on a provocative claim: **We feature the world’s most secure node architecture.** * **The Identity Firewall:** Node identity is separated from financial wealth. You can deploy thousands of cloud mining nodes; even if a server is completely compromised, the attacker only gains a disconnected hashing calculator, while your **₳** wealth remains mathematically untouchable.
* **The Gravity Shield:** Features a Dynamic Difficulty Engine that adjusts the hashing target based on global computational power to maintain a steady block cadence.

---

## 📊 The Web3 Explorer

View the global rich list, circulating supply, and live block feed:
👉 **[Autarky Global Dashboard](https://kevindaviesnz.github.io/atk-mint/explorer.html)**

---

## 📜 License
MIT License. See `LICENSE` for details.
