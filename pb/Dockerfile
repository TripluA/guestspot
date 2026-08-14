FROM ghcr.io/muchobien/pocketbase:latest

# GuestSpot backend image.
#
# The base image already:
#   - auto-creates/updates the superuser from PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD
#   - serves on 0.0.0.0:8090 with --dir=/pb_data --hooksDir=/pb_hooks
#   - loads JS migrations from /pb_migrations on boot
# This image only bakes in the app schema migrations and JS hooks.

COPY pb_hooks/ /pb_hooks/
COPY pb_migrations/ /pb_migrations/

EXPOSE 8090
