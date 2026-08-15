# GuestSpot — Agent Instructions

HOA guest parking app. Backend: PocketBase (JS hooks/migrations) in `pb/`.
Frontend: React 19 + Vite + Tailwind v4 in `web/`. Images published to GHCR by
CI on `main` (`ghcr.io/triplua/guestspot-{pb,web}:latest`); `docker-compose.yml`
is pull-only (no `build:` contexts). `docker-compose.ci.yml` re-adds build
contexts for the CI smoke job.

## Commands

- Frontend typecheck/build: `cd web && npm run build` (tsc --noEmit + vite)
- PB hook syntax check: `node --check pb/pb_hooks/*.js`
- Full stack + smoke: `docker compose -f docker-compose.yml -f docker-compose.ci.yml up -d --build && bash scripts/smoke.sh`
- No frontend test suite exists; `scripts/smoke.sh` is the E2E gate.

## Key conventions / gotchas

- PocketBase error body: per-field details live at `err.data.data[field].message`
  (`err.data` is the whole `{data,message,status}` body). Use `pbErrorMessage`
  from `web/src/lib/pbError.ts` to surface errors in the UI.
- `spots.number` is globally unique (index `idx_spots_number`). Duplicate => 400
  "Failed to create record."
- Handlers in `pb/pb_hooks/*.pb.js` are isolated programs: each must
  `require(__hooks + "/helpers.js")` itself (no file-level variables shared).
- `onRecord*Request` hooks fire only for HTTP API requests — custom
  `routerAdd` routes that call `app.save()` bypass them. Keep that in mind when
  adding guards (cancel/confirm/complete rely on the bypass).
- PB datetimes are stored as `"2006-01-02 15:04:05.000Z"`; parse via the
  helpers' `parseDT` / the frontend `fromPbDate` (replace the space with T).
- Two `LangToggle` components exist (`AdminLayout.tsx` + `Layout.tsx`) — keep in
  sync. The toggle shows the CURRENT language + a `Globe` icon.
- Runtime data lives in `./pb_data/` (bind mount; root-owned). `pb/` hooks and
  migrations are baked into the image — editing them requires a CI push + pull.
- Admin creds come from `.env` (PB_ADMIN_EMAIL/PB_ADMIN_PASSWORD); compose
  defaults are only fallbacks.
- `docker compose up -d --build` alone SILENTLY does nothing — `docker-compose.yml`
  is pull-only. Local rebuilds MUST use the `-f docker-compose.ci.yml` override,
  otherwise the running image is stale and frontend/PB changes never deploy
  (detectable via the unchanged Vite asset hash in browser network tab).
- The `web` nginx proxy MUST: set `Host $http_host` (not `$host`, which strips
  the port and breaks PB redirects), keep `absolute_redirect off`, and set
  `proxy_read_timeout 24h` + `proxy_buffering off` so the `/api/realtime` SSE
  stream isn't killed by the 60s default.
- `pb.autoCancellation(false)` is set globally in `web/src/lib/pb.ts` — the JS
  SDK's auto-cancel races against subscription-driven refreshes and aborts
  list/create requests (`ClientResponseError 0`). Keep it disabled; guard
  concurrent refreshes with a ref instead.
- `scripts/smoke.sh` does NOT source `.env` — run with
  `set -a; source .env; set +a` first or admin login falls back to `change-me`.

## Current work plan (started 2026-08-14) — check git log before assuming done

- All tasks from the initial work plan completed:
  - B1 (CI smoke), B2 (Offerable compute), B3 (Guard requests), B4 (Availability verification)
  - R1 (Atomic confirm), R2 (Cleanup hooks), R3 (Error states), R4 (Dockerignore/npm ci)
  - P1 (Unused i18n keys), P2 (Pin PB image), P3 (Register wording)
