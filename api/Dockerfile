/// @anchor: Docker — https://docs.docker.com/engine/reference/builder/
/// @anchor: Node.js Docker best practices — https://github.com/nodejs/docker-node
/// Dockerfile pour l'API KontEx (Node.js 22, Express 5, TypeScript strict).
/// Multi-stage build pour minimiser la taille de l'image finale.

# ============================================================
# Stage 1 : Build — Compilation TypeScript → JavaScript
# ============================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copie des fichiers de dépendances en premier (cache Docker)
COPY package.json package-lock.json* ./

# Installation CI (pas d'audit en CI, pas de lockfile modifié)
RUN npm ci --ignore-scripts --no-audit --no-fund

# Copie des sources TypeScript
COPY tsconfig.json ./
COPY src/ ./src/

# Compilation TypeScript → JavaScript
RUN npm run build

# Suppression des devDependencies pour l'image de production
RUN npm prune --omit=dev

# ============================================================
# Stage 2 : Production — Image minimale Node.js
# ============================================================
FROM node:22-alpine AS production

# Sécurité : exécution en tant que non-root
RUN addgroup --system --gid 1001 kontex && \
    adduser --system --uid 1001 --ingroup kontex kontex

WORKDIR /app

# Copie des artefacts depuis le stage builder
COPY --from=builder --chown=kontex:kontex /app/package.json ./
COPY --from=builder --chown=kontex:kontex /app/node_modules/ ./node_modules/
COPY --from=builder --chown=kontex:kontex /app/dist/ ./dist/

# Variables d'environnement par défaut (surchargeables au runtime)
ENV NODE_ENV=production
ENV PORT=3000

# Sécurité : pas d'exécution en root
USER kontex

# Healthcheck intégré
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/health || exit 1

EXPOSE ${PORT}

# Démarrage de l'application
CMD ["node", "--enable-source-maps", "dist/server.js"]
