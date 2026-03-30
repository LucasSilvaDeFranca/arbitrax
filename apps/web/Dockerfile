FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
COPY apps/web/package.json ./apps/web/
COPY packages/types/package.json ./packages/types/
COPY packages/validators/package.json ./packages/validators/
RUN npm install --workspace=apps/web --include-workspace-root

# Copy source
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

# Build
RUN npm run build --workspace=apps/web

# Production
FROM node:20-alpine AS production
WORKDIR /app
COPY --from=base /app ./
EXPOSE 3000
CMD ["npm", "run", "start", "--workspace=apps/web"]

# Development (default)
FROM base AS development
EXPOSE 3000
CMD ["npm", "run", "dev", "--workspace=apps/web"]
