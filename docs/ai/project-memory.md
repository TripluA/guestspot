# Project AI Memory

Human-readable OpenMembrain project memory export.

Project: guestspot3
Generated: 2026-08-14T08:10:02.082Z

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

No exportable OpenMembrain memory has been saved yet.

## Memories

### remember: Admin credentials and login model

- The admin superuser (`admin@example.com`) is a `_superusers` record, **not** a `users` record. On `/login` (web/src/pages/LoginPage.tsx) it only works in the **Admin** tab (`pb.collection('_superusers').authWithPassword`). The **Resident** tab authenticates against `users` and requires a registered, admin-approved account.
- Effective admin password resolution: `docker-compose.yml`'s `${PB_ADMIN_PASSWORD:-change-me}` is only a fallback when the variable is unset. A gitignored `.env` always overrides it; `.env.example` values (e.g. `CHANGE_ME_STRONG_PASSWORD`) are literal placeholders, not defaults.
- The pb image entrypoint runs `pocketbase superuser upsert "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASSWORD" --dir=/pb_data` on **every boot**, so editing `.env` + `docker compose up -d` resets the admin password immediately.
- README.md documents all of the above (commit cbd8922); docker-compose.yml and `.env` are intentionally left unchanged.

### gotcha: Credential-mismatch debugging

- If "Sign-in failed. Check your credentials." appears: first check which password path applies (no `.env` → compose fallback; copied `.env.example` → the literal placeholder; existing `.env` → its `PB_ADMIN_PASSWORD`). Verify live via `/api/collections/_superusers/auth-with-password` (200 vs 400).
- `scripts/smoke.sh` defaults to `admin@example.com` / `change-me`; export `PB_ADMIN_EMAIL`/`PB_ADMIN_PASSWORD` from `.env` when it overrides them.
