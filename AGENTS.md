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
- Request-abort fix (2026-08-15) committed: autoCancellation off + nginx proxy.

## Work plan (started 2026-08-15) — admin/self-service features

All tasks completed and committed:

1. **Admin self-service**: `/admin/settings` page + tab; `name` added to
   `_superusers` (migration `1765500002_admin_name.js`); change own
   name/email/password (`oldPassword`+`password`+`passwordConfirm`).
2. **Admin edits users**: Edit modal in `UsersPage.tsx` (name, email, building,
   apartment, phone, language, optional new password). Superuser bypasses the
   users `updateRule`; PB sends verification on email change.
3. **Singular login**: dropped user/admin toggle in `LoginPage.tsx`; tries `users`
   auth first, surfaces "pending admin approval" verbatim, else falls back to
   `_superusers`. `loginAdmin`/`loginUser` keys removed.
4. **Block approved → pending**: `users.pb.js` `onRecordUpdateRequest` throws
   when `prev.approved && !new.approved` (all callers); UI shows Edit+Delete
   only for approved rows (pending rows get Approve+Delete).
5. **Spot claim on registration**: optional `spotNumber`+`spotZone` on `users`
   (migration `1765500003_spot_claim.js`); fields on `RegisterPage.tsx`; on
   admin approval, `onRecordUpdateRequest` atomically creates the `spots`
   record (owner=user) — fails with a clear error if `spots.number` exists, so
   the admin resolves the conflict.

Notes: use `fields.getByName()` in migrations (not `hasFieldWithName`/`list()`),
and `e.app` (not `$app`) inside hooks — the `$app` global lacks
`findRecordsByFilter`/`save` in PB 0.39.

## Work plan (started 2026-08-15) — hardening & UX round

All tasks completed and committed:

- [x] P0 — README: fix stale "Resident/Admin login tab" copy (login is singular now).
- [x] P1 — Remove debug `console.log`s in `RequestsPage.tsx`; align board filter with
      Dashboard (`status = 'pending' || status = 'confirmed'`, not `!= 'cancelled'`).
- [x] P2a — Wire `checkOverlap()` into `availability.pb.js` create+update; force
      `owner = auth.id` on create.
- [x] P2b — Freeze `from`/`to` on confirmed requests (`requests.pb.js` update guard).
- [x] P2c — Rename `cleanup.pb.js.bak` → `cleanup.pb.js`: on user delete clear
      `spots.owner` + cancel requests confirmed by them; on spot delete clear refs
      on non-active requests.
- [x] P2d — Block spot deletion while pending/confirmed requests reference it.
- [x] P3 — `expired` request status (migration `1765500004`) + `cronAdd`
      `guestspot-sweep` (confirmed past `to` → completed; pending past `to` →
      expired + "no host found" email); StatusBadge + i18n key.
- [x] P4 — Email UX: TZ-aware `fmtRange` (container `TZ`), Add-to-Calendar link in
      confirm email.
- [x] P5 — Requests board: "For me" filter toggle + load-more pagination.
- [x] P6 — Admin CSV export (Users/Spots) + expand `scripts/smoke.sh`
      (spot-claim approval, overlap rejected, confirmed-window edit blocked,
      spot-delete guard, user-delete cleanup).

Notes from this round:

- `runSweep` lives in `helpers.js` (handlers/route/cron call `h.runSweep(...)`) —
  PB executes handler bodies in isolated executor VMs where module-scope
  functions from the .pb.js file are NOT visible (`ReferenceError`). The
  `cronAdd` handler takes NO arguments in PB 0.39; `$app` is the executor's
  `core.App` and does have `findRecordsByFilter`/`save`.
- `scripts/smoke.sh` is the E2E gate (59 checks as of round 3); a stale browser
  `pocketbase_auth` localStorage token can be treated as anonymous after a PB
  container rebuild (returns 200-empty lists) — clear it or re-login.

## Work plan (started 2026-08-15) — round 3: bugs + admin requests

- [x] F0 — CRITICAL: frontend custom-route calls send GET, not POST. The PB JS
      SDK's `send()` defaults `method` to GET (`initSendOptions` merges
      `{method:"GET"}`); the custom `routerAdd` routes are POST-only, so
      cancel/complete/confirm all 404 in the browser ("Could not update the
      request."). Fixed `RequestsPage.tsx` (`run` + OfferModal confirm) to pass
      `method: 'POST'`; errors now surface via `pbErrorMessage`.
- [x] F1 — Availability ownership guard: `availability.pb.js` create/update
      hooks now call `h.assertSpotOwner` (loads the spot and requires
      `spot.owner === auth.id`; superusers bypass). Smoke: non-owner create → 403.
- [x] F2 — Admin Requests page: `web/src/admin/RequestsPage.tsx` lists all
      requests with status/building/search filters + CSV export; route
      `/admin/requests` + tab in `AdminLayout.tsx`; i18n keys
      (`adminRequests`, `adminSearchRequests`).
- [x] F4 — Edit pending request: Edit button + modal on the "mine" tab of
      `RequestsPage.tsx` (from/to/guests/note; PATCH while pending). Window
      freeze still only applies once confirmed.
- [x] F6 — `'expired'` added to `RequestStatus` in `types.ts`; `StatusBadge`
      gives expired red (cancelled/completed now gray); `scripts/smoke.sh`
      exercises the admin sweep (past pending → expired, past confirmed →
      completed, past availability → expired) + user-token 403 guard.
- [x] F7 — Registration spam throttle: `reg_attempts` collection
      (`reg_attempts` base collection, NOT auto-dated — see gotchas),
      `users.pb.js` create hook records the client IP and rejects > N
      attempts/hour (env `REG_MAX_PER_HOUR`, default 10). Smoke top-ups rows
      via the admin API then asserts the 403.
- [x] F8 — Availability sweep: `'expired'` added to `availability` status
      (migration `1765500005`), `runSweep` flips `status='available' && to <=
      now` → `expired`; `AvailabilityRow` shows an expired badge (no cancel);
      i18n `spotsStatusExpired`.

New gotchas from this round:

- `e.requestInfo()` in PB 0.39 exposes `headers` with **underscore keys**
  (`x_forwarded_for`, `x_forwarded_proto`) and **no `remoteAddr`**. Values can
  be strings or arrays. Use `h.pbDateTime()` (not JS Dates) as `findRecordsByFilter`
  params when filtering `createdAt`-style fields — a JS Date serializes to ISO
  `"T"` separators while PB stores `" "`-separated datetimes, so string
  comparison makes `>=` filters silently match nothing (`" " < "T"`).
- Base collections in this PB build do NOT auto-add `createdAt`/`updatedAt`;
  define them explicitly as autodate fields (see `reg_attempts` in migration
  `1765500005` / backfill `1765500006`).
- CRITICAL rule semantics: in PB an EMPTY STRING collection rule (`""`) means
  access for EVERYONE (public), NOT superuser-only — only `null` (locked)
  restricts to superusers (superusers bypass rules). Several collections were
  shipped with `""` intending "superuser-only" (spots create/update/delete,
  users.delete, requests.delete, reg_attempts all) = anyone could create/edit/
  delete spots or delete users. Fixed in migration `1765500007`; smoke asserts
  anonymous create/update/delete → 403. Note the JSVM exposes empty rules as
  `null`, so don't value-sniff for `""` in migrations — set the known
  admin-only rules to `null` explicitly.
- The `req` helper in `scripts/smoke.sh` takes exactly `method url [body] [token]`
  — do NOT pass an empty `""` placeholder between body and token (it shifts the
  token to position 5 and silently sends unauthenticated requests).

Notes from this round:

- New helpers in `helpers.js`: `assertSpotOwner` (F1 — loads the spot, requires
  `spot.owner === auth.id`, superuser bypass, throws 403/400) and `pbDateTime`
  (F7 — serializes a JS Date to PB's space-separated datetime format for
  `findRecordsByFilter` params; JS Dates serialize with a "T" and break `>=`).
- `scripts/smoke.sh` now runs 59 checks: the new security assertions create a
  throwaway spot via the admin token so the anon create/update/delete 403
  checks run deterministically even on an empty DB (the throttle test does the
  same via reg_attempts top-up rows, then cleans them).
- F0/F2/F4 were verified in the browser against the running stack: offer→confirm
  and cancel both POST 200 with UI updates; the admin `/admin/requests` page
  renders with search/building/status filters and a working CSV export; the
  Edit modal prefills and PATCHes a pending request.

Decisions: confirm route stays flexible (host may offer a spot without declared
availability — no overlap requirement on confirm). Contact sharing on confirm
(F3) was explicitly skipped this round.

Verification: `cd web && npm run build`, `node --check pb/pb_hooks/*.js`,
rebuild with the `-f docker-compose.ci.yml` override, then
`set -a; source .env; set +a; bash scripts/smoke.sh`.
