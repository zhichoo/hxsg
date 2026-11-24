FROM node:24-slim AS builder
WORKDIR /app
ARG NPM_REGISTRY=https://registry.npmjs.org
ENV COREPACK_NPM_REGISTRY=${NPM_REGISTRY}
ENV npm_config_registry=${NPM_REGISTRY}

RUN corepack enable && corepack prepare pnpm@11.5.2 --activate

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/mapp-sdk packages/mapp-sdk
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/

RUN pnpm install --no-frozen-lockfile

COPY packages/shared packages/shared
COPY apps/server apps/server
COPY apps/web apps/web

RUN pnpm build

FROM node:24-slim AS runner
WORKDIR /app
ARG NPM_REGISTRY=https://registry.npmjs.org
ENV COREPACK_NPM_REGISTRY=${NPM_REGISTRY}
ENV npm_config_registry=${NPM_REGISTRY}
ENV NODE_ENV=production
ENV PORT=3001
ENV HXSG_DATA_DIR=/data

RUN corepack enable && corepack prepare pnpm@11.5.2 --activate

COPY package.json pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/mapp-sdk packages/mapp-sdk
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/

RUN pnpm install --prod --no-frozen-lockfile

COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/apps/server/dist apps/server/dist
COPY --from=builder /app/apps/web/dist apps/web/dist

VOLUME ["/data"]
EXPOSE 3001

CMD ["node", "apps/server/dist/index.js"]
