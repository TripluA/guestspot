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
- Frontend unit tests: `cd web && npm test` (vitest, node env); i18n parity check: `node scripts/check-i18n.mjs`.
- `scripts/smoke.sh` is the E2E gate.

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

## Work plan (started 2026-08-15) — round 4: bugs, hardening & UX

All tasks completed and committed.

- [x] B1 — CRITICAL sweep bug: `runSweep` in `helpers.js` was passing a raw JS
      Date as the `{:now}` filter param; PB serializes JS Dates with a `T` while
      rows store `" "`-separated datetimes, so same-day records matched
      regardless of time. Fixed with `h.pbDateTime(now)` (all three queries).
      Smoke asserts a same-day-future request survives the sweep.
- [x] B2 — Field-forgery guard on request update: `requests.pb.js`
      `onRecordUpdateRequest` forces `requester`/`spot`/`confirmer` back to
      their `prev` values for non-superusers and applies `isFutureEnough` on
      pending edits (window can't be pushed into the past).
- [x] B3 — Availability guards: `availability.pb.js` update hook forces
      `owner` to `auth.id` for non-superusers and rejects reactivating a
      cancelled/expired row (`prevStatus !== 'available' && status === 'available'`).
- [x] O1 — CSV formula-injection: `web/src/lib/csv.ts` now exports a pure
      `csvString()` that prefixes cells starting with `=`, `+`, `-`, `@` with
      `'`; `downloadCSV` uses it.
- [x] O2 — `reg_attempts` pruning: `runSweep` deletes throttle rows older than
      24h (`createdAt < {:cutoff}`, pbDateTime param).
- [x] O3 — Login throttling: `login_attempts` collection (migration
      `1765500008`), `users.pb.js` `onRecordAuthWithPasswordRequest` keyed by
      IP (`h.clientIP`), `LOGIN_MAX_PER_HOUR` env (default 20). Only guards the
      `users` collection, not `_superusers`.
- [x] O4 — `scripts/check-i18n.mjs`: en/ro key parity + `t('...')` usage scan
      (fails on missing/undefined keys, warns on unused). Wired into the CI
      `lint` job. Dead `editUserBuilding` key dropped; `owner` key added.
- [x] O5 — Vitest unit tests for `format.ts`, `pbError.ts`, `csv.ts`
      (`web/src/lib/*.test.ts`, 20 tests). `npm test` script added; `vitest`
      devDependency; `vitest.config.ts` (node env); CI `lint` job runs `npm test`.
- [x] U1 — Toast + confirm-dialog system (`web/src/components/feedback.tsx`:
      `ToastProvider`/`useToast`/`confirmDialog`, dialog rendered as a promise
      via `createRoot`) replacing the 8 `window.confirm`/`window.alert` call
      sites.
- [x] U2 — Requests board building filter (`expand.requester.building`, `all`
      + per-building `Select`) and a live Dashboard subscribing to
      `requests`/`availability`/`spots` with refetch guarded by the existing
      `isRefreshing` ref pattern.
- [x] F1 — Contact sharing on confirm: `GET /api/guestspot/requests/{id}/contact`
      returns host name/spot/building/phone only to requester or confirmer of a
      confirmed request; "Contact host" button in the mine tab (RequestsPage).
      Host phone already added to the confirm email in the same commit.
- [x] F2 — Admin request management: cancel/complete/delete buttons on the
      admin Requests page via direct superuser `update`/`delete`; requester-only
      custom routes untouched. Audit-logged (`request.update`/`request.delete`).
- [x] F3 — In-app notifications: `notifications` collection (recipient, type,
      payload, read, autodate createdAt; migration `1765500008`). `h.notify()`
      fires alongside the emails (confirmed/cancelled/expired/host-removed/
      new-request-for-owner). Bell + dropdown in `Layout.tsx`
      (`NotificationBell.tsx`) subscribing to `notifications`; read via PATCH,
      "Mark all read" button.
- [x] F4 — Reminder emails: cron `guestspot-remind` (hourly) → `h.runReminders`
      sends "guest arrives soon" to requester + host for confirmed requests whose
      `from` is within the next `REMIND_HOURS` (default 12); `reminded` flag on
      `requests` makes duplicates impossible.
- [x] F5 — Audit log: `audit_logs` collection (migration `1765500008`),
      `audit.pb.js` request hooks log superuser spot/user/request CRUD, `h.audit`
      helper (best-effort, never throws), read-only `/admin/audit` page
      (AuditPage.tsx) with filters + CSV export.

New gotchas from this round:

- The isolated-executor rule bites EVERY new hook file, not just once:
  module-scope functions in a `.pb.js` file are invisible to the handler bodies
  (`ReferenceError: foo is not defined`), even when the handler body is a
  one-liner calling a wrapper. The ONLY thing that works inside a handler is
  `require(__hooks + "/helpers.js")` + globals. All shared logic (e.g. audit
  `actorInfo`/`changedFields`, cleanup `cancelConfirmed`) must live in
  `helpers.js` and be invoked as `h.foo(...)`.
- PB relation fields are nulled as part of the referenced record's delete —
  BEFORE `onRecordAfterDeleteSuccess` fires. Cleanup that must find rows by a
  relation (`confirmer = {:id}`, `spot = {:id}`) belongs in
  `onRecordDeleteRequest` (before the delete), or the query silently returns
  nothing and e.g. a confirmed request keeps `spot` set, blocking spot deletion.
- "Something went wrong while processing your request." (400, `{"data":{}}`) is
  PB's catch-all when a hook throws a NATIVE error (ReferenceError, TypeError),
  not a PB typed error. `docker compose logs pb` may show nothing in non-dev
  mode; run a throwaway `pocketbase serve --dev` container against a copy of
  `pb_data` to get the real stack trace.
- `docker compose -f docker-compose.yml -f docker-compose.ci.yml up -d --build`
  failing mid-way (e.g. web TS error) can leave the pb image rebuilt but the
  web image stale (or vice versa). After ANY hook/migration/frontend edit, run
  `docker compose -f docker-compose.yml -f docker-compose.ci.yml build` and
  `up -d` explicitly; verify the container picked up the change (e.g. the audit
  hook's `ReferenceError` only reproduced against the freshly-built image).
- PB record CRUD endpoints are `/api/collections/{collection}/records/{id}` —
  omitting the `records/` segment (e.g. `PATCH /api/collections/requests/{id}`)
  returns a confusing `404 "The requested resource wasn't found."` even though
  GET/POST against the same collection work. All create/list/update/delete
  calls use `/records` (POST `/records` for create, PATCH `/records/{id}`).
- `users.pb.js` blocks approved→pending for ALL callers, superusers included
  ("Approved users cannot be set back to pending.") — an admin cannot
  un-approve a user via the API. Re-approving a user whose `spotNumber` is
  already materialized (their spot survived a previous approve/delete cycle)
  fails with the "spot exists" 400 — clear `spotNumber` first to skip spot
  creation on the pending→approved transition.

Browser-verified against the running stack: admin cancel/complete on
`/admin/requests` (audit-logged as `request.update`), `/admin/audit` renders
with filters + CSV export, notification bell (badge, dropdown, mark-all-read),
Contact-host modal (host name / phone `tel:` link / spot + building), board
building filter (per-requester-building, hides other buildings), and the live
Dashboard picking up a newly-confirmed request without a refresh.

Verification: `cd web && npm run build`, `cd web && npm test`,
`node scripts/check-i18n.mjs`, `node --check pb/pb_hooks/*.js`, then rebuild
with the `-f docker-compose.ci.yml` override and
`set -a; source .env; set +a; bash scripts/smoke.sh` (63 checks pass).
