# Autarky (`atk-mint`) & Mark VCS

Autarky is a sovereign, Layer-1 blockchain protocol built on physical Proof of Work and cryptographic execution. It features a native smart contract engine (`atk`) enforcing linear type safety to prevent double-spending at the machine-code level.

Built on top of Autarky is **Mark**, a decentralized Version Control System (VCS). Mark serves as the fundamental utility layer for the `atk-mint` cryptocurrency, solving the "utility problem" of modern blockchains by requiring developers to burn `atk-mint` as computational gas to permanently anchor their code history to an immutable ledger.

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
* **Decentralized GitHub:** A command-line VCS that cryptographically hashes a repository's state.
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

Mark allows you to permanently anchor your code history to the Autarky blockchain.

**Initialize a Repository**

```bash
node mark.js init

```

**Anchor a Code Commit**
This command hashes your workspace, wakes the `atk` engine to process the gas fee, forces your CPU to solve a Proof of Work puzzle, and broadcasts the commit to the P2P network.

```bash
node mark.js commit "Initial project release for Autarky"

```

**View the Immutable Log**
Read your code's history directly from the blockchain ledger.

```bash
node mark.js log

```

---

## System Files Overview

* `server.js`: The core Layer-1 node (Express HTTP + WebSocket P2P).
* `atkMintClient.js`: The standalone Proof of Work miner.
* `atkTransfer.js`: The digital wallet client for sending funds.
* `mark.js`: The Layer-2 Decentralized Version Control application.
* `state.json`: Your local sovereign identity (Address and Nonce tracker).
* `chain_<PORT>.json`: The immutable, cryptographically secured global ledger.
* `bin/atk`: The compiled Rust execution engine (MacOS).
