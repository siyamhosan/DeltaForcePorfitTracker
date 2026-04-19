# Delta Force Profit Tracker

**Free and open source.** A companion app for **Delta Force: Hawk Ops** players who want **stash value**, **profit**, and **performance** tracked over time.

The stack is built around **non-invasive** capture—screenshots plus OCR—rather than reading game memory.

---

## Screenshots

### Web Dashboard
![Web Dashboard](imgs/web.png)

### Desktop Tracker
![Desktop Tracker](imgs/desktop.png)
![Desktop Tracker Idle](imgs/deskstop_idel.png)

---

## Why this project exists

The in-game profile only goes so far. Many players want **longitudinal profit analytics**, **session history**, and **leaderboards** that reflect economic performance—not just one-off match stats. This repo provides a **web app**, **API**, **desktop tracker**, and **optional OCR service** you can run yourself (including via Docker).

---

## What you get today

### Account & experience

- **Sign in / sign up** with [Clerk](https://clerk.com) (social and email flows supported by Clerk’s UI).
- **Landing page** that explains the product: open source, analytics-forward, security-conscious auth.
- **Dashboard** tuned for both desktop and mobile (bottom navigation on small screens, streamlined shell).

### Desktop Tracker (Released!)

- **Native Windows App** for seamless screenshot capturing.
- **Hotkey-triggered capture** to upload stash screenshots without leaving the game.
- Built as a **non-invasive** companion using visual telemetry, complying with anti-cheat protections.

### Stash value from screenshots

- **Upload stash screenshots** (manual upload, drag-and-drop, clipboard, or via the Desktop Tracker): images go to the API, which calls an **external OCR analyzer** (DocTR-based service in `apps/ocr-core`) to read total stash value from the HUD.
- **Preview & confidence**: when the model finds the “total assets” anchor and confidence is high enough, flows can skip redundant confirmation; otherwise you **confirm or correct** the parsed value.
- **Safety checks**: large jumps vs your last known stash can trigger a **warning threshold** before anything is committed—reduces fat-finger and mis-OCR mistakes.
- Values are treated as **millions (M)** in the UI (e.g. `36.4M`); storage uses a compact numeric form where applicable.

### Overview & leaderboards

- **Overview** charts and summaries for your economic trajectory (see app for current metrics).
- **Leaderboards** to compare progress with the community (implementation evolves with the backend).

### Operations & trust

- **API** with authenticated routes (`/v1/...`), CORS-aware for your deployed web origin.
- **PostgreSQL** for durable session/upload/leaderboard data (Drizzle migrations).
- **Production Docker Compose** stack: Postgres, API, static web, and OCR **only on the internal network** (not exposed publicly by default).

---

## Roadmap & upcoming plans

These items come from project planning—**not all are implemented yet**. They guide contributions and issues.

### Session system (core gameplay loop)

The intended model (still being refined in code):

- **Idle / neutral**: no active session until you act or after a period of inactivity.
- **Start on upload**: first stash screenshot of a run **opens a session** using that stash value as a baseline, while **closing out** the previous session’s final stash delta in the background.
- **During a session**: further uploads track **profit or loss** from that baseline as you raid.
- **End anytime**: user ends the session explicitly; track **duration**, **session profit**, **totals**, and rollups for history.

### Deeper analytics

- Richer **raid/session profitability** modeling (extracted value, consumables, insurance, loadout replacement costs) for extraction modes.
- **Warfare / non-extraction** style metrics where relevant (e.g. combat efficiency), distinct from pure stash economics.

### Capture & platforms

- **Resolution-robust OCR**: crop/normalize pipelines that behave across aspect ratios (PC vs mobile screenshots).

### Community & streaming (longer horizon)

- **Global and scoped leaderboards** with fair-play considerations (e.g. bot-heavy matches skewing stats—documented as a design concern).
- **Streamer-friendly hooks**: live overlays and real-time updates (e.g. WebSocket-friendly, self-hosted where possible).
- **Community challenges** or private leaderboards for groups/clans.

### Data & ecosystem

- Optional integration with **community or regional APIs** for item pricing and metadata where legal and ToS allow, with clear user trust and consent.

---

## For developers

Monorepo: **Bun** + **Turbo**; web **Vite/React**, API **Elysia** on Bun, DB **PostgreSQL** + **Drizzle**, OCR **FastAPI** + DocTR, Desktop **Tauri/React**.

| Path | Role |
|------|------|
| `apps/web` | SPA: landing, dashboard (overview, uploads, leaderboard) |
| `apps/api` | HTTP API under `/v1`, Clerk, uploads + app routes |
| `apps/ocr-core` | `POST /analyze` for stash images (CPU Docker image) |
| `apps/desktop` | Desktop client workspace (Tauri app) |
| `packages/domain` | Shared schemas/types |
| `packages/ui` | Shared UI components & theme |

### Prerequisites

- [Bun](https://bun.sh) (see root `package.json`)
- Docker + Compose v2 for containerized deploy
- [Rust](https://www.rust-lang.org/) & [Tauri CLI](https://tauri.app/) (for desktop development)

### Local dev

```bash
bun install
bun dev
```

Configure `DATABASE_URL`, `CLERK_SECRET_KEY`, and `OCR_ANALYZER_URL` for the API when testing uploads.

### Desktop dev

```bash
cd apps/desktop
bun tauri dev
```

### Production (Docker Compose)

```bash
cp .env.example .env
mkdir -p data/ocr-cache data/ocr-debug
docker compose up -d --build
```

- Published ports: `WEB_PORT` (default **35466**), `API_PORT` (default **35467**).
- Postgres uses the `postgres_data` **named volume** (avoids bind-mount UID issues).
- OCR is internal-only; API calls it at `http://ocr:8765` inside the compose network.

**Migrations** (after Postgres is healthy):

```bash
docker compose --profile migrate run --rm migrate
# or
bun run compose:migrate
```

### Build images without Compose

```bash
docker build -f apps/web/Dockerfile -t profittracker-web .
docker build -f apps/api/Dockerfile -t profittracker-api .
docker build -f apps/ocr-core/Dockerfile -t profittracker-ocr .
```

### API surface (short)

- `GET /v1/` — public service metadata.
- Authenticated routes under `/v1/app/...` with `Authorization: Bearer <Clerk token>`.

### Tech stack summary

- **Frontend:** React 19, React Router, TanStack Query, Clerk React, Vite 7, Tailwind/shadcn-style UI.
- **Desktop:** Tauri (Rust), React 19, Vite.
- **Backend:** Elysia, Drizzle, `pg`, Clerk.
- **OCR:** FastAPI, Uvicorn, python-doctr, PyTorch (CPU in Docker), OpenCV.

---

Contributions welcome: issues and PRs for roadmap items, UX around uploads/sessions, and docs. Licensed as open source once a `LICENSE` file is added to the repo.
