# Use a lightweight Node image
FROM node:20-alpine

WORKDIR /app

# 1. Copy everything (including your pre-compiled bin/atk-linux)
COPY . .

# 2. Install Node dependencies
RUN npm install --production

# 3. Ensure the Linux binary has permission to execute
RUN chmod +x bin/atk-linux

# 4. Expose the Network Ports
EXPOSE 3000
EXPOSE 6000

# 5. Start the Central Bank Node
CMD ["node", "server.js"]