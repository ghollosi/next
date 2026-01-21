# VSys Next - Dockerfile
# Module 1: Core Wash Registration & Wash Ledger
# Version: v0.1.0

FROM node:20-alpine AS base

# Install dependencies for Prisma
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Development stage
FROM base AS development

COPY package*.json ./
RUN npm ci

COPY . .

RUN npx prisma generate --schema=prisma/schema.prisma

CMD ["npm", "run", "start:dev"]

# Build stage
FROM base AS builder

COPY package*.json ./
RUN npm ci

COPY . .

RUN npx prisma generate --schema=prisma/schema.prisma
RUN npm run build

# Production stage
FROM base AS production

ENV NODE_ENV=production

# SECURITY: Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001 -G nodejs

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

# SECURITY: Change ownership and switch to non-root user
RUN chown -R nestjs:nodejs /app
USER nestjs

EXPOSE 3000

CMD ["node", "dist/main.js"]
