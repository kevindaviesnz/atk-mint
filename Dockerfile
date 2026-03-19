# Use a slim, professional Node base
FROM node:20-slim

# Install curl (for miner.sh) and dos2unix (to fix Windows files)
RUN apt-get update && apt-get install -y curl dos2unix && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy all project files
COPY . .

# CRITICAL: Fix line endings for all scripts
RUN dos2unix miner.sh send mark.js && chmod +x miner.sh send mark.js

# This allows you to pass the miner name as a parameter
ENTRYPOINT ["./miner.sh"]
CMD ["Docker-Miner-Global"]