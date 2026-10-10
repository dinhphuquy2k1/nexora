FROM node:24.19.0-bookworm-slim AS tools
WORKDIR /workspace
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN --mount=type=secret,id=build_ca if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi; npm install --global pnpm@10.34.6 && apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates gosu && rm -rf /var/lib/apt/lists/*
COPY --chmod=755 scripts/init-local.sh scripts/api-entrypoint.sh scripts/backup-manifest.mjs /scripts/
FROM scratch AS dependency-cache
FROM tools AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/sdk/package.json packages/sdk/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN --mount=type=secret,id=build_ca --mount=type=bind,from=dependency-cache,target=/dependency-cache if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi; mkdir -p /pnpm/store; if [ -f /dependency-cache/pnpm-cache.tar ]; then tar -xf /dependency-cache/pnpm-cache.tar -C /pnpm/store; fi; pnpm install --frozen-lockfile --store-dir /pnpm/store
FROM deps AS dev
COPY . .
ENTRYPOINT ["sh", "/workspace/scripts/dev-entrypoint.sh"]
FROM deps AS build
COPY . .
ENV API_INTERNAL_URL=http://api:4000
RUN --mount=type=secret,id=build_ca if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi; pnpm build
FROM build AS api-artifacts
RUN --mount=type=secret,id=build_ca if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi; node scripts/runtime-artifacts.mjs apps/api /output && cd /output && rm -rf src test && cd node_modules/@nexora/database && rm -rf src && /workspace/packages/database/node_modules/.bin/prisma generate --schema prisma/schema.prisma
FROM build AS migrate-artifacts
RUN --mount=type=secret,id=build_ca if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi; node scripts/runtime-artifacts.mjs packages/database /migration tooling && cd /migration && rm -rf src && /workspace/packages/database/node_modules/.bin/prisma generate --schema prisma/schema.prisma
FROM tools AS migrate
WORKDIR /app
COPY --from=migrate-artifacts --chown=node:node /migration /app
USER node
CMD ["node", "node_modules/prisma/build/cli.js", "migrate", "deploy", "--schema", "prisma/schema.prisma"]
FROM node:24.19.0-bookworm-slim AS api-runtime
COPY --chmod=755 scripts/api-entrypoint.sh /scripts/api-entrypoint.sh
WORKDIR /app
ENV NODE_ENV=production STORAGE_ROOT=/data/uploads
COPY --from=api-artifacts --chown=node:node /output /app
RUN mkdir -p /data/uploads && chown node:node /data/uploads
USER node
CMD ["node", "dist/main.js"]
FROM build AS web-artifacts
RUN --mount=type=secret,id=build_ca if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi; node scripts/runtime-artifacts.mjs apps/web /output
FROM node:24.19.0-bookworm-slim AS web-runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 API_INTERNAL_URL=http://api:4000
COPY --from=web-artifacts --chown=node:node /output /app
USER node
CMD ["node", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0"]
