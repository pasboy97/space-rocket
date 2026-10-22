# ==========================================
# Stage 1: Build Frontend & Prepare App
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package manifests first for layer caching
COPY package*.json ./

# Install all dependencies (with --legacy-peer-deps to prevent ERESOLVE peer conflicts)
RUN npm install --legacy-peer-deps

# Copy application source files
COPY . .

# Build the production Vite bundle into /app/dist
RUN npm run build

# ==========================================
# Stage 2: Production Runtime for Easypanel
# ==========================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy node_modules and built artifacts from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/src/game ./src/game
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Create persistent data directory for Global Leaderboard JSON storage
RUN mkdir -p /app/data && chown -R node:node /app

USER node

EXPOSE 3000

# Optional Docker healthcheck for Easypanel zero-downtime deployments
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

CMD ["npm", "start"]
