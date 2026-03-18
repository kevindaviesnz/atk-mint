# Contributing to the Autarky Protocol (ATK-MINT)

First off, thank you for considering contributing to ATK-Mint! 

The Autarky Protocol was born from a vision of creating a truly secure, air-gapped, and dynamically scalable Layer-1 blockchain. Whether you are fixing a bug, proposing a new feature, or optimizing our hashing algorithms, your contributions are what will drive this network forward.

To ensure the integrity, security, and stability of the protocol, please review these guidelines before submitting a Pull Request (PR).

---

## 🛑 1. The Golden Rule: Architectural Separation
ATK-Mint is built on a strict **"Brain and Muscle" bifurcation**. This is our core security postulate, and it is non-negotiable.

* **The Brain (Node.js):** Handles state, network I/O, and cryptographic signing. It must **never** perform Proof-of-Work hashing.
* **The Muscle (The Engine):** The compiled binary (`atk`) handles raw computational hashing. It must **never** have a network stack, read external files, or touch `wallet.json`.

**Any Pull Request that attempts to merge these concerns, open unnecessary RPC ports, or compromise the Identity Firewall will be immediately rejected.**

---

## 🛠️ 2. Development Setup

To get the project running locally for development:

1. **Fork the repository** on GitHub.
2. **Clone your fork** to your local machine:
   ```bash
   git clone https://github.com/YOUR-USERNAME/atk-mint.git
   cd atk-mint
   ```
3. **Install Node dependencies** for the Control Layer:
   ```bash
   npm install
   ```
4. **Initialize the Developer Environment:**
   Run the setup script to generate your local `autarky.key` and place the engine in the `bin/` folder.
   ```bash
   ./setup.sh
   ```

---

## ⚙️ 3. Guidelines by Component

Because of our decoupled nature, contributing looks different depending on which part of the stack you are touching.

### A. The Control Layer (`mark.js` / Node.js)
* **Keep it Lightweight:** Do not introduce heavy `npm` dependencies unless absolutely critical. The control layer is designed to run on low-power devices.
* **Security First:** Never log private keys, passwords, or the raw contents of `wallet.json` to the console.
* **Asynchronous I/O:** Ensure all network calls to the Vault (and eventually Hydra P2P) are properly handled asynchronously to prevent blocking the event loop.

### B. The Sovereign Engine (C++ / Rust / Core Binaries)
* **Source Code over Binaries:** Following our architectural retrospective, **do not commit pre-compiled binaries** (`atk-mac`, `atk-linux`) in your PRs. If you are optimizing the hashing engine, submit the raw source code changes and the updated `Makefile` or `CMakeLists.txt`. 
* **OS Agnosticism:** Ensure that any low-level memory management or threading logic respects cross-platform constraints (macOS, standard Linux distros). Avoid strictly linking to OS-specific libraries like `glibc` unless fallback mechanisms are provided.

---

## 🌿 4. Branching and Committing Workflow

We follow a standard Feature Branch workflow.

1. **Create a new branch** for your feature or bugfix:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bugfix-name
   ```
2. **Commit your changes** using clear, descriptive commit messages. We prefer conventional commits:
   * `feat:` for new features
   * `fix:` for bug fixes
   * `docs:` for documentation updates
   * `perf:` for performance/engine optimizations
   ```bash
   git commit -m "feat: implement WebSocket listener for Hydra P2P Phase 2"
   ```
3. **Push to your fork:**
   ```bash
   git push origin feature/your-feature-name
   ```

---

## 🚀 5. Submitting a Pull Request

When you are ready to merge your code, open a Pull Request against the `main` (or `master`) branch of the primary ATK-Mint repository. 

Please include the following in your PR description:
* **Objective:** What does this PR accomplish? (Link to an open issue if applicable).
* **Architecture Check:** A brief confirmation that your code respects the air-gapped security model.
* **Testing Performed:** How did you test this? Did you run it locally on Mac? Linux? 

The core maintainers will review your code. We may request changes or ask for clarification, especially regarding cryptographic primitives or memory management in the engine.

---

## 🤖 6. AI-Assisted Contributions
ATK-Mint is proudly the first Layer-1 protocol architected through human-AI symbiosis. We welcome AI-assisted code contributions! However, as the human operator, **you are strictly responsible for the code you submit.** Ensure you have fully reviewed, tested, and comprehended any AI-generated logic before opening a PR.

---

Thank you for helping us build the future of secure, decentralized infrastructure!

