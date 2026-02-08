# ── Build stage ──────────────────────────────────────────
FROM node:20-slim AS build

WORKDIR /app

# Install OpenSSL for Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Ensure devDependencies are installed during build
ENV NODE_ENV=development

# Install dependencies
COPY package.json ./
RUN npm install --legacy-peer-deps

# Copy prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy source and build with SWC (nest build uses SWC, avoids @solana/spl-token .d.ts issue)
COPY tsconfig.json nest-cli.json ./
COPY src ./src
RUN npx nest build

# ── Runtime stage ────────────────────────────────────────
FROM node:20-slim

WORKDIR /app

# Install OpenSSL for Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy built output and production deps
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY package.json ./

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/main"]
