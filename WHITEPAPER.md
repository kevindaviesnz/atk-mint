# ATK-Mint: The Autarky Protocol
## Technical Whitepaper — v3.1

**Network:** Autarky Network (ATK-Mint)  
**Native Asset:** ₳ (ATK)  
**Maximum Supply:** 100,000,000,000 ₳  
**License:** MIT

---

## Abstract

Contemporary Proof-of-Work blockchains couple cryptographic key management, peer-to-peer networking, state validation, and computational hashing inside a single monolithic node client. This architectural conflation creates a well-documented vulnerability: a breach of the network layer can expose the private keys that control the financial treasury.

The Autarky Protocol (ATK-Mint) resolves this through a strict architectural bifurcation — separating a lightweight, stateful Control Layer from an isolated, network-blind Sovereign Engine. The result is an **Identity Firewall**: mining operations can be distributed across untrusted cloud infrastructure without ever placing treasury keys at risk.

ATK-Mint introduces a further, more fundamental innovation: every block mined on the network must pass **formal verification** by the Autarky compiler before the Vault will accept it. This means the correctness of every resource transaction is not merely assumed — it is mathematically proven at the point of creation, using Linear Logic, and the proof is cryptographically signed and embedded in the block. This is categorically different from how any major existing blockchain validates transactions.

This paper describes the protocol's architecture, its formal verification model, its economic design, and its decentralisation roadmap.

---

## 1. The Problem: Monolithic Node Security

In Bitcoin, Ethereum (pre-Merge), and most PoW-based chains, a single node client is responsible for:

- Maintaining the local ledger state
- Managing the operator's private keys
- Broadcasting transactions and blocks over the public internet
- Performing intensive SHA-256 hashing

This design means that any operator who wants to scale mining across multiple cloud servers must either copy private keys to each server (a catastrophic security risk) or operate complex, bespoke key-management infrastructure. The attack surface is proportional to the number of servers deployed.

**ATK-Mint's core claim:** server compromise must never equal financial compromise.

---

## 2. Architectural Bifurcation: Brain and Muscle

The Autarky Protocol divides the node environment into two mathematically isolated layers that communicate only through strictly formatted local standard I/O streams. There is no shared memory, no shared file system access, and no shared network stack between them.

### 2.1 The Control Layer ("The Brain") — `mark.js`

The Control Layer is a lightweight, asynchronous Node.js runtime responsible for:

- **Identity and signing:** Holding `wallet.json` (the operator's secp256k1 keypair) and signing completed blocks with ECDSA.
- **State management:** Synchronising with the Vault to retrieve the current chain height, the operator's transaction nonce, and the previous block hash.
- **Network I/O:** Broadcasting candidate blocks and signed transactions to the Vault via HTTPS.
- **Reward calculation:** Applying the halving schedule to determine the correct mining reward for the next block height.

The Control Layer never performs block hashing and never executes computationally intensive work. It maintains a minimal network profile — connecting to the Vault only when submitting a completed block, not maintaining a persistent open port.

### 2.2 The Sovereign Engine ("The Muscle") — `bin/atk`

The Sovereign Engine is the compiled Autarky binary. It has two distinct responsibilities:

**Proof-of-Work Hashing:** The engine accepts a serialised block header and iterates nonces until it finds a SHA-256 hash beginning with six leading zeros (Difficulty 6). It contains no network stack, cannot write to `wallet.json`, and cannot communicate with the internet. This constitutes a software-level air gap.

**Formal Verification:** Before a block can be submitted, the Autarky compiler runs the protocol's embedded `.aut` program against the block's resource parameters. The compiler applies its Linear Type System to mathematically prove that the declared compute and credit resources are consumed correctly — exactly once, with no leaks and no double-spends at the language level. It then cryptographically signs the result with the network's sovereign key (`autarky.key`), producing a `proof_signature` and `compiler_pubkey` that are embedded directly in the block.

### 2.3 The Identity Firewall

The separation of `wallet.json` (financial treasury, kept locally) from `autarky.key` (compiler identity, deployed to mining nodes) is the Identity Firewall. A mining operator can deploy the Sovereign Engine across any number of cloud servers. If a server is compromised:

- The attacker gains access to the hashing process and the compiler signing key.
- The attacker gains **no access** to `wallet.json` or the treasury funds.
- Block rewards flow to the operator's public address, which is broadcast in the block — not stored on the mining server.

This allows horizontal scaling of mining infrastructure across untrusted environments, which is architecturally impossible in monolithic PoW systems without significant security trade-offs.

---

## 3. Formal Verification: The Autarky Advantage

This is ATK-Mint's most significant point of difference from all major existing cryptocurrencies.

### 3.1 How Other Blockchains Validate Transactions

Bitcoin validates transactions through script execution and UTXO accounting. Ethereum validates smart contracts through the Ethereum Virtual Machine (EVM). In both cases, the validation logic is interpreted at runtime, and the *correctness* of the logic depends on the runtime correctly implementing the specification. There is no mathematical proof that a given transaction or contract cannot create invalid resource states.

Ethereum's history of re-entrancy attacks, integer overflow vulnerabilities, and logic errors in high-value smart contracts demonstrates that runtime validation alone is insufficient for guaranteeing resource safety.

### 3.2 How ATK-Mint Validates Transactions

Every block submitted to the ATK-Mint Vault must contain a `compiler_payload_raw`, `compiler_signature`, and `compiler_pubkey` field. These are generated by running the Autarky compiler over the block's resource parameters before the block is submitted.

The Autarky compiler enforces **Linear Logic** at the type-system level. In a Linear Type System, every variable is a resource that must be consumed exactly once:

- **Zero uses** is a compile-time error: the resource leaks, equivalent to a memory leak or an unspent token that disappears.
- **Two or more uses** is a compile-time error: the resource is duplicated, which at the protocol level would constitute a double-spend.

This is not a runtime check. The compiler mathematically proves resource correctness before any bytecode is generated. If the proof fails, no output is produced and no block can be submitted. If the proof succeeds, the compiler signs the result with `autarky.key`, and the Vault can verify that signature using `compiler.pub` — confirming that the block was produced by a correctly verified Autarky execution.

### 3.3 What This Means in Practice

The network's `.aut` programs encode the protocol's core financial operations:

```autarky
// main.aut — Resource injection proof
// SYS_COMPUTE and SYS_CREDITS are linear variables.
// Both must be consumed exactly once or the compiler rejects the block.
add
  (mul SYS_COMPUTE 10)
  SYS_CREDITS
```

The token operations in `src/core.aut` — creating tokens, splitting value, merging balances, performing atomic swaps, minting, and burning — are all implemented as Autarky linear functions. Each one is formally verified before it can participate in the network.

```autarky
;; core.aut — Atomic swap: exchanges two assets only when quantities match.
;; Linear types guarantee neither asset can be duplicated or lost.
(let atomic_swap (lambda (a1) (lambda (a2) (lambda (p)
  (unpack a1 (lambda (s1 q1) (unpack a2 (lambda (s2 q2)
    (match (eq q2 p)
      (pair (pair s1 q2) (pair s2 q1))
      (pair (pair s1 q1) (pair s2 q2)))))))))))
```

No equivalent of this formal guarantee exists in Bitcoin Script or Solidity. Solidity contracts can be formally verified using external tools as an optional add-on; in ATK-Mint, formal verification is a mandatory, non-bypassable step in the block submission pipeline.

### 3.4 The Compiler as a Consensus Participant

The Autarky compiler is not an external tool — it is a consensus participant. The Vault holds `compiler.pub` (the compiler's Ed25519 public key). Every MINT block submitted to the Vault includes a `compiler_signature`. The Vault verifies this signature before accepting the block, meaning:

- Blocks produced without running the Autarky compiler are cryptographically invalid.
- Blocks produced by a tampered or substituted compiler (one not matching the known `compiler.pub`) are rejected.
- The formal verification step cannot be skipped, forged, or bypassed.

This architecture embeds formal correctness into the consensus mechanism itself.

---

## 4. Tokenomics and Monetary Policy

The ₳ supply schedule is determined by immutable protocol rules enforced by the Vault.

| Parameter | Value |
|---|---|
| Maximum Supply | 100,000,000,000 ₳ (100 billion) |
| Genesis Allocation | 10,000,000,000 ₳ (10% — Sovereign Treasury) |
| Mining Pool | 90,000,000,000 ₳ (90% — Proof-of-Work only) |
| Initial Block Reward | 50,000 ₳ |
| Halving Interval | Every 210,000 blocks (approximately 4-year cycles) |
| Difficulty | 6 leading zeros (SHA-256) |

### 4.1 The Genesis Allocation

At Block #0, the protocol executed a one-time mint of 10,000,000,000 ₳ to the Sovereign Treasury address. These funds are designated for ICO distribution, ecosystem grants, and core protocol research. No further genesis-style minting is possible; the Vault enforces the 100B hard cap on every block.

### 4.2 The Halving Engine

The block reward follows a programmatic decay schedule modelled on Bitcoin's halving mechanism:

$$\text{Reward}(n) = \left\lfloor \frac{50{,}000}{2^n} \right\rfloor$$

where $n$ is the number of completed 210,000-block intervals. This creates predictable, time-decreasing supply issuance that incentivises early network participation while ensuring long-term scarcity.

### 4.3 Balance Calculation

Balances are not stored in a database. They are computed dynamically by scanning the full chain from genesis, summing all `MINT` and `GENESIS` credits and all `TRANSFER` debits and credits for a given public key. This approach eliminates an entire class of database inconsistency bugs and ensures the ledger is the single source of truth.

---

## 5. Consensus and the Gravity Shield

ATK-Mint uses Proof-of-Work for block production. To append a block, the Sovereign Engine must find a nonce $N$ such that:

$$H(B_{\text{prev}} \| T_x \| N) < T_{\text{target}}$$

where $H$ is SHA-256, $B_{\text{prev}}$ is the previous block hash, and $T_x$ is the serialised transaction data.

### 5.1 The Gravity Shield — Dynamic Difficulty

The Gravity Shield algorithm continuously monitors inter-block timestamps. As global hash rate increases, the algorithm raises the difficulty target to prevent block time compression and supply inflation. As hash rate decreases, it lowers the target to maintain a consistent block cadence. Current baseline difficulty is 6 leading zeros.

### 5.2 Double-Spend Prevention

The protocol implements a four-layer defence against double-spend attacks:

**Stateful Ledger Validation:** The Vault maintains live account balances. Every incoming transaction is checked against the current ledger before entering the mempool. Transactions where the sender's balance is insufficient (amount + fee) are dropped immediately.

**Transaction Nonce and Atomic Sequencing:** Each transaction is cryptographically bound to a unique, incrementing nonce. Once a transaction's signature is included in a confirmed block, that signature is marked globally spent. Any rebroadcast of the same signature is rejected as a replay attack.

**Longest Chain Rule:** In the event of a network fork, the protocol follows the chain with the greatest cumulative Proof-of-Work. Transactions on a shorter fork are invalidated when the network converges on the canonical chain.

**Confirmation Depth:** Transactions are considered pending until included in a block. High-value transfers should wait for 3–6 confirmations, after which the computational cost of rewriting the required history makes double-spend attempts economically non-viable.

---

## 6. Layer-2: Mark Version Control System

Mark is a Layer-2 decentralised version control system built on top of ATK-Mint. It allows software teams to anchor code commit hashes to the ATK-Mint ledger, creating a tamper-evident, blockchain-verified audit trail for source code history.

Each Mark commit consumes a small amount of ₳ as a network fee (gas), setting `mark_commit: true` in the block and embedding the commit identifier in the block's message field. The Autarky compiler formally verifies that the gas resources are consumed correctly before the commit block is accepted.

This gives Mark commits a security property unavailable to centralised version control systems like GitHub: the commit history is cryptographically anchored to an immutable public ledger, and tampering with past commits would require rewriting the blockchain.

---

## 7. The `devops.aut` Module: Infrastructure as Linear Resources

The `src/devops.aut` module extends the protocol to model cloud infrastructure — compute leases and diagnostic credits — as Autarky linear resources. This allows infrastructure costs to be tracked, allocated, and consumed with the same formal guarantees as financial tokens.

```autarky
;; lease_compute — Returns an ExecutionLease (ID 999) and remaining change.
;; The linear type system guarantees the payment is consumed exactly once.
(let lease_compute
  (lambda (token)
    (lambda (cost_per_hour)
      (lambda (hours_requested)
        (let total_cost (mul cost_per_hour hours_requested))
        (unpack (split_token token total_cost) (lambda (payment change)
          (pair
            (pair 999 total_cost)
            change)))))))
```

This module demonstrates the extensibility of the Autarky formal verification layer beyond core currency operations into broader decentralised infrastructure applications.

---

## 8. Deployment Architecture

### 8.1 Docker Containerisation

The canonical deployment method is Docker. A multi-stage Docker build compiles the Autarky Sovereign Engine from Rust source on the target machine, eliminating all pre-compiled binary dependencies and ensuring the engine runs in the exact environment it was built for. The operator's `wallet.json` is mounted into the container at runtime via a Docker volume, maintaining the Identity Firewall: financial keys never enter the container image.

This approach resolved an earlier critical failure (documented in `docs/RETROSPECTIVE.md`) in which pre-compiled binaries shipped directly in the repository caused fatal `glibc` incompatibilities across Linux distributions.

### 8.2 Vault Architecture

The current production Vault (`atk-mint-vault.duckdns.org`) acts as the authoritative ledger arbiter, verifying PoW difficulty, validating Autarky compiler signatures, enforcing the 100B supply cap, and serving chain state to clients.

---

## 9. Network Topology Roadmap

| Phase | Status | Description |
|---|---|---|
| Phase 1 — Sovereign Vault | ✅ Complete | Centralised Vault as ledger arbiter; full PoW mining and formal verification pipeline operational |
| Phase 2 — Web Explorer | ✅ Complete | Live visual dashboard for the ATK-Mint ledger |
| Phase 3 — Halving Engine | ✅ Complete | Automated 210,000-block supply halving |
| Phase 4 — Multi-Region Validators | 🔄 In Progress | Geographic distribution of validation nodes |
| Phase 5 — Hydra P2P | 📋 Planned | Full transition to Byzantine Fault Tolerant gossip consensus; deprecation of centralised Vault |
| Phase 6 — Public Liquidity | 📋 Planned | Treasury distribution and ecosystem grants |

The Hydra P2P phase will transition the network from its current high-availability single-Vault architecture to a fully decentralised BFT consensus model, completing the decentralisation roadmap.

---

## 10. Security Disclosure

ATK-Mint is experimental beta software. The protocol has not undergone a formal third-party security audit. Do not use this software to store or transfer funds of significant value. The creators and contributors accept no liability for losses arising from use of this software.

The `AUTARKY_COMPILER_SECRET` environment variable (the compiler signing key) must be treated as a private key. It must not be committed to version control, logged, or transmitted over unencrypted channels. Loss or exposure of this key compromises the root of trust for all network blocks produced by that compiler instance.

---

## 11. Conclusion

The Autarky Protocol demonstrates that the security limitations of monolithic PoW architectures are architectural, not fundamental. By bifurcating the node environment into an isolated hashing engine and a lightweight control layer, ATK-Mint allows mining infrastructure to scale across untrusted cloud environments without placing treasury assets at risk.

More significantly, by embedding the Autarky compiler — a formally verified, Linear Logic-based execution engine — as a mandatory consensus participant, ATK-Mint introduces a class of transaction safety guarantee that no major existing blockchain provides as a native protocol feature. Resource correctness is not inferred from runtime behaviour; it is mathematically proven before a block can be created, and that proof is cryptographically signed and independently verifiable by the Vault.

As the network progresses toward Hydra P2P decentralisation, these properties will be preserved and extended across a fully distributed consensus topology.

---

Authorship disclosure: This project was produced through a human-directed AI process under the oversight of Kevin Davies. The protocol architecture, source code, and technical design were developed in collaboration with Gemini Pro (Google DeepMind). The written documentation — including this whitepaper, the README, and supporting materials — was drafted using Claude (Anthropic). All AI-generated outputs were produced under the author's direct direction and reviewed prior to publication.

*ATK-Mint is MIT-licensed open source software. See `LICENSE` for terms.*  
*Network Explorer: https://kevindaviesnz.github.io/atk-mint/explorer.html*
