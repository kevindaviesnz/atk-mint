# Autarky (`atk-mint`) & Mark VCS

Autarky is a sovereign, Layer-1 blockchain protocol built on physical Proof of Work and cryptographic execution. It features a native smart contract engine (`atk`) enforcing linear type safety to prevent double-spending at the machine-code level.

Built on top of Autarky is **Mark**, a decentralized Version Control System (VCS). Mark serves as the fundamental utility layer for the `atk-mint` cryptocurrency, requiring developers to burn `atk-mint` as computational gas to permanently anchor their physical code history to an immutable ledger.

---

## 🛡️ The World's Most Tamper-Proof Cryptocurrency

Autarky is engineered to be the most mathematically tamper-proof cryptocurrency in existence. It achieves this through fundamental computer science at the compiler level and military-grade cryptography at the edge:

1. **Compiler-Enforced Linear Type Safety:** Unlike Ethereum's Solidity, where tokens are mutable numbers vulnerable to reentrancy attacks, the `atk` engine treats assets as *linear types*. At the machine-code level, a memory resource must be consumed exactly once. It is mathematically impossible to duplicate or drop a coin inside the execution engine.
2. **Reentrancy Immunity:** Autarky's execution model is structurally immune to the exploits that affected the Ethereum DAO. By using a serialized `mineQueue` and a language that lacks external call instructions, the state is deterministically updated before any further execution can occur.
3. **Sovereign Minting Authority:** All new currency issuance is cryptographically signed by an authorized Autarky Compiler. Verification is decentralized across all nodes via a pinned `compiler.pub` anchor, while the signing secret remains in the hands of the sovereign authority.
4. **Thermodynamic Proof of Work:** Consensus is achieved by the undeniable expenditure of physical energy (SHA-256). Every transaction and code commit is irreversibly anchored to real-world thermodynamic laws.
5. **Asymmetric Cryptographic Sovereignty:** Identities are secured by Ed25519 ECC. Your `wallet.json` is further hardened with AES-256-GCM encryption, ensuring your private keys remain secure even if the file is exfiltrated.

---

## 🚀 Quick Start (Production Setup)

The v3 protocol requires a one-time cryptographic initialization to establish your Network Anchor and secure your local wallet.

```bash
# 1. Download and run the safe setup script
source setup.sh
This script will:

Generate your AUTARKY_COMPILER_SECRET: Your unique 32-byte signing seed.

Derive compiler.pub: The public anchor for your network.

Generate a high-entropy WALLET_PASS: Used to encrypt your local wallet.json.

IMPORTANT: Save the WALLET_PASS printed by the script. You must export WALLET_PASS=<your_pass> in every new terminal session to use the mark VCS.

🏗️ Architectural & OS Compatibility
Networking: Node.js 20+ required.

MacOS: Native execution via bin/atk.

Linux/Cloud: Fully supported via the multi-stage Dockerfile. The Docker build compiles the Rust engine into a Linux-native binary automatically.

Core Architecture
Layer 1: The Protocol (atk-mint)

The Engine (bin/atk): A custom Rust-based compiler that executes contracts and charges gas. It requires AUTARKY_COMPILER_SECRET for signing MINT operations.

The Central Bank (server.js): The decentralized ledger. It uses compiler.pub to verify that all rewards are legitimate and enforces the Double-Spend Firewall.

The P2P Network: A decentralized WebSocket gossip protocol. Max 25 peers per node to prevent Eclipse DoS attacks.

Layer 2: The Application (mark)

Decentralized VCS: Uses atk-mint as digital oil. To anchor a code commit, mark invokes the atk engine, pays the fee, and performs PoW.

Wallet Security: Your wallet.json is encrypted with AES-256-GCM. Without your WALLET_PASS, the private keys are mathematically inaccessible.

🛡️ Security Configurations
Network Verification (compiler.pub)

To verify the integrity of the ledger, every node must host a compiler.pub file in its root directory. This acts as the cryptographic anchor for the protocol's "tamper-proof" claims.

Official Autarky v3 Public Key:
e024de58d987fa9716acde7e08634c5353d3c491df35e6ba0875bebac962e1c9

To set this up, run:

Bash
echo "e024de58d987fa9716acde7e08634c5353d3c491df35e6ba0875bebac962e1c9" > compiler.pub
Sovereign Key Management (AUTARKY_COMPILER_SECRET)

The root of trust for all minting operations. This must be a cryptographically secure 32-byte value (64-character hex). Generate one using:

Bash
openssl rand -hex 32
Inject this into the environment at runtime. Never hardcode this value or commit it to version control.

System Files Overview
server.js: The core Layer-1 node (HTTP API + P2P).

mark.js: The Layer-2 VCS application.

setup.sh: Automated cryptographic environment initialization.

compiler.pub: The public Network Anchor for reward verification.

wallet.json: Your local identity (Encrypted Ed25519 Keypair).

chain_<PORT>.json: The immutable global ledger.