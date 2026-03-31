FROM node:20-alpine AS base
WORKDIR /app

# OpenSSL 1.1 necessario para Prisma engine no Alpine
RUN apk add --no-cache openssl1.1-compat

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
FROM node:20-alpine AS production
WORKDIR /app
RUN apk add --no-cache openssl1.1-compat
COPY --from=base /app ./
EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]

# Development (default)
FROM base AS development
EXPOSE 3001
CMD ["npm", "run", "dev", "--workspace=apps/api"]
