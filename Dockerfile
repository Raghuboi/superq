# syntax=docker/dockerfile:1

# ============== Base ==============
FROM node:25-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

# ============== Dependencies ==============
FROM base AS deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --include=dev

# ============== Production Dependencies ==============
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

# ============== Build ==============
FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ============== Development ==============
FROM deps AS development
ENV NODE_ENV=development
COPY tsconfig.json ./
COPY src ./src
COPY __tests__ ./__tests__
USER node
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ============== Production ==============
FROM node:25-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy only what's needed
COPY --from=prod-deps --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=build --chown=appuser:appgroup /app/dist ./dist
COPY --chown=appuser:appgroup package.json ./

USER appuser
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r => r.ok ? process.exit(0) : process.exit(1))"

CMD ["node", "dist/src/index.js"]
