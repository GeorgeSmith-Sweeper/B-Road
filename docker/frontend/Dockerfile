# =============================================================================
# B-Road Frontend Dockerfile
# Multi-stage build: deps -> dev / builder -> prod
# =============================================================================

# -----------------------------------------------------------------------------
# Dependencies stage: Install node modules
# -----------------------------------------------------------------------------
FROM node:22-alpine AS deps

WORKDIR /app

# Install dependencies needed for native modules
RUN apk add --no-cache libc6-compat

# Copy package files for dependency installation
COPY frontend/package.json frontend/package-lock.json* ./

# Install dependencies
RUN npm ci

# -----------------------------------------------------------------------------
# Development stage: Hot-reload enabled
# -----------------------------------------------------------------------------
FROM node:22-alpine AS dev

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy package.json for scripts
COPY frontend/package.json ./

# Set development environment
ENV NODE_ENV=development \
    NEXT_TELEMETRY_DISABLED=1

EXPOSE 3000

# Development server with hot-reload
CMD ["npm", "run", "dev"]

# -----------------------------------------------------------------------------
# Builder stage: Build the production application
# -----------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy all source files
COPY frontend/ ./

# Set environment for build
ENV NEXT_TELEMETRY_DISABLED=1

# Build the application
RUN npm run build

# -----------------------------------------------------------------------------
# Production stage: Minimal runtime image
# -----------------------------------------------------------------------------
FROM node:22-alpine AS prod

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Set production environment
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

# Copy standalone build output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000 \
    HOSTNAME="0.0.0.0"

# Production server using standalone output
CMD ["node", "server.js"]
