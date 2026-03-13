# Autarky Mint Node

The Autarky Mint Node is the sovereign execution environment and validator for the world's most secure cryptocurrency architecture. By combining Linear Type Systems, native LLVM compilation, and Ed25519 cryptography, Autarky solves the double-spend problem at the compiler level.

## 🛡️ The Three Pillars of Security

Most blockchains rely on network consensus to catch malicious transactions after they happen. Autarky enforces security *before* execution via its custom LLVM compiler (`atk`).

1. **Atomic Linearity (Zero Double-Spends):** Resources like `SYS_COMPUTE` and `SYS_CREDITS` are strictly linear. If a script attempts to use a resource twice, or fails to use it at all, the native compiler halts. The machine code for a double-spend literally cannot be generated.
2. **Native Isolation (Zero VM Overhead):**
   Instead of an interpreted Virtual Machine (like the EVM), Autarky compiles smart contracts directly to native LLVM IR, ensuring high-performance, isolated execution.
3. **Cryptographic Non-Repudiation:**
   Every successful execution is hashed alongside a strictly incrementing `nonce` and signed with an Ed25519 private key. This creates an undeniable, replay-proof certificate of execution.

## 📂 Repository Structure

* `atkMintClient.js` - The Node.js Validator Client. Manages local state (nonce) and broadcasts signed proofs to the network.
* `main.aut` - The active linear smart contract executed by the engine.
* `state.json.example` - Template for the local state file. 
* `tests/` - Contains examples of failing linear contracts (`fail_double.aut`, `fail_leak.aut`) to demonstrate compiler-level security.

## 🚀 Getting Started

### 1. Initialize State
Copy the state template to create your local sovereign wallet:
```bash
cp state.json.example state.json
(Note: state.json is git-ignored to protect your local nonce and identity).

2. The Autarky Contract (main.aut)

The default contract proves resource injection and linear consumption by mathematically combining the system resources. Both SYS_COMPUTE and SYS_CREDITS must be consumed exactly once for the compiler to generate the proof:

Code snippet
# main.aut
# Proving resource injection for the atk-mint protocol

add 
    (mul SYS_COMPUTE 10) 
    SYS_CREDITS
3. Run the Validator Node

Execute the Node client to wake the native engine, generate a cryptographic proof, and broadcast the block:

Bash
node atkMintClient.js <compute_amount> <credits_amount>

# Example:
# node atkMintClient.js 10 5
📡 Network Broadcast

Upon successful local validation and signing, the client will broadcast a JSON payload containing the mathematical proof and the signer's public key to the decentralized network.