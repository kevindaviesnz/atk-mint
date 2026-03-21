# Autarky Network (ATK-Mint)

**A Layer-1 Proof-of-Work blockchain with a hard-capped 100B supply, automated halving scarcity, and the first formally verified transaction pipeline in any public cryptocurrency network.**

**[View the Live Network Explorer](https://kevindaviesnz.github.io/atk-mint/explorer.html)** | **[Read the Technical Whitepaper](docs/WHITEPAPER.md)**

---

> ⚠️ **Beta Software.** ATK-Mint is experimental. Do not use for high-value financial transactions. The creators accept no liability. See the [Security Disclosure](#security-disclosure) section below.

---

## What Makes ATK-Mint Different

Most blockchains validate transactions at runtime — the network checks whether the math adds up after the fact. ATK-Mint takes a fundamentally different approach: every block must pass **formal verification** before it can be submitted.

The Autarky compiler — a Linear Logic type-checker — mathematically proves that every resource in a transaction is consumed exactly once. Not approximately. Not probably. Provably. If the proof fails, no block is produced. If the proof passes, the compiler cryptographically signs the result, and that signature is embedded in the block and independently verified by the network.

This is categorically different from Bitcoin Script, the Ethereum EVM, or any other major blockchain's validation model. In those systems, correctness is checked at runtime. In ATK-Mint, correctness is proven at compile time — before the block exists.

A second architectural innovation is the **Identity Firewall**: the protocol separates financial keys from mining operations, so mining can be distributed across untrusted cloud servers without ever exposing treasury funds.

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

The block reward halves every 210,000 blocks following the schedule:

$$\text{Reward}(n) = \left\lfloor \frac{50{,}000}{2^n} \right\rfloor$$

This mirrors Bitcoin's scarcity model, creating predictable supply issuance that rewards early participants while guaranteeing long-term deflationary pressure.

---

## Architecture

The Autarky Protocol runs as two isolated layers that communicate only through local standard I/O. They share no memory, no filesystem access, and no network stack.

```
┌─────────────────────────────────┐        ┌──────────────────────────────────┐
│  CONTROL LAYER  ("The Brain")   │        │  SOVEREIGN ENGINE  ("The Muscle") │
│  mark.js  ·  Node.js            │        │  bin/atk  ·  Compiled Rust/C     │
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

### The Identity Firewall

`wallet.json` (financial keypair) and `autarky.key` (compiler identity key) are separate files with separate roles. Mining nodes only need `autarky.key`. If a cloud server is breached, the attacker gains a disconnected hashing process — not your funds.

### The Formal Verification Pipeline

Every MINT block goes through this sequence before the Vault will accept it:

1. The Control Layer syncs with the Vault to get the current chain height, nonce, and previous block hash.
2. The Sovereign Engine solves Proof-of-Work (6 leading zeros).
3. The Autarky compiler runs `main.aut` against the block's resource parameters (`SYS_COMPUTE`, `SYS_CREDITS`), formally proving resources are consumed correctly under Linear Logic.
4. The compiler signs the proof with `autarky.key`, producing `compiler_signature` and `compiler_pubkey`.
5. The Control Layer signs the completed block with `wallet.json`.
6. The Vault verifies both signatures — the operator signature and the compiler proof signature — before adding the block to the chain.

A block without a valid compiler proof signature is cryptographically invalid. This step cannot be skipped or bypassed.

---

## Getting Started

### Option A: Docker (Recommended)

Docker compiles the Sovereign Engine from source on your machine, eliminating binary compatibility issues and keeping your environment clean.

#### 1. Clone and install dependencies

```bash
git clone https://github.com/kevindaviesnz/atk-mint.git
cd atk-mint
npm install
```

#### 2. Generate your wallet

This creates `wallet.json` — your financial identity. Keep it secure and never commit it to version control.

```bash
node mark.js init
```

#### 3. Build the container

```bash
docker build -t atk-miner .
```

#### 4. Commands

All Docker commands mount your local `wallet.json` into the container. Your financial keys never enter the image.

**Single operations:**

| Action | Command |
|---|---|
| Check balance | `docker run -it --rm -v "$(pwd)/wallet.json:/app/wallet.json" atk-miner balance` |
| View address | `docker run -it --rm -v "$(pwd)/wallet.json:/app/wallet.json" atk-miner address` |
| Transfer ₳ | `docker run -it --rm -v "$(pwd)/wallet.json:/app/wallet.json" atk-miner transfer <ADDRESS> <AMOUNT>` |
| Mine one block | `docker run -it --rm -v "$(pwd)/wallet.json:/app/wallet.json" atk-miner mine "Optional message"` |

**Continuous mining:**

```bash
# Foreground (watch live output, Ctrl+C to stop)
docker run -it --rm \
  --entrypoint /bin/sh \
  -v "$(pwd)/wallet.json:/app/wallet.json" \
  atk-miner -c "while true; do node mark.js mine 'Cloud Node'; sleep 2; done"

# Background (safe to close terminal / disconnect from VPS)
docker run -d \
  --name atk-cloud-miner \
  --entrypoint /bin/sh \
  -v "$(pwd)/wallet.json:/app/wallet.json" \
  atk-miner -c "while true; do node mark.js mine 'Cloud Node'; sleep 2; done"
```

**Background miner management:**

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

**Command reference:**

| Command | Description |
|---|---|
| `node mark.js balance` | Query your confirmed ₳ balance from the Vault |
| `node mark.js balance <ADDRESS>` | Audit the balance of any address |
| `node mark.js address` | Display your public key (receiving address) |
| `node mark.js transfer <ADDRESS> <AMOUNT>` | Sign, mine PoW, and broadcast a transfer |
| `node mark.js mine` | Solve a single block to earn mining rewards |

---

## Layer-2: Mark Version Control

Mark is a decentralised version control system (like Git) built on ATK-Mint. Each commit anchors a code snapshot hash to the blockchain, creating an immutable, tamper-evident audit trail for software history. Commits consume a small amount of ₳ as network gas, and — like all network operations — the gas consumption is formally verified by the Autarky compiler before the commit block is accepted.

This gives Mark commit history a property unavailable to centralised platforms: past commits cannot be silently rewritten without rewriting the blockchain.

---

## Roadmap

| Phase | Status | Description |
|---|---|---|
| Genesis — 100B treasury initialisation | ✅ Complete | |
| Halving engine — 210k block schedule | ✅ Complete | |
| Web Explorer — live ledger dashboard | ✅ Complete | |
| Multi-region validator nodes | 🔄 In Progress | |
| Hydra P2P — full BFT decentralisation | 📋 Planned | |
| Public liquidity — treasury distribution | 📋 Planned | |

---

## Security Disclosure

ATK-Mint is experimental beta software that has not undergone a formal third-party security audit.

**Do not use this software to store or transfer funds of significant value.**

The `autarky.key` file is the compiler's root signing key. Treat it as a private key: do not commit it to version control, do not log it, and do not transmit it over unencrypted channels. If it is exposed, the compiler's identity within the network is compromised.

The Identity Firewall (separation of `wallet.json` and `autarky.key`) is a meaningful security improvement over monolithic node architectures, but it does not protect against all threat vectors. Use cloud infrastructure with appropriate access controls.

---

## Technical Documentation

| Document | Description |
|---|---|
| [docs/WHITEPAPER.md](docs/WHITEPAPER.md) | Full protocol design, formal verification model, tokenomics, and roadmap |
| [docs/RETROSPECTIVE.md](docs/RETROSPECTIVE.md) | Engineering retrospective: architectural decisions, the Linux binary failure, and the Docker migration |
| [docs/FAQ.md](docs/FAQ.md) | Common questions on the protocol, Mark VCS, and the Autarky compiler |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Solutions to known errors |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Development setup, component guidelines, and PR process |

---

## License

MIT — see `LICENSE` for details.

Authorship disclosure: This project was produced through a human-directed AI process under the oversight of Kevin Davies. The protocol architecture, source code, and technical design were developed in collaboration with Gemini Pro (Google DeepMind). The written documentation — including this whitepaper, the README, and supporting materials — was drafted using Claude (Anthropic). All AI-generated outputs were produced under the author's direct direction and reviewed prior to publication.

Copyright © 2026 Kevin Davies.
