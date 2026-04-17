# Build from repository root:
#   docker build -f apps/api/Dockerfile -t porfittracker-api:latest .

FROM oven/bun:1 AS build

WORKDIR /app

COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY apps/desktop/package.json ./apps/desktop/
COPY packages/domain/package.json ./packages/domain/
COPY packages/ui/package.json ./packages/ui/

RUN bun install --frozen-lockfile

COPY packages/domain ./packages/domain
COPY apps/api ./apps/api

ENV NODE_ENV=production

WORKDIR /app/apps/api

# https://elysiajs.com/patterns/deploy — compile to a single binary (no Bun runtime in final image)
RUN bun build \
	--compile \
	--minify-whitespace \
	--minify-syntax \
	--target bun \
	--outfile server \
	src/index.ts

FROM gcr.io/distroless/base-debian12

WORKDIR /app

COPY --from=build /app/apps/api/server ./server

ENV NODE_ENV=production

CMD ["./server"]

EXPOSE 3000
