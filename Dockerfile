# Stage 1: Build the frontend
FROM node:22-slim AS build

WORKDIR /app

# Install build tools for native modules (better-sqlite3 etc.)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Run the server
FROM node:22-slim

WORKDIR /app

# Install all system dependencies in one layer
RUN apt-get update && apt-get install -y \
    python3 python3-pip \
    ffmpeg \
    make g++ \
    && rm -rf /var/lib/apt/lists/* \
    && pip3 install --break-system-packages -U yt-dlp

COPY package*.json ./
COPY --from=build /app/node_modules ./node_modules

COPY --from=build /app/dist ./dist
COPY --from=build /app/src ./src
COPY --from=build /app/server ./server

# Create data directory for SQLite
RUN mkdir -p /app/data

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "--experimental-strip-types", "server/index.ts"]
