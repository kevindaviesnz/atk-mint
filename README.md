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

## 🚀 Quick Start: Install the Global CLI

ATK-Mint features a unified Command Line Interface (CLI) that allows you to manage your wallet and mine from any directory on your system.

### 1. Clone & Dependencies
```bash
git clone https://github.com/kevindaviesnz/atk-mint.git
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

## 🕹️ Command Reference

Once installed, use the following commands from any terminal window:

| Command | Action |
| :--- | :--- |
| `atk-mint balance` | Query the Vault for your confirmed **₳** balance. |
| `atk-mint address` | Display your Public Key (Your receiving address). |
| `atk-mint send <ADDR> <AMT>` | Securely sign, mine, and broadcast a transfer. |
| `atk-mint mine` | Launch the continuous Proof-of-Work mining rig. |

-----

## 🖥️ Sovereign Node Operations (Mining)

Secure the network and earn the **₳ 500** block reward by running a Sovereign Engine.

### Start Mining
Launch the rig with a custom identifier for the global leaderboard:
```bash
atk-mint mine "My Mac Pro Rig"
```

### Background Mining
To keep the engine running in the background while you work:
```bash
atk-mint mine "Background-Worker" > mining.log 2>&1 &
```
*To stop the background process, use `pkill -f miner.sh`.*

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
