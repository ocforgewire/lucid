FROM oven/bun:1

WORKDIR /app

# Copy all workspace package.jsons + lockfile for install
COPY package.json bun.lock ./
COPY packages/shared/package.json packages/shared/
COPY packages/api/package.json packages/api/
COPY packages/extension/package.json packages/extension/

RUN bun install

# Copy source code
COPY packages/shared/ packages/shared/
COPY packages/api/ packages/api/

EXPOSE 3001

CMD ["bun", "run", "packages/api/src/index.ts"]
