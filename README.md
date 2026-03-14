
# Autarky (`atk-mint`) & Mark VCS

Autarky is a sovereign, Layer-1 blockchain protocol built on physical Proof of Work and cryptographic execution. It features a native smart contract engine (`atk`) enforcing linear type safety to prevent double-spending at the machine-code level.

Built on top of Autarky is **Mark**, a decentralized Version Control System (VCS). Mark serves as the fundamental utility layer for the `atk-mint` cryptocurrency, solving the "utility problem" of modern blockchains by requiring developers to burn `atk-mint` as computational gas to permanently anchor their physical code history to an immutable ledger.

---

## 🛡️ The World's Most Secure Cryptocurrency

Autarky is engineered to be the most secure cryptocurrency in existence. It achieves this not through complex, band-aid network layering, but through fundamental computer science at the compiler level:

1. **Compiler-Enforced Linear Type Safety:** Unlike Ethereum's Solidity, where tokens are just mutable numbers in a database vulnerable to reentrancy attacks, the `atk` engine treats assets as *linear types*. At the machine-code level, a memory resource must be consumed exactly once. It is mathematically impossible to duplicate or drop a coin inside the execution engine. Double-spending is prevented at the memory level before the transaction even reaches the network.
2. **Zero-Bloat Execution:** The engine is a custom-built LLVM compiler written in Rust. There is no bloated virtual machine. Contracts compile down to raw, highly constrained machine code.
3. **Thermodynamic Proof of Work:** Consensus is not achieved by wealth or delegation (Proof of Stake), but by the undeniable expenditure of physical energy (SHA-256). Every transaction and code commit is irreversibly anchored to real-world thermodynamic laws.
4. **Military-Grade Sovereignty:** Identities and block signatures are secured by Ed25519 elliptic curve cryptography, ensuring state-of-the-art resistance to key-forging.

---

## ⚠️ Architectural Constraints

* **Node.js:** Required to run the networking and client scripts.
* **MacOS Only:** The current native execution engine (`bin/atk`) is compiled exclusively for MacOS. To run this protocol on Linux or Windows, the Rust compiler must be rebuilt for the target architecture.

---

## Core Architecture

The Autarky ecosystem is divided into two distinct layers:

### Layer 1: The Protocol (`atk-mint`)
* **The Engine (`bin/atk`):** A custom Rust-based LLVM compiler that executes smart contracts and charges a `SYS_COMPUTE` gas fee.
* **The Identity:** Sovereign ownership secured by Ed25519 cryptography. Public keys act as network addresses.
* **Consensus (Proof of Work):** The network strictly enforces a SHA-256 difficulty target (currently 4 leading zeros). Miners must expend physical computational energy to secure the network.
* **The P2P Network:** A decentralized WebSocket gossip protocol that automatically handles node discovery, block propagation, and chain resolution (longest valid chain wins).

### Layer 2: The Application (`mark`)
* **Decentralized GitHub:** A command-line VCS with a local Object Vault that physically zips and unzips your codebase based on cryptographic tree hashes.
* **The Holy Grail:** `mark` gives the `atk-mint` currency actual economic value. To anchor a code commit, a user must invoke the `atk` engine, pay the compute fee, and perform Proof of Work. `atk-mint` is the digital oil required to run the `mark` engine.

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

When you interact with the Autarky network, you act as a sovereign entity governed by cryptography.

**How to find your `atk-mint` address**
Your address is your cryptographic public key. Open the `state.json` file in your root directory. The long alphanumeric string labeled `"address"` is your unique identity on the network.

**How to get someone to send you coins (Receiving)**
Simply copy the `"address"` string from `state.json` and share it. Because it is a public key, it acts like a secure mailbox. Anyone can drop coins into it, but only your local engine (holding the private key) can spend them.

**How to check your balance**
The network calculates your exact balance dynamically by scanning the entire immutable ledger. Open your web browser or use `curl` to hit your local node:

```bash
http://localhost:3000/balance/<YOUR_ADDRESS_HERE>

```

---

## 3. Transacting in the Economy

**Mine New Coins (Proof of Work)**
To generate new `atk-mint` coins, run the standalone mining client. This will burn CPU cycles to find a qualifying SHA-256 hash and mint a block reward:

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
This command physical sweeps your files into a secure vault, hashes the tree, wakes the `atk` engine to process the gas fee, solves a Proof of Work puzzle, and broadcasts the commit to the P2P network.

```bash
node mark.js commit "Initial project release for Autarky"

```

**View the Immutable Log**
Read your code's history directly from the blockchain ledger.

```bash
node mark.js log

```

**Time Travel (Checkout)**
Verify the cryptographic signature of a historical commit on the blockchain, and physically unpack those files from your local object vault to overwrite your current workspace.

```bash
# Usage: node mark.js checkout <commit_hash>
node mark.js checkout 0000a802b3b02ed987db0f98ee2927147d41997e8ad80e2fa7c3136ee10881da

```

---

## System Files Overview

* `server.js`: The core Layer-1 node (Express HTTP + WebSocket P2P).
* `atkMintClient.js`: The standalone Proof of Work miner.
* `atkTransfer.js`: The digital wallet client for sending funds.
* `mark.js`: The Layer-2 Decentralized Version Control application & Vault logic.
* `state.json`: Your local sovereign identity (Address and Nonce tracker).
* `chain_<PORT>.json`: The immutable, cryptographically secured global ledger.
* `bin/atk`: The compiled Rust execution engine (MacOS).

```


```