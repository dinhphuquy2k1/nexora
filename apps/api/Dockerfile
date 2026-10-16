FROM base AS build
COPY . .
ENV API_INTERNAL_URL=http://api:4000
RUN --mount=type=secret,id=build_ca \
    if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi; \
    pnpm --filter @nexora/api... build

FROM build AS api-artifacts
RUN --mount=type=secret,id=build_ca \
    if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi; \
    node scripts/runtime-artifacts.mjs apps/api /output && \
    cd /output && rm -rf src test && \
    cd node_modules/@nexora/database && rm -rf src && \
    /workspace/packages/database/node_modules/.bin/prisma generate --schema prisma/schema.prisma

FROM build AS migrate-artifacts
RUN --mount=type=secret,id=build_ca \
    if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi; \
    node scripts/runtime-artifacts.mjs packages/database /migration tooling && \
    cd /migration && rm -rf src && \
    /workspace/packages/database/node_modules/.bin/prisma generate --schema prisma/schema.prisma

COPY packages/database/scripts/provision-runtime.mjs /migration/scripts/provision-runtime.mjs

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
