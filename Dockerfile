FROM oven/bun:1 AS builder

WORKDIR /app

COPY package.json bun.lock* ./
COPY packages/shared/package.json packages/shared/
COPY packages/api/package.json packages/api/

RUN bun install --frozen-lockfile

COPY packages/shared/ packages/shared/
COPY packages/api/ packages/api/

RUN cd packages/api && bun build src/index.ts --outdir dist --target bun

FROM oven/bun:1-slim

WORKDIR /app

COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/packages packages
COPY --from=builder /app/package.json package.json

EXPOSE 3001

CMD ["bun", "packages/api/dist/index.js"]
