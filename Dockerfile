# Use Node.js base image
FROM node:18

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json files first (for caching)
COPY package*.json ./
RUN npm install --only=production

# Install dependencies (including devDependencies for build)
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the application
RUN npm run build

# Remove devDependencies for production
RUN npm prune --production

# Expose the application port
EXPOSE 3000

# Start the application
CMD ["node", "--max-old-space-size=16000", "dist/server.js"]