# Node 20+: avoid npm ci / engine mismatches (same class of failure as API gateway on node:18).
FROM node:20-alpine AS base

RUN apk add --no-cache dumb-init curl

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001

# Build stage (needs TypeScript)
FROM base AS build

ARG CACHE_BUST=1

# Require lockfile — fail the build if package-lock.json is missing/out of sync.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY tsconfig.json ./
RUN echo "Cache bust value: ${CACHE_BUST}" > /dev/null
COPY src ./src

RUN npm run build
RUN npm prune --omit=dev

# Production stage
FROM base AS production

ENV NODE_ENV=production
ENV PORT=4015
ENV LOG_LEVEL=info
ENV RATE_LIMIT_WINDOW_MS=900000
ENV RATE_LIMIT_MAX_REQUESTS=1000

# Runtime env (set in CapRover / captain-definition):
# - MONGODB_URI
# - MONGODB_DB
# - SERVICE_AUTH_TOKEN
# - PAYMENT_SERVICE_URL
# - CORS_ORIGIN
# - PENDING_REDEMPTION_TTL_MINUTES

COPY --from=build --chown=nodeuser:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nodeuser:nodejs /app/dist ./dist
COPY --from=build --chown=nodeuser:nodejs /app/package.json ./

RUN mkdir -p logs && chown -R nodeuser:nodejs logs

USER nodeuser

EXPOSE 4015

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:4015/api/v1/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
