# Autarky Network (ATK-Mint)

**A Layer-1 Proof-of-Work blockchain with a hard-capped 100B supply, automated halving scarcity, and the first formally verified digital asset platform in any public cryptocurrency network.**

**[View the Live Network Explorer](https://kevindaviesnz.github.io/atk-mint/explorer.html)** | **[Read the Technical Whitepaper](docs/WHITEPAPER.md)**

---

> ⚠️ **Beta Software.** ATK-Mint is experimental. Do not use for high-value financial transactions. The creators accept no liability. See the [Security Disclosure](#security-disclosure) section below.

---

## What ATK-Mint Is

ATK-Mint is not a speculative currency. ₳ is a **utility token**: every meaningful operation on the network — issuing a custom asset, performing an atomic swap, leasing compute time, anchoring a file to the chain, or mining a block — requires ₳ to execute. The value of ₳ is grounded in real network demand, not in the expectation that future buyers will pay more.

The network provides three things that no major existing blockchain provides together:

**Formally verified transactions.** Every block must pass the Autarky compiler — a Linear Logic type-checker — before the network will accept it. This mathematically proves that every resource in every operation is consumed exactly once. Double-spends and resource leaks are not detected at runtime; they are impossible by construction.

**A general-purpose asset layer.** ₳ is the gas for a complete set of asset primitives: fungible token issuance, fractional splitting, atomic swaps, token merging, token burning, compute leasing, and a native digital asset gallery with blockchain-verified provenance.

**An Identity Firewall.** Financial keys and mining operations are architecturally separated. Mining scales across untrusted cloud servers without ever exposing treasury funds.

---

## What You Can Store and Do

### Native Currency Transfers

Send and receive ₳ between any two addresses. Every transfer is signed by the sender, verified against the live ledger, and formally proven before inclusion in a block.

### Digital Asset Anchoring — `anchor` / `gallery` / `verify`

Any file — an image, a document, a contract, source code, a certificate — can be permanently registered on the ATK-Mint blockchain as a digital asset. Three commands form a complete provenance workflow:

**`anchor`** registers a file. It computes the file's SHA-256 fingerprint, packages it with a name into a metadata record, and broadcasts it to the network mempool as a tiny self-transfer (0.0001 ₳). No mining is required — the record is submitted instantly and confirmed when the next block is mined.

**`gallery`** displays your personal collection. It scans both confirmed blocks and pending mempool entries, showing each asset's name, fingerprint, and whether it is pending confirmation or permanently anchored with its block number.

**`verify`** proves authenticity. Given any local file, it recomputes the fingerprint and audits the entire blockchain for a matching record. If found, it reports the block number in which the asset was anchored. If not found, it confirms the file has no on-chain record — or has been altered since anchoring.

Example use cases: artwork provenance, contract notarisation, software release signing, IP timestamp proofs, diploma or credential verification, supply chain records.

### Custom Fungible Tokens

Issue your own token with a unique symbol identifier and an initial supply. The token is a formally verified linear resource: it cannot be duplicated, cannot disappear, and cannot be double-spent. Once issued, it can be split, merged, swapped, and burned using the same operations as ₳.

Example use cases: loyalty points, project tokens, access credentials, receipts for physical assets.

### Fractional Ownership

Split any token holding into a payment portion and a change portion. The linear type system guarantees the total quantity is conserved exactly — the sum of payment and change always equals the original holding.

Example use cases: partial payments, escrow deposits, fractional ownership of high-value assets.

### Atomic Swaps

Exchange two different token types in a single, indivisible operation. The swap either completes fully or does not happen at all — there is no intermediate state in which one party has delivered and the other has not.

Example use cases: peer-to-peer exchange of any two token types, trustless barter, settlement without a trusted intermediary.

### Compute Leasing

Purchase compute time as a formally verified token (ExecutionLease, ID 999). Payment is split into a lease certificate and change, both of which must be consumed — the compiler will not accept a transaction that leaves either resource unaccounted for.

Example use cases: pay-per-use infrastructure markets, cloud compute billing with on-chain audit trails.

### Immutable Record Anchoring (Mark VCS)

Mark anchors code commit hashes to the ATK-Mint ledger, creating a blockchain-verified audit trail for software history. Past commits cannot be silently rewritten without rewriting the blockchain.

---

## Tokenomics

| Parameter | Value |
|---|---|
| Maximum Supply | 100,000,000,000 ₳ (100 billion — hard cap) |
| Genesis / Treasury (10%) | 10,000,000,000 ₳ — ICO, development, ecosystem grants |
| Mining Pool (90%) | 90,000,000,000 ₳ — Proof-of-Work only |
| Initial Block Reward | 50,000 ₳ |
| Halving Interval | Every 210,000 blocks (~4-year cycles) |
| Current Difficulty | 6 leading zeros (SHA-256) |

The block reward halves every 210,000 blocks:

$$\text{Reward}(n) = \left\lfloor \frac{50{,}000}{2^n} \right\rfloor$$

As supply issuance decreases through halving cycles and network usage drives gas demand upward, the two forces create structural appreciation pressure grounded in real activity. See the [Whitepaper §4](docs/WHITEPAPER.md) for the full utility-scarcity flywheel analysis.

---

## Architecture

The protocol runs as two isolated layers communicating only through local standard I/O. They share no memory, no filesystem access, and no network stack.

```
┌─────────────────────────────────┐        ┌──────────────────────────────────┐
│  CONTROL LAYER  ("The Brain")   │        │  SOVEREIGN ENGINE  ("The Muscle") │
│  mark.js  ·  Node.js            │        │  bin/atk  ·  Compiled Rust       │
│                                 │        │                                  │
│  • Holds wallet.json            │◄──────►│  • SHA-256 Proof-of-Work         │
│  • Signs blocks (ECDSA)         │  stdio │  • Autarky formal verification   │
│  • Talks to the Vault (HTTPS)   │        │  • Signs compiler proof (Ed25519) │
│  • Applies halving schedule     │        │  • NO network stack              │
│  • Never performs hashing       │        │  • NO access to wallet.json      │
└─────────────────────────────────┘        └──────────────────────────────────┘
         │                                                   │
         │ wallet.json stays here                            │ autarky.key lives here
         │ (local machine only)                              │ (safe to deploy to cloud)
         ▼                                                   ▼
   Your treasury                                     Mining servers
   — never exposed                                   — compromisable, harmless
```

### The Formal Verification Pipeline

Every MINT block goes through this sequence before the Vault accepts it:

1. Control Layer syncs with the Vault: chain height, nonce, previous block hash.
2. Sovereign Engine solves Proof-of-Work (6 leading zeros, SHA-256).
3. Autarky compiler runs the `.aut` program against the block's resource parameters, formally proving correctness under Linear Logic.
4. Compiler signs the proof with `autarky.key` → `compiler_signature` + `compiler_pubkey` embedded in block.
5. Control Layer signs the completed block with `wallet.json`.
6. Vault verifies both signatures. Block is rejected if either is missing or invalid.

Asset anchoring (`anchor`) uses the mempool pathway — a signed self-transfer — and does not require Proof-of-Work. The record is confirmed when any subsequent miner includes the mempool transaction in their block.

---

## Getting Started

### Option A: Docker (Recommended)

Docker compiles the Sovereign Engine from source, eliminating binary compatibility issues and keeping your environment clean.

#### 1. Clone and install

```bash
git clone https://github.com/kevindaviesnz/atk-mint.git
cd atk-mint
npm install
```

#### 2. Generate your wallet

Creates `wallet.json` — your financial identity. Keep it secure. Never commit it to version control.

```bash
node mark.js init
```

#### 3. Build the container

```bash
docker build -t atk-miner .
```

#### 4. Command reference — Docker

All Docker commands mount `wallet.json` from your local machine. Your financial keys never enter the image. For `anchor` and `verify`, also mount the directory containing your file.

**Wallet and balance:**

| Action | Command |
|---|---|
| Initialise wallet | `node mark.js init` *(run once, before Docker)* |
| Check your balance | `docker run -it --rm -v "$(pwd)/wallet.json:/app/wallet.json" atk-miner balance` |
| Check any address | `docker run -it --rm -v "$(pwd)/wallet.json:/app/wallet.json" atk-miner balance <ADDRESS>` |
| View your address | `docker run -it --rm -v "$(pwd)/wallet.json:/app/wallet.json" atk-miner address` |

**Transfers:**

| Action | Command |
|---|---|
| Transfer ₳ | `docker run -it --rm -v "$(pwd)/wallet.json:/app/wallet.json" atk-miner transfer <ADDRESS> <AMOUNT>` |
| Transfer ₳ (alias) | `docker run -it --rm -v "$(pwd)/wallet.json:/app/wallet.json" atk-miner send <ADDRESS> <AMOUNT>` |

**Mining:**

| Action | Command |
|---|---|
| Mine one block | `docker run -it --rm -v "$(pwd)/wallet.json:/app/wallet.json" atk-miner mine` |
| Mine with message | `docker run -it --rm -v "$(pwd)/wallet.json:/app/wallet.json" atk-miner mine "Your message"` |
| Mine one block (alias) | `docker run -it --rm -v "$(pwd)/wallet.json:/app/wallet.json" atk-miner commit` |

**Digital asset gallery — `anchor`, `gallery`, `verify`:**

For `anchor` and `verify`, mount the folder containing your file alongside `wallet.json`:

| Action | Command |
|---|---|
| Anchor a file | `docker run -it --rm -v "$(pwd)/wallet.json:/app/wallet.json" -v "$(pwd):/app/files" atk-miner anchor files/<FILENAME>` |
| View your gallery | `docker run -it --rm -v "$(pwd)/wallet.json:/app/wallet.json" atk-miner gallery` |
| Verify a file | `docker run -it --rm -v "$(pwd)/wallet.json:/app/wallet.json" -v "$(pwd):/app/files" atk-miner verify files/<FILENAME>` |

**Example — anchor, then verify a document:**

```bash
# Step 1: Anchor the file to the blockchain
docker run -it --rm \
  -v "$(pwd)/wallet.json:/app/wallet.json" \
  -v "$(pwd):/app/files" \
  atk-miner anchor files/contract.pdf

# Step 2: Check your gallery (shows as ⏳ PENDING until next block is mined)
docker run -it --rm \
  -v "$(pwd)/wallet.json:/app/wallet.json" \
  atk-miner gallery

# Step 3: Verify authenticity at any future time
docker run -it --rm \
  -v "$(pwd)/wallet.json:/app/wallet.json" \
  -v "$(pwd):/app/files" \
  atk-miner verify files/contract.pdf
```

#### 5. Continuous mining

```bash
# Foreground — watch live output, Ctrl+C to stop
docker run -it --rm \
  --entrypoint /bin/sh \
  -v "$(pwd)/wallet.json:/app/wallet.json" \
  atk-miner -c "while true; do node mark.js mine 'Cloud Node'; sleep 2; done"

# Background — safe to close terminal or disconnect from VPS
docker run -d \
  --name atk-cloud-miner \
  --entrypoint /bin/sh \
  -v "$(pwd)/wallet.json:/app/wallet.json" \
  atk-miner -c "while true; do node mark.js mine 'Cloud Node'; sleep 2; done"
```

```bash
docker logs -f atk-cloud-miner   # View live logs
docker stop atk-cloud-miner       # Stop mining
docker rm atk-cloud-miner         # Remove background process
```

---

### Option B: Local CLI

```bash
git clone https://github.com/kevindaviesnz/atk-mint.git
cd atk-mint
npm install
node mark.js init
```

**Complete command reference:**

| Command | Description |
|---|---|
| `node mark.js init` | Generate a new `wallet.json`. Run once before anything else. |
| `node mark.js address` | Display your public key (your receiving address). |
| `node mark.js balance` | Query your confirmed ₳ balance from the Vault. |
| `node mark.js balance <ADDRESS>` | Query any address — including the Treasury. |
| `node mark.js transfer <ADDRESS> <AMOUNT>` | Sign and broadcast an ₳ transfer. |
| `node mark.js send <ADDRESS> <AMOUNT>` | Alias for `transfer`. |
| `node mark.js mine` | Solve a single Proof-of-Work block and earn mining rewards. |
| `node mark.js mine "<message>"` | Mine a block with a custom message embedded on-chain. |
| `node mark.js commit` | Alias for `mine`. |
| `node mark.js anchor <filepath>` | Compute a file's SHA-256 fingerprint and anchor it to the blockchain. Costs 0.0001 ₳. Confirms when the next block is mined. |
| `node mark.js gallery` | Display all digital assets you have anchored, including pending and confirmed status. |
| `node mark.js verify <filepath>` | Verify a local file's authenticity against the blockchain. Reports the block number if found, or flags it as unverified. |

---

## Digital Asset Gallery — Detailed Usage

### Anchoring a File

```bash
node mark.js anchor my_artwork.png
```

This computes the SHA-256 fingerprint of `my_artwork.png`, packages it as:

```
ATK_ASSET|my_artwork.png|HASH:<sha256>
```

and broadcasts a signed self-transfer of 0.0001 ₳ to the Vault mempool. The record appears in your gallery immediately as `⏳ PENDING` and becomes permanently `🧱 ANCHORED` when the next miner includes it in a block. No Proof-of-Work is required from you.

```bash
# Anchor multiple file types
node mark.js anchor contract_signed.pdf
node mark.js anchor software_v1.2.zip
node mark.js anchor certificate.jpg
node mark.js anchor dataset_final.csv
```

### Viewing Your Gallery

```bash
node mark.js gallery
```

Output example:

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

The gallery scans both the confirmed chain and the live mempool, so newly anchored assets appear immediately without waiting for block confirmation.

### Verifying a File

```bash
node mark.js verify contract_signed.pdf
```

Verification recomputes the local file's SHA-256 and scans the blockchain for a matching record. The result is unambiguous:

```
# File is authentic and on-chain:
✅ VERIFIED: This file is mathematically authentic!
🧱 Found securely anchored in Block: #4821

# File has been altered or was never anchored:
❌ UNVERIFIED: This exact file fingerprint does not exist on your blockchain.
   (If even a single comma was changed in the file, the fingerprint will fail).
```

Verification can be performed by anyone with access to the blockchain — not just the original owner. The cryptographic fingerprint is the sole basis for the check; no metadata, filename, or account credential is required.

---

## Layer-2: Mark Version Control

Mark anchors code commit hashes to the ATK-Mint ledger, creating a blockchain-verified audit trail for software history. Each commit consumes a small ₳ gas fee and is formally verified by the Autarky compiler before acceptance. Past commits cannot be silently rewritten without rewriting the blockchain.

```bash
# Anchor the current git HEAD to the chain
node mark.js mine "git:$(git rev-parse HEAD)"
```

---

## Roadmap

| Phase | Status | Description |
|---|---|---|
| Genesis — 100B treasury initialisation | ✅ Complete | |
| Halving engine — 210k block schedule | ✅ Complete | |
| Web Explorer — live ledger dashboard | ✅ Complete | |
| Digital Asset Gallery — anchor / gallery / verify | ✅ Complete | |
| Multi-region validator nodes | 🔄 In Progress | |
| Hydra P2P — full BFT decentralisation | 📋 Planned | |
| Public liquidity — treasury distribution | 📋 Planned | |

---

## Security Disclosure

ATK-Mint is experimental beta software that has not undergone a formal third-party security audit.

**Do not use this software to store or transfer funds of significant value.**

The `autarky.key` file is the compiler's root signing key. Treat it as a private key: do not commit it to version control, do not log it, and do not transmit it over unencrypted channels. If it is exposed, the compiler's identity within the network is compromised.

The Identity Firewall separates `wallet.json` and `autarky.key` — a meaningful improvement over monolithic node architectures — but does not protect against all threat vectors. Deploy cloud infrastructure with appropriate access controls.

---

## Documentation

| Document | Description |
|---|---|
| [docs/WHITEPAPER.md](docs/WHITEPAPER.md) | Full protocol design, asset layer, utility currency model, and roadmap |
| [docs/RETROSPECTIVE.md](docs/RETROSPECTIVE.md) | Engineering retrospective: the Linux binary failure and the Docker migration |
| [docs/FAQ.md](docs/FAQ.md) | Common questions on the protocol, Mark VCS, and the Autarky compiler |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Solutions to known errors |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Development setup, component guidelines, and PR process |

---

## License

MIT — see `LICENSE` for details.

Copyright © 2026 Kevin Davies.

---

*Authorship disclosure: This document was produced through a human-directed AI process. Architecture and source code were developed using Gemini Pro (Google DeepMind). Documentation was drafted using Claude (Anthropic, 2026). All content was produced under the direction and review of Kevin Davies.*
