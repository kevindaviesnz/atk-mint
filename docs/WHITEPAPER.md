# ATK-Mint: The Autarky Protocol
## Technical Whitepaper — v3.3

**Network:** Autarky Network (ATK-Mint)  
**Native Asset:** ₳ (ATK)  
**Maximum Supply:** 100,000,000,000 ₳  
**License:** MIT

---

## Abstract

Contemporary Proof-of-Work blockchains couple cryptographic key management, peer-to-peer networking, state validation, and computational hashing inside a single monolithic node client. This architectural conflation creates a well-documented vulnerability: a breach of the network layer can expose the private keys that control the financial treasury.

The Autarky Protocol (ATK-Mint) resolves this through a strict architectural bifurcation — separating a lightweight, stateful Control Layer from an isolated, network-blind Sovereign Engine. The result is an **Identity Firewall**: mining operations can be distributed across untrusted cloud infrastructure without ever placing treasury keys at risk.

ATK-Mint introduces a further, more fundamental innovation: every block mined on the network must pass **formal verification** by the Autarky compiler before the Vault will accept it. This means the correctness of every resource transaction is not merely assumed — it is mathematically proven at the point of creation, using Linear Logic, and the proof is cryptographically signed and embedded in the block. This is categorically different from how any major existing blockchain validates transactions.

Critically, this formal verification layer is not limited to currency transfers. ATK-Mint is a **utility network**: ₳ is the gas that powers a general-purpose, formally verified asset platform. The demand for ₳ is driven not by speculation, but by real usage — every asset operation, infrastructure lease, code commit, and digital asset anchoring on the network requires ₳ to execute, and every one of those operations is mathematically proven correct before it can proceed.

This paper describes the protocol's architecture, its formal verification model, its asset primitives — including the native Digital Asset Gallery — its economic design, and its decentralisation roadmap.

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

The Control Layer is a lightweight, asynchronous Node.js ES module responsible for:

- **Identity and signing:** Holding `wallet.json` (the operator's secp256k1 keypair) and signing completed blocks and transactions with ECDSA.
- **State management:** Synchronising with the Vault to retrieve the current chain height, the operator's transaction nonce, and the previous block hash.
- **Network I/O:** Broadcasting candidate blocks and signed transactions to the Vault via HTTPS. Asset anchoring operations are submitted directly to the mempool endpoint, bypassing the mining pipeline entirely.
- **Reward calculation:** Applying the halving schedule to determine the correct mining reward for the next block height.
- **Asset management:** Computing SHA-256 fingerprints for the `anchor`, `gallery`, and `verify` commands; scanning confirmed blocks and the live mempool for asset records.

The Control Layer never performs block hashing and never executes computationally intensive work. It maintains a minimal network profile — connecting to the Vault only when submitting a completed block or transaction.

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

### 2.4 The Two Transaction Pathways

ATK-Mint operates two distinct submission pathways, depending on the operation:

**The Mining Pathway (MINT blocks):** Used for earning block rewards. Requires Proof-of-Work. The Sovereign Engine hashes the block header, the Autarky compiler formally verifies the resource parameters, both signatures are embedded, and the completed block is submitted to `/blocks`. This pathway is computationally intensive by design.

**The Mempool Pathway (TRANSFER and ANCHOR records):** Used for transfers and digital asset anchoring. Requires no Proof-of-Work. The Control Layer signs the transaction and submits it directly to `/transactions`. The record enters the mempool and is included in the next mined block by any network participant. This pathway is instant and costs only the transaction fee (0.0001 ₳ for asset anchoring).

The separation of these pathways is significant: it means that storing a digital asset on the blockchain does not require the user to perform any mining themselves. The cost is a trivial ₳ fee, and confirmation happens automatically when the next miner processes the mempool.

---

## 3. Formal Verification: The Autarky Advantage

This is ATK-Mint's most significant point of difference from all major existing cryptocurrencies.

### 3.1 How Other Blockchains Validate Transactions

Bitcoin validates transactions through script execution and UTXO accounting. Ethereum validates smart contracts through the Ethereum Virtual Machine (EVM). In both cases, the validation logic is interpreted at runtime, and the *correctness* of the logic depends on the runtime correctly implementing the specification. There is no mathematical proof that a given transaction or contract cannot create invalid resource states.

Ethereum's history of re-entrancy attacks, integer overflow vulnerabilities, and logic errors in high-value smart contracts demonstrates that runtime validation alone is insufficient for guaranteeing resource safety.

### 3.2 How ATK-Mint Validates Transactions

Every MINT block submitted to the ATK-Mint Vault must contain a `compiler_payload_raw`, `compiler_signature`, and `compiler_pubkey` field. These are generated by running the Autarky compiler over the block's resource parameters before the block is submitted.

The Autarky compiler enforces **Linear Logic** at the type-system level. In a Linear Type System, every variable is a resource that must be consumed exactly once:

- **Zero uses** is a compile-time error: the resource leaks, equivalent to a memory leak or an unspent token that disappears.
- **Two or more uses** is a compile-time error: the resource is duplicated, which at the protocol level would constitute a double-spend.

This is not a runtime check. The compiler mathematically proves resource correctness before any bytecode is generated. If the proof fails, no output is produced and no block can be submitted. If the proof succeeds, the compiler signs the result with `autarky.key`, and the Vault can verify that signature using `compiler.pub` — confirming that the block was produced by a correctly verified Autarky execution.

### 3.3 What This Means in Practice

The network's `.aut` programs encode the protocol's core financial operations:

```autarky
;; main.aut — Resource injection proof.
;; SYS_COMPUTE and SYS_CREDITS are linear variables.
;; Both must be consumed exactly once or the compiler rejects the block.
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
      (pair (pair s1 q1) (pair s2 q2))))))))))
```

No equivalent of this formal guarantee exists in Bitcoin Script or Solidity. Solidity contracts can be formally verified using external tools as an optional add-on; in ATK-Mint, formal verification is a mandatory, non-bypassable step in the block submission pipeline.

### 3.4 The Compiler as a Consensus Participant

The Autarky compiler is not an external tool — it is a consensus participant. The Vault holds `compiler.pub` (the compiler's Ed25519 public key). Every MINT block submitted to the Vault includes a `compiler_signature`. The Vault verifies this signature before accepting the block, meaning:

- Blocks produced without running the Autarky compiler are cryptographically invalid.
- Blocks produced by a tampered or substituted compiler (one not matching the known `compiler.pub`) are rejected.
- The formal verification step cannot be skipped, forged, or bypassed.

This architecture embeds formal correctness into the consensus mechanism itself.

---

## 4. ₳ as a Utility Currency

Most cryptocurrencies derive their value from one of two sources: speculation (the expectation that others will pay more in the future) or monetary policy scarcity (a capped supply modelled on Bitcoin). Neither mechanism ties the token's value to real-world usage. A token can be scarce and still worthless if nobody needs it to do anything.

ATK-Mint is designed differently. ₳ is a **utility currency**: a token whose demand is structurally generated by genuine network activity. Every meaningful operation on the ATK-Mint network requires ₳ to execute. The more the network is used, the more ₳ is needed, independent of speculative sentiment.

### 4.1 Sources of Utility Demand

| Network Operation | ₳ Required | Pathway |
|---|---|---|
| Mining a block (MINT) | PoW computation | Mining pathway — block reward |
| Transferring ₳ | Transaction fee | Mempool pathway |
| Anchoring a digital asset | 0.0001 ₳ (self-transfer fee) | Mempool pathway — instant |
| Issuing a custom asset token | Gas fee | Formally verified token creation |
| Splitting a token for fractional transfer | Gas fee | Linear-type-proven resource division |
| Performing an atomic swap | Gas fee | Trustless, formally verified exchange |
| Anchoring a code commit (Mark) | Gas fee | Mempool pathway — blockchain audit trail |
| Leasing compute infrastructure | Payment in ₳ | ExecutionLease certificate (ID 999) |

Every entry in this table represents a distinct reason to hold and spend ₳ — none of which require believing the price will rise.

### 4.2 Why Formal Verification Strengthens the Utility Case

The formal verification layer is not merely a security feature — it is the economic foundation of the utility argument. In Ethereum, smart contract bugs have caused billions of dollars in losses. This risk means sophisticated users must pay for external audits before deploying contracts, and significant value stays off-chain rather than risk exposure to unverified contract logic.

In ATK-Mint, formal verification is not optional and not external. It is structurally embedded in consensus. Every asset operation — every token mint, every swap, every lease — is mathematically proven correct before it reaches the chain. This means:

- Users can place higher-value assets on-chain with greater confidence.
- The cost of operating on the network (in ₳) reflects real, proven work — not probabilistic safety.
- Applications built on ATK-Mint inherit provable correctness guarantees that applications built on runtime-validated chains cannot match.

The utility value of ₳ is therefore not just "gas for computation" — it is gas for *proven* computation, which is a qualitatively different and more valuable proposition.

### 4.3 Comparison with Speculative and Utility Peers

| Network | Validation Model | Token Utility | Formal Verification |
|---|---|---|---|
| Bitcoin | Runtime UTXO | Store of value, transfers | None |
| Ethereum | Runtime EVM | Smart contract gas | Optional, external |
| Solana | Runtime PoH/PoS | Smart contract gas | Optional, external |
| **ATK-Mint** | **Compile-time Linear Logic** | **Gas for all asset operations** | **Mandatory, built into consensus** |

### 4.4 The Utility-Scarcity Flywheel

ATK-Mint's monetary design combines two demand drivers that reinforce each other. Scarcity (the halving schedule) creates deflationary supply pressure over time. Utility (gas demand from asset operations, anchoring fees, and compute leasing) creates baseline demand independent of speculative sentiment. As network usage grows, demand for ₳ increases; as supply issuance decreases through halving cycles, the intersection of rising demand and contracting supply creates structural appreciation pressure grounded in real activity rather than narrative.

---

## 5. The Asset Layer: What Can Be Stored on ATK-Mint

ATK-Mint is a general-purpose, formally verified asset network. The `src/core.aut` module defines a complete set of asset primitives. The Digital Asset Gallery — implemented in `mark.js` — provides a user-facing interface for the most common anchoring use case. Mark VCS is one further application of this layer.

### 5.1 The Digital Asset Gallery

The Digital Asset Gallery is ATK-Mint's native system for registering any file as a permanently anchored, blockchain-verified digital asset. It operates through three commands — `anchor`, `gallery`, and `verify` — and uses the mempool pathway, making it accessible without any mining infrastructure.

**The Anchoring Record Format**

When a file is anchored, the Control Layer computes its SHA-256 fingerprint and formats a metadata string:

```
ATK_ASSET|<filename>|HASH:<sha256_fingerprint>
```

This string is embedded as the message field of a signed self-transfer (sender and recipient are the same address, amount is 0.0001 ₳). The transaction is broadcast to the Vault mempool and confirmed in the next block.

**The `anchor` command** — registering a digital asset:

```bash
node mark.js anchor my_artwork.png
# 🔗 Anchoring Asset: my_artwork.png...
# 🧬 Fingerprint: a3f9c2d8...
# ✅ Asset broadcasted to Vault Mempool!
# ⏳ It will be permanently anchored when the next block is mined.
```

**The `gallery` command** — viewing your collection:

The gallery scans both the confirmed blockchain and the live mempool, so newly anchored assets are visible immediately — marked as `⏳ PENDING` — without waiting for block confirmation.

```
📂 --- Your Sovereign Digital Asset Gallery ---
✅ Asset: contract_signed.pdf
   🧬 Fingerprint: a3f9c2...
   🛡️ Status: 🧱 ANCHORED (Block #4821)
--------------------------------------------
✅ Asset: software_v1.2.zip
   🧬 Fingerprint: 7d14e8...
   🛡️ Status: ⏳ PENDING (Awaiting Block)
--------------------------------------------
```

**The `verify` command** — proving authenticity:

Verification recomputes the local file's SHA-256 and audits the full blockchain for a matching record. It requires no special credentials — the fingerprint alone is the proof. Verification can be performed by any party with access to the file and the chain.

```bash
node mark.js verify contract_signed.pdf
# ✅ VERIFIED: This file is mathematically authentic!
# 🧱 Found securely anchored in Block: #4821
```

If the file has been altered in any way — even by a single byte — its fingerprint will not match the on-chain record:

```bash
# ❌ UNVERIFIED: This exact file fingerprint does not exist on your blockchain.
#    (If even a single comma was changed in the file, the fingerprint will fail).
```

**Security properties of the gallery system:**

The gallery is tamper-evident by construction. The SHA-256 algorithm produces a unique, fixed-length fingerprint for any input; altering the file changes the fingerprint. The on-chain record is immutable — changing it would require rewriting every block from the point of anchoring to the present, which requires recomputing all subsequent Proof-of-Work. The combination of cryptographic hashing and blockchain immutability provides a provenance guarantee that no centralised notarisation service can match.

**Cost:** 0.0001 ₳ per anchored asset. No mining hardware required.

### 5.2 Fungible Tokens

Any entity can issue a custom fungible token on the network by providing a symbol identifier and an initial quantity. The token is a formally verified linear resource — it cannot be duplicated, cannot be silently destroyed, and cannot be double-spent.

```autarky
;; mint_asset — Issues a new token if the caller holds the sovereign key.
(let mint_asset (lambda (k) (lambda (q)
  (unpack k (lambda (ks ki) (match (eq ks 001)
    (pair (pair ks ki) (pair 100 q))
    (pair (pair ks ki) (pair 000 0))))))))
```

Use cases: loyalty points, project tokens, access credentials, receipt tokens for physical assets.

### 5.3 Fractional Ownership and Token Splitting

A token holding can be split into a payment portion and a change portion. Both resulting tokens must be consumed, preventing value from being silently destroyed.

```autarky
;; split_token — Divides a token into (payment, change).
;; Linear types guarantee the total quantity is conserved exactly.
(let split_token (lambda (t) (lambda (a)
  (unpack t (lambda (s q)
    (pair (pair s a) (pair s (sub q a))))))))
```

Use cases: fractional ownership of assets, instalment payments, escrow deposits.

### 5.4 Atomic Swaps

Two parties can exchange assets trustlessly in a single atomic operation. The swap either executes completely or does not execute at all. This is enforced by the linear type system, not by contract logic.

```autarky
;; atomic_swap — Exchanges a1 and a2 if a2's quantity matches price p.
(let atomic_swap (lambda (a1) (lambda (a2) (lambda (p)
  (unpack a1 (lambda (s1 q1) (unpack a2 (lambda (s2 q2)
    (match (eq q2 p)
      (pair (pair s1 q2) (pair s2 q1))
      (pair (pair s1 q1) (pair s2 q2)))))))))))
```

Use cases: decentralised exchange of any two token types, peer-to-peer barter, trustless settlement.

### 5.5 Token Merging

Two tokens of the same type can be merged into a single token whose quantity is the sum of both. Both source tokens are consumed in the process.

```autarky
;; merge_tokens — Combines t1 and t2 if they share the same symbol.
(let merge_tokens (lambda (t1) (lambda (t2)
  (unpack t1 (lambda (s1 q1) (unpack t2 (lambda (s2 q2)
    (match (eq s1 s2)
      (pair s1 (add q1 q2))
      (pair s1 q1)))))))))
```

Use cases: consolidating fragmented holdings, aggregating payments, rolling up partial receipts.

### 5.6 Token Burning

A token can be permanently destroyed by consuming its quantity against itself. The linear type system guarantees this operation is final.

```autarky
;; burn_asset — Permanently destroys a token.
(let burn_asset (lambda (t) (unpack t (lambda (s q) (sub q q)))))
```

Use cases: deflationary mechanisms, proof of consumption, redeeming tokens for off-chain assets.

### 5.7 Infrastructure as an Asset: Compute Leasing

The `src/devops.aut` module models cloud infrastructure — compute time and diagnostic access — as formally verified linear tokens. An operator can lease compute hours (ExecutionLease, ID 999) or diagnostic credits (ID 777) in exchange for ₳.

```autarky
;; lease_compute — Exchanges token value for an ExecutionLease (ID 999).
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

Use cases: pay-per-use cloud compute markets, diagnostic access control, infrastructure billing with on-chain audit trails.

### 5.8 Immutable Record Anchoring (Mark VCS)

Mark is a Layer-2 application built on ATK-Mint that anchors arbitrary content hashes to the blockchain. Setting `mark_commit: true` in a block records an immutable, timestamped reference to any digital asset: source code, documents, or any file whose hash can be computed. The Digital Asset Gallery (§5.1) provides a higher-level, user-facing interface to this same capability.

Use cases: software version control with blockchain audit trails, document notarisation, IP timestamping, supply chain provenance.

---

## 6. Tokenomics and Monetary Policy

The ₳ supply schedule is determined by immutable protocol rules enforced by the Vault.

| Parameter | Value |
|---|---|
| Maximum Supply | 100,000,000,000 ₳ (100 billion) |
| Genesis Allocation | 10,000,000,000 ₳ (10% — Sovereign Treasury) |
| Mining Pool | 90,000,000,000 ₳ (90% — Proof-of-Work only) |
| Initial Block Reward | 50,000 ₳ |
| Halving Interval | Every 210,000 blocks (approximately 4-year cycles) |
| Difficulty | 6 leading zeros (SHA-256) |

### 6.1 The Genesis Allocation

At Block #0, the protocol executed a one-time mint of 10,000,000,000 ₳ to the Sovereign Treasury address. These funds are designated for ICO distribution, ecosystem grants, and core protocol research. No further genesis-style minting is possible; the Vault enforces the 100B hard cap on every block.

### 6.2 The Halving Engine

The block reward follows a programmatic decay schedule:

$$\text{Reward}(n) = \left\lfloor \frac{50{,}000}{2^n} \right\rfloor$$

where $n$ is the number of completed 210,000-block intervals. This creates predictable, time-decreasing supply issuance that incentivises early network participation while ensuring long-term scarcity.

### 6.3 Balance Calculation

Balances are computed dynamically by scanning the full chain from genesis, summing all `MINT` and `GENESIS` credits and all `TRANSFER` debits and credits for a given public key. The ledger is the single source of truth.

---

## 7. Consensus and the Gravity Shield

ATK-Mint uses Proof-of-Work for block production. To append a block, the Sovereign Engine must find a nonce $N$ such that:

$$H(B_{\text{prev}} \| T_x \| N) < T_{\text{target}}$$

where $H$ is SHA-256, $B_{\text{prev}}$ is the previous block hash, and $T_x$ is the serialised transaction data.

### 7.1 The Gravity Shield — Dynamic Difficulty

The Gravity Shield algorithm continuously monitors inter-block timestamps. As global hash rate increases, the algorithm raises the difficulty target to prevent block time compression and supply inflation. As hash rate decreases, it lowers the target to maintain a consistent block cadence. Current baseline difficulty is 6 leading zeros.

### 7.2 Double-Spend Prevention

The protocol implements a four-layer defence against double-spend attacks:

**Stateful Ledger Validation:** Every incoming transaction is checked against the current ledger before entering the mempool. Transactions where the sender's balance is insufficient are dropped immediately.

**Transaction Nonce and Atomic Sequencing:** Each transaction is cryptographically bound to a unique, incrementing nonce. Once a transaction's signature is included in a confirmed block, that signature is marked globally spent. Any rebroadcast is rejected as a replay attack.

**Longest Chain Rule:** In the event of a network fork, the protocol follows the chain with the greatest cumulative Proof-of-Work. Transactions on a shorter fork are invalidated when the network converges on the canonical chain.

**Confirmation Depth:** High-value transfers should wait for 3–6 confirmations, after which the computational cost of rewriting the required history makes double-spend attempts economically non-viable.

---

## 8. Deployment Architecture

### 8.1 Docker Containerisation

The canonical deployment method is Docker. A multi-stage Docker build compiles the Autarky Sovereign Engine from Rust source on the target machine, eliminating all pre-compiled binary dependencies. The operator's `wallet.json` is mounted at runtime via a Docker volume, maintaining the Identity Firewall.

For `anchor` and `verify` operations, the directory containing the target file must also be mounted into the container.

### 8.2 Vault Architecture

The current production Vault (`atk-mint-vault.duckdns.org`) exposes two endpoints relevant to client operations:

- `/blocks` — receives completed MINT blocks (mining pathway).
- `/transactions` — receives signed transfers and asset anchoring records (mempool pathway).
- `/mempool` — serves pending transactions; queried by the `gallery` command to show real-time pending status.
- `/balance/<pubkey>` — serves the computed balance for any address.
- `/nonce/<pubkey>` — serves the current nonce and chain state for a given address.

---

## 9. Network Topology Roadmap

| Phase | Status | Description |
|---|---|---|
| Phase 1 — Sovereign Vault | ✅ Complete | Centralised Vault as ledger arbiter; full PoW mining and formal verification pipeline operational |
| Phase 2 — Web Explorer | ✅ Complete | Live visual dashboard for the ATK-Mint ledger |
| Phase 3 — Halving Engine | ✅ Complete | Automated 210,000-block supply halving |
| Phase 4 — Digital Asset Gallery | ✅ Complete | `anchor`, `gallery`, `verify` commands; mempool pathway for instant asset registration |
| Phase 5 — Multi-Region Validators | 🔄 In Progress | Geographic distribution of validation nodes |
| Phase 6 — Hydra P2P | 📋 Planned | Full transition to Byzantine Fault Tolerant gossip consensus; deprecation of centralised Vault |
| Phase 7 — Public Liquidity | 📋 Planned | Treasury distribution and ecosystem grants |

---

## 10. Security Disclosure

ATK-Mint is experimental beta software. The protocol has not undergone a formal third-party security audit. Do not use this software to store or transfer funds of significant value. The creators and contributors accept no liability for losses arising from use of this software.

The `AUTARKY_COMPILER_SECRET` environment variable (the compiler signing key) must be treated as a private key. It must not be committed to version control, logged, or transmitted over unencrypted channels. Loss or exposure of this key compromises the root of trust for all network blocks produced by that compiler instance.

---

## 11. Conclusion

The Autarky Protocol demonstrates that the security limitations of monolithic PoW architectures are architectural, not fundamental. By bifurcating the node environment into an isolated hashing engine and a lightweight control layer, ATK-Mint allows mining infrastructure to scale across untrusted cloud environments without placing treasury assets at risk.

By embedding the Autarky compiler as a mandatory consensus participant, ATK-Mint introduces a class of transaction safety guarantee that no major existing blockchain provides as a native protocol feature. Resource correctness is proven before a block can be created, and that proof is cryptographically signed and independently verifiable.

The Digital Asset Gallery extends this foundation to a concrete, user-facing product: any file can be permanently anchored to the blockchain for 0.0001 ₳, with no mining infrastructure required. The anchor, gallery, and verify workflow provides provenance guarantees — tamper-evidence, immutable timestamps, independent verifiability — that no centralised notarisation service can replicate.

Most significantly for its long-term value proposition, ₳ is a utility currency. Its demand is structurally generated by real network usage across eight distinct operation types, each of which is formally verified. Combined with the halving-driven supply schedule, this creates a monetary design in which scarcity and utility reinforce each other — a flywheel grounded in real activity rather than narrative.

As the network progresses toward Hydra P2P decentralisation, these properties will be preserved and extended across a fully distributed consensus topology.

---

## Authorship Disclosure

This project was conceived and directed by Kevin Davies. The protocol architecture, system design, and source code were produced with the assistance of Gemini Pro (developed by Google DeepMind), acting under the author's direction. The written content of this document — including technical descriptions, strategic framing, and supporting documentation — was generated with the assistance of Claude (developed by Anthropic PBC), also under the author's direction. The author retains full intellectual responsibility for the factual claims, technical specifications, and strategic positions set out herein. No AI-generated content has been incorporated without human review and approval.

---

*ATK-Mint is MIT-licensed open source software. See `LICENSE` for terms.*  
*Network Explorer: https://kevindaviesnz.github.io/atk-mint/explorer.html*
