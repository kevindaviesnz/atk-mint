# Autarky & Mark VCS - Frequently Asked Questions

### What is the difference between `atk-mint` and `mark`?
`atk-mint` is the underlying Layer-1 blockchain, consensus engine, and currency. `mark` is the Layer-2 decentralized version control application (like Git) that uses `atk-mint` as gas to anchor code commits to the blockchain.

### Why do I need to run a Rust binary if the server is Node.js?
The Node.js server handles the P2P networking and HTTP API. The Rust binary (`atk`) is the **Formal Verification Engine**. It mathematically guarantees that smart contracts consume resources exactly once (Linear Logic) before a transaction is allowed on the ledger.

### Can I change my `autarky.key`?
No. The `autarky.key` is the root sovereign identity of the network. If you change it, the `compiler.pub` will no longer match, and the network will reject all future blocks as forgeries. 

### Why is the difficulty set to 6?
Difficulty 6 requires finding a SHA-256 hash with 6 leading zeros. This provides a balance between sufficient cryptographic work (to prevent spam) and reasonable mining times on consumer hardware.

### Where is my balance actually stored?
Your balance is not stored in a database. It is dynamically calculated by reading the immutable `chain_3000.json` ledger from genesis to the latest block, calculating all `MINT` and `TRANSFER` operations mathematically.

Authorship disclosure: This project was produced through a human-directed AI process under the oversight of Kevin Davies. The protocol architecture, source code, and technical design were developed in collaboration with Gemini Pro (Google DeepMind). The written documentation — including this whitepaper, the README, and supporting materials — was drafted using Claude (Anthropic). All AI-generated outputs were produced under the author's direct direction and reviewed prior to publication.