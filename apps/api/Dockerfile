FROM node:20-slim AS base
WORKDIR /app

# OpenSSL necessario para Prisma engine
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/
COPY packages/validators/package.json ./packages/validators/
RUN npm install --workspace=apps/api --include-workspace-root

# Copy source
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Generate Prisma client
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma

# Build
RUN npm run build --workspace=apps/api

# Production
FROM node:20-slim AS production
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY --from=base /app ./
EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]

# Development (default)
FROM base AS development
EXPOSE 3001
CMD ["npm", "run", "dev", "--workspace=apps/api"]
