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

## Current work plan (started 2026-08-14) — check git log before assuming done

If any of these show no corresponding commit, they are still open:

- B1: CI smoke broken after build-context removal — must use the
  `docker-compose.ci.yml` override in `.github/workflows/ci.yml:47`.
- B2: "Offer spot" button never renders — `offerable` in
  `web/src/pages/RequestsPage.tsx` is gated on `offering` (always empty until
  the button is clicked). Compute offerable per request.
- B3: requester can PATCH `from/to/spot/confirmer` on own requests —
  `pb/pb_hooks/requests.pb.js` update hook only guards `status`.
- B4: availability update doesn't re-verify spot ownership —
  `pb/pb_hooks/availability.pb.js` update hook.
- R1: confirm route is not atomic (check-then-save) — wrap in
  `e.app.runInTransaction`.
- R2: dangling refs on delete — add cleanup hook: user delete clears
  `spots.owner` + `requests.confirmer`; spot delete clears `requests.spot`.
- R3: no error states on page loads (Overview/Approvals/Users/Spots) —
  infinite Spinner on PB failure.
- R4: `web/.dockerignore` missing; `npm ci || npm install` should be `npm ci`.
- P1: 16 unused i18n keys in en.ts/ro.ts.
- P2: pin `ghcr.io/muchobien/pocketbase` to `0.39.10` (not `latest`).
- P3: `registerLogin` wording ("Already have an account? Sign in").
