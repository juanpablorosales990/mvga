# ── Build stage ──────────────────────────────────────────
FROM node:18-alpine AS build

WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install

# Copy prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy source and build
COPY tsconfig.json nest-cli.json ./
COPY src ./src
RUN npm run build -- --webpack false

# ── Runtime stage ────────────────────────────────────────
FROM node:18-alpine

WORKDIR /app

# Copy built output and production deps
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY package.json ./

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/main"]
