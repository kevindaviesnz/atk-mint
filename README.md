
### `README.md`

```markdown
# Autarky (`atk-mint`) & Mark VCS

Autarky is a sovereign, Layer-1 blockchain protocol built on physical Proof of Work and cryptographic execution. It features a native smart contract engine (`atk`) enforcing linear type safety to prevent double-spending at the machine-code level.

Built on top of Autarky is **Mark**, a decentralized Version Control System (VCS). Mark serves as the fundamental utility layer for the `atk-mint` cryptocurrency, solving the "utility problem" of modern blockchains by requiring developers to burn `atk-mint` as computational gas to permanently anchor their physical code history to an immutable ledger.

---

## 🛡️ The World's Most Tamper-Proof Cryptocurrency

Autarky is engineered to be the most mathematically tamper-proof cryptocurrency in existence. It achieves this not through complex, band-aid network layering, but through fundamental computer science at the compiler level and military-grade cryptography at the edge:

1. **Compiler-Enforced Linear Type Safety:** Unlike Ethereum's Solidity, where tokens are just mutable numbers in a database vulnerable to reentrancy attacks, the `atk` engine treats assets as *linear types*. At the machine-code level, a memory resource must be consumed exactly once. It is mathematically impossible to duplicate or drop a coin inside the execution engine.
2. **The Deterministic Double-Spend Firewall:** Before a block enters the mempool, the `server.js` network calculates the precise historical wealth of the user's Public Key from Genesis to the present millisecond. If a transaction attempts to spend more funds or gas than are available, it is deterministically rejected. 
3. **Zero-Bloat Execution:** The engine is a custom-built LLVM compiler written in Rust. There is no bloated virtual machine. Contracts compile down to raw, highly constrained machine code.
4. **Thermodynamic Proof of Work:** Consensus is not achieved by wealth or delegation (Proof of Stake), but by the undeniable expenditure of physical energy (SHA-256). Every transaction and code commit is irreversibly anchored to real-world thermodynamic laws.
5. **Asymmetric Cryptographic Sovereignty:** Identities and block signatures are secured by Ed25519 elliptic curve cryptography. Every transaction must be mathematically signed by a local Private Key. There is no central database to hack; an attacker would have to brute-force a private key, which would take longer than the lifespan of the universe.

---

## ⚠️ Architectural Constraints

* **Node.js:** Required to run the networking and client scripts.
* **MacOS Only:** The current native execution engine (`bin/atk`) is compiled exclusively for MacOS. To run this protocol on Linux or Windows, the Rust compiler must be rebuilt for the target architecture.

---

## Core Architecture

The Autarky ecosystem is divided into two distinct layers:

### Layer 1: The Protocol (`atk-mint`)
* **The Engine (`bin/atk`):** A custom Rust-based LLVM compiler that executes smart contracts and charges a `SYS_COMPUTE` gas fee.
* **The Central Bank (`server.js`):** The decentralized ledger that enforces the Double-Spend Firewall and signature verification.
* **The Identity:** Sovereign ownership secured by Ed25519 cryptography. Public keys act as network addresses.
* **Consensus (Proof of Work):** The network strictly enforces a SHA-256 difficulty target (currently 4 leading zeros). Miners must expend physical computational energy to secure the network.
* **The P2P Network:** A decentralized WebSocket gossip protocol that automatically handles node discovery, block propagation, and chain resolution (longest valid chain wins).

### Layer 2: The Application (`mark`)
* **Decentralized GitHub:** A command-line VCS with a local Object Vault that physically hashes your codebase and verifies it against the blockchain.
* **The Holy Grail:** `mark` gives the `atk-mint` currency actual economic value. To anchor a code commit, a user must invoke the `atk` engine, pay the compute fee, and perform Proof of Work. `atk-mint` is the digital oil required to run the `mark` engine, creating a deflationary energy sink.

---

## 1. Running the P2P Network

The Autarky network is fully distributed. You can run multiple nodes locally or connect to remote peers globally.

**Start the Genesis Node (Node A)**
```bash
HTTP_PORT=3000 P2P_PORT=6000 node server.js

```

*This initializes `chain_3000.json` and opens a WebSocket server on port 6000.*

**Start a Peer Node (Node B)**

```bash
HTTP_PORT=3001 P2P_PORT=6001 PEERS=ws://localhost:6000 node server.js

```

*Node B will instantly connect to Node A, compare ledger heights, and automatically download the longest valid chain to achieve consensus.*

---

## 2. Wallet & Account Management

When you interact with the Autarky network, you act as a sovereign entity governed by cryptography. Your identity is stored in `wallet.json`. **NEVER SHARE THIS FILE.**

**How to generate your wallet**
If you do not have a wallet, running the VCS will automatically generate a military-grade Ed25519 keypair for you:

```bash
node mark.js init

```

**How to find your `atk-mint` address**
Your address is your cryptographic public key. Open the `wallet.json` file. The long alphanumeric string labeled `"publicKey"` is your unique identity on the network.

**How to get someone to send you coins (Receiving)**
Simply copy the `"publicKey"` string and share it. It acts like a secure mailbox. Anyone can drop coins into it, but only your local machine (holding the private key) can sign transactions to spend them.

**How to check your balance**
The network calculates your exact balance dynamically by scanning the entire immutable ledger. Open your web browser or use `curl` to hit your local node:

```bash
http://localhost:3000/balance/<YOUR_PUBLIC_KEY_HERE>

```

---

## 3. Transacting in the Economy

**Mine New Coins (Proof of Work)**
To generate new `atk-mint` coins, run the standalone mining client. This burns CPU cycles to find a qualifying SHA-256 hash, cryptographically signs the block, and mints a block reward:

```bash
node atkMintClient.js

```

**Send Coins (Peer-to-Peer Transfers)**
To move existing `atk-mint` to another sovereign identity, use the transfer client. The network prevents double-spending by verifying you have the funds before approving the block.

```bash
# Usage: node atkTransfer.js <recipient_address> <amount>
node atkTransfer.js 99abc123def456fakeaddress 50

```

---

## 4. Using Mark (Decentralized VCS)

Mark allows you to permanently anchor and physically restore your code history via the Autarky blockchain.

**Initialize a Repository & Vault**

```bash
node mark.js init

```

**Anchor a Code Commit**
This command hashes your current directory state, wakes the `atk` engine to process the gas fee, signs the payload with your Ed25519 private key, solves a Proof of Work puzzle, and broadcasts the commit to the P2P network.

```bash
node mark.js commit "Initial project release for Autarky"

```

**View the Immutable Log**
Read your code's history directly from the blockchain ledger.

```bash
node mark.js log

```

**Time Travel (Checkout)**
Verify the cryptographic signature of a historical commit on the blockchain, and extract the anchored state hash.

```bash
# Usage: node mark.js checkout <commit_hash>
node mark.js checkout 0000a802b3b02ed987db0f98ee2927147d41997e8ad80e2fa7c3136ee10881da

```

---

## System Files Overview

* `server.js`: The core Layer-1 node (Express HTTP + WebSocket P2P + Signature Verification).
* `atkMintClient.js`: The standalone Proof of Work miner (Ed25519 Secured).
* `atkTransfer.js`: The digital wallet client for sending funds (Ed25519 Secured).
* `mark.js`: The Layer-2 Decentralized Version Control application.
* `wallet.json`: Your local sovereign identity (Public/Private Keypair).
* `chain_<PORT>.json`: The immutable, cryptographically secured global ledger.
* `bin/atk`: The compiled Rust execution engine (MacOS).

