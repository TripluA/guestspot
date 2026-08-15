# GuestSpot

Self-hosted guest parking for HOAs (Homeowner Associations). Neighbours request a free parking spot, spot owners offer theirs, and the association admin approves who can use the system.

- **Backend**: [PocketBase](https://pocketbase.io) (self-hosted, SQLite) with JS hooks & migrations — custom approval flow, availability windows, and transactional emails.
- **Frontend**: React + Vite + TypeScript + Tailwind CSS v4, served by nginx that proxies API calls to PocketBase. EN/RO, light/dark theme, mobile-first.
- **Distribution**: both components ship as Docker images on GHCR (`ghcr.io/triplua/guestspot-pb`, `ghcr.io/triplua/guestspot-web`), built and pushed by GitHub Actions on `main`.

## Quick start

```bash
docker compose up -d
```

Then open `http://localhost:8080` (port configurable via `WEB_PORT`).

> The stack runs the images published to GHCR by CI on `main`. On a fresh host run `docker compose pull` first (or set `GUESTSPOT_TAG` to a `v*` release). If the GHCR packages are private, log in once: `docker login ghcr.io`.

On every boot the backend creates/updates an admin superuser from `PB_ADMIN_EMAIL` / `PB_ADMIN_PASSWORD`. If a `.env` file exists, its values override the compose defaults — sign in with **those** values. There is a single login form at `/login`: it tries resident credentials first, then falls back to the admin superuser. The admin panel also lives at `/_/` (or browse to `/admin` after signing in as admin).

> Residents register themselves and an admin approves them; approved residents sign in on the same `/login` page.

## Configuration

Copy `.env.example` to `.env` and adjust. Placeholder values like `CHANGE_ME_STRONG_PASSWORD` are examples, not defaults — always set a real password. All variables have safe inline defaults in `docker-compose.yml`:

| Variable | Purpose | Default |
|---|---|---|
| `PB_ADMIN_EMAIL` / `PB_ADMIN_PASSWORD` | Admin superuser, created/updated on every boot | `admin@example.com` / `change-me` (fallback when unset; a `.env` file always overrides) |
| `PUBLIC_URL` | Public app URL, used in email links | `http://localhost:8080` |
| `MAIL_FROM` / `MAIL_SENDER_NAME` | Sender for notification emails | `GuestSpot <noreply@example.com>` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_TLS` / `SMTP_AUTH_METHOD` | SMTP for transactional emails (empty host disables email) | empty / `587` / `false` / `PLAIN` |
| `ADMIN_NOTIFY_EMAILS` | Comma-separated recipients notified on new registrations | empty |
| `WEB_PORT` | Host port for the web UI | `8080` |
| `GUESTSPOT_TAG` | Image tag to pull/run | `latest` |

`docker compose pull` pulls the published images — the compose file has no local build contexts; images are built and pushed by CI on `main`.

To change the admin password, edit `PB_ADMIN_PASSWORD` in `.env` and run `docker compose up -d` — the superuser is upserted on every boot, so the new password applies immediately.

## Workflows

- **Guests (owners without a free spot)** register and, when a guest arrives, submit a request for a date/time window.
- **Owners** can declare **availability windows** for their spot(s) (e.g. while on vacation).
- When a request is submitted, owners whose availability overlaps get an email and can offer their spot. The first confirm wins; overlapping/conflicted spots are rejected.
- Requests can be cancelled (by the requester) or marked **completed** once the visit is over.
- **Only registrations** are approved by the admin — spot requests are never gated by an admin.

## Development

```bash
# Backend only (needs a Go-free runtime? no — uses the prebuilt image):
docker compose up -d pb

# Frontend dev server (proxies /api and /_ to the local pb container):
cd web && npm install && npm run dev
```

The PocketBase hooks/migrations live in `pb/pb_hooks` and `pb/pb_migrations` and are loaded automatically by the base image on boot.

## Testing

`scripts/smoke.sh` runs an end-to-end check against a running stack: health, admin login, collections, spot creation, registration → approval → login flow, request/confirm/conflict/complete flows. It defaults to `admin@example.com` / `change-me`; export `PB_ADMIN_EMAIL` / `PB_ADMIN_PASSWORD` from your `.env` if you override them there.

## Project layout

```
pb/                  PocketBase image (hooks, migrations, Dockerfile)
web/                 React frontend (source + nginx Dockerfile)
scripts/smoke.sh     End-to-end smoke test
.github/workflows/   CI: typecheck/lint + build & push GHCR images
docker-compose.yml   Single-command local deploy
```
