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

- [x] Fix: admin Settings email-change route (replaced `findFirstRecordByFilter` with `findRecordsByFilter` to avoid 404 on email-change uniqueness check).


One email+password can be BOTH a resident (`users`) and an admin
(`_superusers`) — separate collection records, no cross-collection uniqueness.
The PocketBase SDK keeps a single token, so the frontend caches both sessions
and swaps the active one.

- `web/src/lib/dualAuth.ts` — localStorage store (`guestspot_dual_auth`) with
  `{ email, user:{token,model}, admin:{token,model}, active }`; get/set/clear
  + unit tests.
- `web/src/auth.tsx` — `Session.dual` flag, `switchRole('user'|'admin')`
  (swaps token into `pb.authStore` + best-effort `authRefresh` to rotate the
  cached token), `signOut()` clears the dual store too.
- `web/src/pages/LoginPage.tsx` — probes BOTH roles on a throwaway client
  (`new PocketBase(baseURL, new BaseAuthStore())`) BEFORE touching the main
  `pb.authStore`; if the same credentials authenticate `users` and
  `_superusers` it shows a chooser ("Continue as resident / Continue as admin",
  keys `loginDualTitle`/`loginAsResident`/`loginAsAdmin`). Single-role flows
  unchanged. The probe matters: authenticating roles on the main client races
  the chooser render (the session `onChange` fires across the `await` boundary
  and the login redirect kicks in before `pendingDual` is set).
- `web/src/App.tsx` — `EnsureRole` guard swaps the token per area (admin pages
  run with the superuser token, user pages with the users token, so records are
  never misattributed); `RequireUser`/`RequireAdmin` let `dual` identities into
  both areas.
- `web/src/components/Layout.tsx` — the "Admin" sidebar/bottom-nav link now
  shows for `dual` too (not just `isAdmin`); `AdminLayout`'s "Dashboard" link
  goes back via the guards.

Gotchas / decisions:

- `switchRole` must force-close the realtime SSE stream BEFORE swapping the
  token: `;(pb.realtime as unknown as { disconnect: () => void }).disconnect()`.
  The stream is opened with the previous role's auth and PB rejects it once the
  token changes ("current and previous request authorization don't match"). The
  method is typed `private` in the SDK but is the only way to close the
  EventSource synchronously; `connect()` re-opens it on the next `subscribe()`.
- A single-role resident login logs a harmless 400 on
  `/_superusers/auth-with-password` — that's the probe checking whether the
  email is also an admin. Expected, caught, ignore.
- Resident and admin passwords are SEPARATE hashes: changing the resident
  password (Profile or admin edit) does NOT change the admin password, and vice
  versa. Reconcile via `/admin/settings` (needs the old password) or the
  `.env` upsert on next PB container start (`PB_ADMIN_EMAIL`/`PB_ADMIN_PASSWORD`).
- The login chooser fires only when BOTH collections authenticate with the same
  credentials. A resident-only or admin-only email never sees it.
- The `guestspot_dual_auth` store is only cleared on `signOut`; if the admin
  changes their superuser email in Settings the cached dual session goes stale
  until the next login.

## Fix (2026-08-16) — admin email change without forced password reset

`/admin/settings` previously PATCHed `_superusers` records directly. PB's auth
update form couples `oldPassword` with a mandatory new password (`password` +
`passwordConfirm` are `Required` whenever `oldPassword` is present — see
`forms/record_upsert.go` validateFormFields), so "change email, verified by the
current password, without resetting the password" 400'd with
`password: Cannot be blank. / passwordConfirm: Cannot be blank.`. For
superusers PB also ignores `oldPassword` entirely (manage access skips the
check), so the old gate was fiction anyway.

- New `POST /api/guestspot/admin/settings` route (`pb/pb_hooks/settings.pb.js`,
  guarded `$apis.requireAuth("_superusers")`); logic lives in
  `h.updateAdminSettings(app, record, body)` in `helpers.js` (isolated-executor
  rule). Body `{ name, email, oldPassword?, password?, passwordConfirm? }`.
  - Email/password change => requires + verifies `record.validatePassword(oldPassword)`.
  - New password => confirm match + min 6 chars, `record.setPassword(password)`.
  - Email => uniqueness pre-check (`findFirstRecordByFilter`), `record.setEmail(email)`.
  - Persists via `app.save(record)` (bypasses `onRecord*Request` hooks; nothing
    hooks `_superusers` updates). Errors carry `data.code`
    (`current_password_required`, `current_password_invalid`, `password_mismatch`,
    `password_short`, `email_in_use`) mapped to i18n keys in `SettingsPage.tsx`.
- `SettingsPage.tsx` now calls `pb.send(..., { method: 'POST' })` (SDK `send()`
  defaults to GET), `authRefresh()`es after success so the new name/email show
  immediately, and `clearDualSession()`s on email change (the cached
  resident+admin pairing is keyed by the old email).
- Caveat (pre-existing): the base image upserts the superuser from
  `PB_ADMIN_EMAIL`/`PB_ADMIN_PASSWORD` on every boot — changing the `.env`
  admin's email in Settings is reverted on the next container start unless
  `.env` is updated too. Use a throwaway superuser for E2E of this route.

## Work plan (started 2026-08-18) — foundation, security & UX

### Round 5 — Code quality, security & password reset

- [x] Q1 — ESLint + Prettier: add `eslint` (with `@eslint/js`, `typescript-eslint`,
      `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`) and `prettier`
      to `web/devDependencies`; `eslint.config.js` (flat config), `.prettierrc`
      (matching existing style — single quotes, trailing commas, 100 print
      width). Fix lint errors across `web/src/`. Add `npm run lint` / `npm run
      format` scripts; CI `lint` job runs `npm run lint`.
- [x] Q2 — React Error Boundary: wrap `<AppRoutes>` in a top-level error
      boundary (`web/src/components/ErrorBoundary.tsx`) that shows a friendly
      crash screen with a "Reload" button + the error message in dev mode.
      Also add per-route boundaries around `<Outlet>` in Layout and AdminLayout
      so a page crash doesn't take down the shell.
- [x] Q3 — CSP headers: add `Content-Security-Policy` header in `nginx.conf`
      (`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'`
      — unsafe-inline needed for Tailwind v4; `connect-src 'self' wss: ws:`
      for PB realtime; `img-src 'self' data: blob:` for future spot photos).
      Also add `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`.
- [x] Q4 — Password reset: `POST /api/guestspot/auth/password-reset` (request)
      sends a reset email via PB's built-in `requestPasswordReset`; new
      `PasswordResetPage.tsx` at `/reset-password` with token input + new
      password form. `LoginPage.tsx` gets a "Forgot password?" link.
      Smoke: request reset → follow token → set new password → login.
- [x] Q5 — Email verification on registration: optional env-gated
      (`REQUIRE_EMAIL_VERIFICATION=true`) PB built-in verification flow;
      `RegisterPage.tsx` shows "check your email" screen when enabled; admin
      can still approve after verification. Smoke: register → verify → approve.

### Round 6 — Performance & UX

- [ ] P1 — Pagination on admin pages: `OverviewPage` uses `getList` with
      page-based counts instead of `getFullList`; `AuditPage` paginates with
      load-more; `UsersPage` / `SpotsPage` / admin `RequestsPage` get
      pagination controls. Dashboard resident views already use `getList` with
      load-more — align admin pages.
- [ ] P2 — Debounced search: wrap search inputs in a `useDebouncedValue(value,
      300)` hook (`web/src/lib/useDebounce.ts`) so API calls fire 300ms after
      the user stops typing; apply to all search/filter inputs (requests board,
      admin users/spots/audit/search).
- [ ] P3 — Optimistic updates: for approve/reject on ApprovalsPage, confirm/
      cancel on RequestsPage, read/unread on NotificationBell — apply local
      state optimistically before the API call; rollback on error.
- [ ] P4 — Spot photos: `spots` collection gets a `photo` file field (migration
      `1765500009`); `MySpotsPage` edit modal gains a file upload input (max
      2MB, JPEG/PNG/WebP); `SpotsPage` admin edit also gets it; photos served
      via PB's file API. Spots list/card shows thumbnail when present.
- [ ] P5 — Guest request history: `/app/history` page shows the user's past
      requests (all statuses, newest first) with pagination; add `navHistory`
      nav item + icon (`History` from lucide-react).

### Round 7 — Power features

- [ ] F1 — Calendar view: `/app/calendar` page renders a month-grid showing
      the user's availability windows (green) and requests (blue) as colored
      bars; click a day to see details; navigation arrows for prev/next month.
      Add `navCalendar` nav item (`Calendar` from lucide-react). Uses existing
      `availability` and `requests` data — no new backend needed.
- [ ] F2 — Recurring availability: availability create modal gains a
      "Repeat weekly" checkbox + day-of-week picker (Mon–Sun) + end date;
      backend route `POST /api/guestspot/availability/repeat` in
      `availability.pb.js` that creates N weekly windows atomically; overlap
      check on each.
- [ ] F3 — Bulk admin operations: `UsersPage` gets select-all checkbox +
      per-row checkboxes; bulk actions toolbar (Approve selected, Delete
      selected); `SpotsPage` gets delete-selected; `AdminRequestsPage` gets
      cancel-selected. Each op fires sequentially with error collection.
- [ ] F4 — Building announcements: `announcements` collection (title, body,
      building, createdBy, createdAt); admin `AnnouncementsPage.tsx` at
      `/admin/announcements` with CRUD; resident dashboard shows the latest
      announcement per building as a dismissible banner; in-app notification
      on new announcement.
- [ ] F5 — Push notifications: PWA web-push via PB's `subscriptions`
      collection; `NotificationBell` subscribes to push on mount; browser
      permission prompt; `public/vapid-key.json` endpoint. Requires adding
      `web-push` to the PB image or handling push server-side in a hook.

### Round 8 — PWA & testing

- [ ] W1 — PWA manifest + service worker: `public/manifest.json` with app
      name/icons/scope; register a minimal service worker (`public/sw.js`) that
      does cache-first for static assets and network-first for `/api/`;
      `<meta name="theme-color">` + apple-touch-icon; update
      `index.html` head.
- [ ] W2 — Component tests: add `@testing-library/react` + `@testing-library/
      user-event` devDeps; write tests for Login/Register form validation,
      RequestModal date logic, NotificationBell rendering, StatusBadge colors,
      LangToggle, ThemeToggle. CI `lint` job runs `npm test` (already wired).
- [ ] W3 — Accessibility: audit all interactive elements for keyboard nav,
      focus management (modals trap focus, Escape closes), `aria-label` on
      icon-only buttons, `role` attributes on custom widgets; fix any issues.
- [ ] W4 — Backup docs + optional cron: document `pb_data` backup strategy
      in README (rsync, sqlite3 .backup); add optional `backup.sh` script
      that snapshots `pb_data/` with a timestamp.

### Key conventions / gotchas for this round

- ESLint flat config (`eslint.config.js`) with `@eslint/js` +
  `typescript-eslint` + `eslint-plugin-react-hooks` v5 (uses
  `reactCompiler` setting for React 19); Prettier via `eslint-config-prettier`
  to disable formatting rules that conflict.
- PWA service worker must NOT cache `/api/` responses (PB auth tokens in
  responses; stale data). Use `networkFirst` for API routes and
  `cacheFirst` for static assets only.
- Password reset uses PB's built-in `requestPasswordReset(email)` SDK method
  which sends a verification email with a token; the frontend catches the
  token from the URL query string (`?token=...&passwordResetToken=...`).
- Push notifications require a VAPID key pair; generate with `npx web-push
  generate-vapid-keys` and store the private key as an env var
  (`VAPID_PRIVATE_KEY`), public key embedded in the frontend.

## Verification

After each round: `cd web && npm run build`, `cd web && npm test`,
`cd web && npm run lint`, `node scripts/check-i18n.mjs`,
`node --check pb/pb_hooks/*.js`, then rebuild with
`docker compose -f docker-compose.yml -f docker-compose.ci.yml up -d --build`
and `set -a; source .env; set +a; bash scripts/smoke.sh`.
