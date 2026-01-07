# PWA Dockerfile - Multi-stage build for Next.js

# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Build-time argument for API URL
# For server-side rewrites (internal Docker network)
ARG API_URL=http://localhost:3000
ENV API_URL=${API_URL}

# For client-side API calls - should be empty to use relative URLs via reverse proxy
# or set to the public API URL if needed
ARG NEXT_PUBLIC_API_URL=
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build the application
RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files (public is optional)
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Create public directory if it doesn't exist
RUN mkdir -p ./public

# Set user
USER nextjs

# Expose port
EXPOSE 3001

# Runtime environment variables
ENV HOSTNAME="0.0.0.0"
ENV PORT=3001

# Start the application
CMD ["node", "server.js"]
