# Project AI Memory

Human-readable OpenMembrain project memory export.

Project: guestspot
Generated: 2026-08-14T12:20:00.000Z

## Using OpenMemBrain

If OpenMemBrain MCP tools are available in your environment:

- **Session start:** Call `get_project_rules` and `get_relevant_context` to load
  project memory before starting work. Call `list_memory_candidates` to surface
  any pending memories for the developer to approve or reject.
- **During the session:** When you discover durable knowledge (rules, gotchas,
  architecture decisions), call `propose_memory_from_session` right away. Use
  prefixes like `rule:`, `architecture:`, `gotcha:`, `testing:`, `security:`,
  `forbidden:`, `remember:` to help extraction. Don't wait for the session to
  end — propose memories at natural pauses and before ending if you haven't
  already.

The memories below were exported from OpenMemBrain for tools without MCP access.

> Confidential memories are excluded from this static fallback file by default.

## Memories

### remember: Admin credentials and login model

- The admin superuser (`admin@example.com`) is a `_superusers` record, **not** a `users` record. On `/login` (web/src/pages/LoginPage.tsx) it only works in the **Admin** tab (`pb.collection('_superusers').authWithPassword`). The **Resident** tab authenticates against `users` and requires a registered, admin-approved account.
- Effective admin password resolution: `docker-compose.yml`'s `${PB_ADMIN_PASSWORD:-change-me}` is only a fallback when the variable is unset. A gitignored `.env` always overrides it; `.env.example` values (e.g. `CHANGE_ME_STRONG_PASSWORD`) are literal placeholders, not defaults.
- The pb image entrypoint runs `pocketbase superuser upsert "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASSWORD" --dir=/pb_data` on **every boot**, so editing `.env` + `docker compose up -d` resets the admin password immediately.
- README.md documents all of the above (commit cbd8922); docker-compose.yml and `.env` are intentionally left unchanged.

### gotcha: Credential-mismatch debugging

- If "Sign-in failed. Check your credentials." appears: first check which password path applies (no `.env` → compose fallback; copied `.env.example` → the literal placeholder; existing `.env` → its `PB_ADMIN_PASSWORD`). Verify live via `/api/collections/_superusers/auth-with-password` (200 vs 400).
- `scripts/smoke.sh` defaults to `admin@example.com` / `change-me`; export `PB_ADMIN_EMAIL`/`PB_ADMIN_PASSWORD` from `.env` when it overrides them.

### gotcha: PocketBase returns generic "Failed to create record." (400)

- When creating/updating records, PocketBase wraps per-field validation errors: the HTTP 400 body is `{"data":{"<field>":{"code":...,"message":...}},"message":"Failed to create record.","status":400}` and the UI only renders `err.message` (the generic text) unless it inspects the field map.
- KEY SDK GOTCHA: `ClientResponseError.data` is the **entire** response body `{data, message, status}`; the per-field error map lives at `err.data.data` (e.g. `err.data.data.number.message`), **not** `err.data`.
- Real-world cases on `spots`: duplicate number → `validation_not_unique` "Value must be unique." (there is a global unique index on `spots.number`); stale/absent `owner` relation → `validation_missing_rel_records`.
- Fix shipped in commit `2ebfe16`: `web/src/lib/pbError.ts` exports `pbErrorMessage(err, t)` which walks `err.data.data`, localizes field labels, and maps `number`/`validation_not_unique` to i18n key `adminSpotNumberExists`. It is used in `AdminLayout`-managed SpotsPage plus MySpotsPage and RequestsPage modals. SpotsPage `save()` also runs a client-side duplicate pre-check (`spots.some(s => s.number === number && s.id !== form.id)`).
- When surfacing errors anywhere new, prefer `pbErrorMessage` over `err.message`.

### remember: PB data lives in the project folder (bind mount)

- Since commit `0cf1b10`, `docker-compose.yml` bind-mounts `./pb_data:/pb_data` (relative to the compose file) instead of the named volume `pb_data`; the top-level `volumes:` block was removed. PB runtime files (`data.db`, `storage/`, `logs/`) are created inside the project folder, making the stack self-contained when deployed to a VM (copy the whole folder; backup = copy `pb_data/`).
- `.gitignore` and `.dockerignore` already exclude `pb_data/`, so `data.db` is never committed and stays out of the Docker build context.
- The `muchobien/pocketbase` image runs as root, so bind-mounted data files are root-owned on the host; locally you may need `sudo` to edit them. This replaces the old named-volume behavior — old named-volume data is no longer used after the switch.
- `docker-compose.yml` has **no `build:` contexts** — it runs the GHCR images (`ghcr.io/triplua/guestspot-{pb,web}:latest`, or `$GUESTSPOT_TAG`). After a `main` push wait for CI then `docker compose pull && docker compose up -d`. GHCR packages are private, so the host needs `docker login ghcr.io` first.

### remember: Header language toggle shows the current language

- The header toggle (commit `c9f39e2`) shows the **current** language code (EN when the UI is English, RO when Romanian) with a `Globe` icon (lucide-react, `size-4`). It does NOT show the target language.
- Two identical `LangToggle` components exist — `web/src/admin/AdminLayout.tsx` and `web/src/components/Layout.tsx` — keep them in sync when changing the toggle.
