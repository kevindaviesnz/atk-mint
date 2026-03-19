# --- STAGE 1: The Rust Builder ---
# Use the latest Rust compiler on Debian Bookworm (v12) to support Edition 2024 and LLVM 15
FROM rust:bookworm AS builder

# 1. Install LLVM 15 and necessary C++ build tools
RUN apt-get update && apt-get install -y \
    build-essential \
    llvm-15 \
    llvm-15-dev \
    libclang-15-dev \
    zlib1g-dev \
    libxml2-dev \
    && rm -rf /var/lib/apt/lists/*

# 2. Tell the Rust compiler exactly where LLVM 15 lives
ENV LLVM_SYS_150_PREFIX=/usr/lib/llvm-15

WORKDIR /usr/src/app

# Copy the entire project into the builder
COPY . .

# Navigate into your specific source folder and compile the Linux binary
RUN cd bin/autarky-source && cargo build --release

# --- STAGE 2: The Node.js Runtime ---
FROM node:20-bookworm-slim

# Install dependencies needed for scripts and Windows line-ending fixes
RUN apt-get update && apt-get install -y curl dos2unix && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy your Node scripts and shell scripts into the final image
COPY miner.sh mark.js package*.json ./

# Extract ONLY the compiled binary from the builder stage
COPY --from=builder /usr/src/app/bin/autarky-source/target/release/autarky ./atk

# Fix line endings (critical for Windows users) and make everything executable
RUN dos2unix miner.sh mark.js && chmod +x miner.sh mark.js ./atk

# Start the continuous miner loop
ENTRYPOINT ["./miner.sh"]