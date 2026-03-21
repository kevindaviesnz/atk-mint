# =======================================================
# STAGE 1: The Rust Builder (The Muscle)
# =======================================================
FROM rust:bookworm AS builder

# 1. Install LLVM 15 and necessary build tools
RUN apt-get update && apt-get install -y \
    build-essential \
    llvm-15 \
    llvm-15-dev \
    libclang-15-dev \
    zlib1g-dev \
    libxml2-dev \
    && rm -rf /var/lib/apt/lists/*

# 2. Set LLVM path for the compiler
ENV LLVM_SYS_150_PREFIX=/usr/lib/llvm-15

WORKDIR /usr/src/app

# 3. Copy source code and build the release binary
COPY . .
RUN cd bin/autarky-source && cargo build --release

# =======================================================
# STAGE 2: The Node.js Runtime (The Brain)
# =======================================================
FROM node:20-bookworm-slim

WORKDIR /app

# 1. Copy package files and install dependencies (Fixes the dotenv bug)
COPY package*.json ./
RUN npm install --production

# 2. Copy the Control Script
COPY mark.js ./

# 3. Extract the compiled Sovereign Engine from Stage 1
COPY --from=builder /usr/src/app/bin/autarky-source/target/release/autarky ./atk

# 4. Grant execution permissions to the engine
RUN chmod +x ./atk

# 5. Set the default command to start the continuous miner
ENTRYPOINT ["node", "mark.js"]
CMD ["mine", "Sovereign Cloud Node"]