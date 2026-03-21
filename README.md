# 🛡️ Autarky Network (ATK-MINT)

## **"Sovereign Wealth through Decoupled Consensus"**

> **A Layer-1 Blockchain featuring a hard-capped 100B Supply and Automated Halving Scarcity.**

Autarky is a utility-focused Layer-1 blockchain built for the cloud-computing era. By fundamentally decoupling cryptographic key management from intensive computational hashing, ATK-Mint allows operators to mine the native **₳** asset across unsecured global servers without ever exposing their financial treasury.

**[🌐 View the Live Network Explorer](https://kevindaviesnz.github.io/atk-mint/explorer.html)** | **[📄 Read the Official Whitepaper](https://www.google.com/search?q=WHITEPAPER.md)**

---

## 📊 Tokenomics & Monetary Policy

ATK-Mint operates on a strictly defined mathematical emission schedule to ensure long-term value preservation.

* **Total Max Supply:** 100,000,000,000 **₳** (100 Billion)
* **Genesis Allocation (10%):** 10,000,000,000 **₳** (Allocated to the Sovereign Treasury for ICO and Development).
* **Mining Pool (90%):** 90,000,000,000 **₳** (Earned exclusively through Proof-of-Work).
* **The Halving Engine:** The mining reward starts at **50,000 ₳** per block and halves every **210,000 blocks** to enforce programmed scarcity.

---

## ⚡ Architecture: The "Identity Firewall"

ATK-Mint is built on a provocative claim: **Security by Separation.**

* **The Vault (Server):** An immutable ledger that enforces the 100B cap and halving rewards. It holds no private keys.
* **The Miner (Client):** A stateless hashing engine that signs transactions locally.
* **The Gravity Shield:** Features a Dynamic Difficulty Engine (Difficulty: 6) to maintain a steady block cadence regardless of global hashing power.

---

## ⚠️ Beta Software & Liability Disclaimer

**ATK-MINT IS EXPERIMENTAL BETA SOFTWARE.**
By cloning, compiling, running, or transacting on this network, you explicitly acknowledge that this is an experimental peer-to-peer system. The creators and contributors hold **zero liability**. **Do not use this software for high-value financial transactions.**

---

## 🐳 Universal Docker Node (Mine Anywhere)

The most secure and stable way to run the ATK-Mint engine is via our containerized, OS-agnostic Docker image. This guarantees a pristine environment on any machine without polluting your host system.

### 1\. Clone & Install Dependencies
First, pull down the repository and install the required Node packages (this prevents any missing module errors during setup).
```bash
git clone [https://github.com/kevindaviesnz/atk-mint.git](https://github.com/kevindaviesnz/atk-mint.git)
cd atk-mint
npm install
````

### 2\. Initialize Your Sovereign Wallet

Before you can use Docker, you must generate your local identity (`wallet.json`). **Do not skip this step**, or Docker will fail to mount your keys. Keep this file secure and NEVER upload it to a public GitHub repo.

```bash
node mark.js init
```

### 3\. Build the Forge

Package the ATK-Mint engine into an isolated, high-performance Linux container.

```bash
docker build -t atk-miner .
```

### 4\. Docker Command Reference

Because the Docker container acts as your CLI, you interact with it by appending commands to the end of the `docker run` string.

**Standard Commands:**

| Action | Docker Command |
| :--- | :--- |
| **Check Balance** | `docker run -it --rm -v "$(pwd)/wallet.json:/app/wallet.json" atk-miner balance` |
| **View Address** | `docker run -it --rm -v "$(pwd)/wallet.json:/app/wallet.json" atk-miner address` |
| **Transfer ₳** | `docker run -it --rm -v "$(pwd)/wallet.json:/app/wallet.json" atk-miner transfer <ADDRESS> <AMOUNT>` |
| **Mine Single Block** | `docker run -it --rm -v "$(pwd)/wallet.json:/app/wallet.json" atk-miner mine "Optional Message"` |

**Continuous Mining Commands:**

| Action | Docker Command |
| :--- | :--- |
| **Mine Continuously<br>(Foreground)** | `docker run -it --rm --entrypoint /bin/sh -v "$(pwd)/wallet.json:/app/wallet.json" atk-miner -c "while true; do node mark.js mine 'Cloud Node'; sleep 2; done"`<br>*(Keeps your terminal open so you can watch blocks being solved live. Press `Ctrl+C` to stop).* |
| **Mine Continuously<br>(Background / 24/7)** | `docker run -d --name atk-cloud-miner --entrypoint /bin/sh -v "$(pwd)/wallet.json:/app/wallet.json" atk-miner -c "while true; do node mark.js mine 'Cloud Node'; sleep 2; done"`<br>*(Runs silently in the background. Safe to close your terminal or disconnect from your VPS).* |

**Background Miner Management:**

  * View Live Logs: `docker logs -f atk-cloud-miner`
  * Stop Mining: `docker stop atk-cloud-miner`
  * Remove Background Process: `docker rm atk-cloud-miner`

-----

## 💻 Alternative: Local CLI Installation

If you prefer not to use Docker, you can run the engine directly on your host machine.

### 1\. Setup & Initialize

```bash
git clone [https://github.com/kevindaviesnz/atk-mint.git](https://github.com/kevindaviesnz/atk-mint.git)
cd atk-mint
npm install
node mark.js init
```

### 2\. Command Reference (Local CLI)

| Command | Action |
| :--- | :--- |
| `node mark.js balance` | Query the Vault for your confirmed **₳** balance. |
| `node mark.js balance <ADDR>` | Audit the balance of any address (e.g., the Treasury). |
| `node mark.js address` | Display your Public Key (Your receiving address). |
| `node mark.js transfer <ADDR> <AMT>` | Securely sign, mine PoW, and broadcast an ₳ transaction. |
| `node mark.js mine` | Solve a single block to earn mining rewards. |

-----

## 🗺️ Project Roadmap

  - [x] **Phase 1: Genesis** - Hard-capped supply and 10B Treasury initialization.
  - [x] **Phase 2: Scarcity Implementation** - Automated 210k block halving engine.
  - [ ] **Phase 3: Network Expansion** - Deployment of multi-region validator nodes.
  - [x] **Phase 4: Web Explorer** - Live visual dashboard for the ATK-Mint ledger.
  - [ ] **Phase 5: Public Liquidity** - Treasury distribution and ecosystem grants.

-----

## 📜 License

MIT License. See `LICENSE` for details.

