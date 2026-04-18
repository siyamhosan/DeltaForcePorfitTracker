# Delta Force Profit Tracker

A free, open-source companion for tracking profit and stash-related stats in **Delta Force**, with a modern web dashboard, authenticated API, and optional OCR for analyzing stash screenshots.

Authentication is handled by [Clerk](https://clerk.com). The UI uses **React**, **Vite**, **Tailwind CSS**, and **shadcn-style** components from the shared `@workspace/ui` package.

## Repository layout

| Path | Role |
|------|------|
| `apps/web` | Vite + React SPA: landing (Clerk sign-in/up), dashboard (overview, uploads, leaderboard) |
| `apps/api` | **Elysia** (Bun) HTTP API, PostgreSQL via **Drizzle ORM**, Clerk-verified routes under `/v1` |
| `apps/ocr-core` | **FastAPI** + DocTR/PyTorch: `POST /analyze` for image-based stash OCR (internal to deployments) |
| `apps/desktop` | Desktop app workspace (see `apps/desktop`) |
| `packages/domain` | Shared TypeScript types/schemas (e.g. Zod DTOs) |
| `packages/ui` | Shared UI primitives, themes, and styles |
| `docker-compose.yml` | Production-style stack: Postgres, OCR, API, web |

Monorepo tooling: **Bun** workspaces, **Turbo** for scripts.

## Prerequisites

- [Bun](https://bun.sh) (see root `packageManager` in `package.json`)
- For Docker deploy: [Docker](https://docs.docker.com/engine/) with Compose v2

## Local development

Install dependencies at the repo root:

```bash
bun install
```

Run dev servers (Turbo runs configured `dev` tasks across packages):

```bash
bun dev
```

Typical setup:

- Web: Vite dev server (see `apps/web/package.json`).
- API: Bun watch on `apps/api` (set `DATABASE_URL`, `CLERK_SECRET_KEY`, and point `OCR_ANALYZER_URL` at a running OCR service if you use upload analysis).

Shared env patterns live in each app; the API reads `DATABASE_URL`, `CLERK_SECRET_KEY`, `OCR_ANALYZER_URL`, `CORS_ORIGIN`, and `PORT`.

## Production with Docker Compose

Compose project name: **`dfstash`**. Copy `.env.example` to `.env` and adjust values (especially Clerk keys and public URLs).

```bash
cp .env.example .env
mkdir -p data/ocr-cache data/ocr-debug
docker compose up -d --build
```

- **Web** is published on host port `WEB_PORT` (default **35466**), nginx serving the static Vite build.
- **API** is published on `API_PORT` (default **35467**), mapping to port 3000 in the container.
- **Postgres** uses the named volume `postgres_data` (avoids host UID issues with bind mounts).
- **OCR** has **no** published ports; only the API reaches it at `http://ocr:8765` inside the network.

`VITE_API_URL` must be the **browser-visible** API base URL including `/v1` (e.g. `https://your-api.example.com/v1`). `CORS_ORIGIN` should list your web origin (comma-separated if needed).

### Database migrations

After Postgres is healthy:

```bash
docker compose --profile migrate run --rm migrate
```

Or from the repo root:

```bash
bun run compose:migrate
```

This runs Drizzle migrations from `apps/api` using `apps/api/Dockerfile.migrate` (the production API image is a compiled binary and does not include `drizzle-kit`).

### OCR data on disk

- `./data/ocr-cache` → model/Hugging Face cache inside the OCR container.
- `./data/ocr-debug` → optional debug output from stash OCR (`STASH_API_DEBUG`).

If the container cannot write, fix ownership (container user is UID **1000**):  
`sudo chown -R 1000:1000 data/ocr-cache data/ocr-debug`

## Building without Compose

Dockerfiles expect build context at the **repository root**:

```bash
docker build -f apps/web/Dockerfile -t profittracker-web .
docker build -f apps/api/Dockerfile -t profittracker-api .
docker build -f apps/ocr-core/Dockerfile -t profittracker-ocr .
```

Pass `VITE_*` build args for the web image as in `docker-compose.yml`.

## API surface

- Public: `GET /v1/` — service metadata.
- Authenticated routes use Clerk (`Authorization: Bearer <token>`) and live under the versioned API (see `apps/api/src/routes`).

## Tech stack (summary)

- **Frontend:** React 19, React Router, TanStack Query, Clerk React, Vite 7  
- **Backend:** Elysia, Drizzle ORM, `pg`, Clerk backend / `elysia-clerk`  
- **OCR:** FastAPI, Uvicorn, python-doctr, PyTorch (CPU in Docker), OpenCV  

---

This project was initially scoped as a **Delta Force profit tracker** with Clerk auth and a split landing/dashboard experience; the architecture above reflects the current monorepo and deployment shape.
