#!/usr/bin/env bash
# End-to-end smoke test for GuestSpot.
# Expects a running stack (docker compose up) and optionally a `.env` for creds.
set -euo pipefail

BASE="${BASE:-http://localhost:8080}"
ADMIN_EMAIL="${PB_ADMIN_EMAIL:-admin@example.com}"
ADMIN_PASSWORD="${PB_ADMIN_PASSWORD:-change-me}"

PASS=0
FAIL=0

req() { # method url [json-body] [token]
  local method="$1" url="$2" body="${3:-}" token="${4:-}"
  local -a args=(-sS -w $'\n%{http_code}' -X "$method" -H "Content-Type: application/json")
  if [ -n "$token" ]; then args+=(-H "Authorization: ${token}"); fi
  if [ -n "$body" ]; then args+=(-d "$body"); fi
  curl "${args[@]}" "${BASE}${url}"
}

body_of() { # "$response"
  printf '%s' "$1" | sed -n '1p'
}
code_of() { # "$response"
  printf '%s' "$1" | tail -n1
}
json() { # <python-expr-on-d>; reads response JSON from stdin
  python3 -c "
import sys, json
d = json.load(sys.stdin)
print($1)
" 2>/dev/null || true
}
dt() { # hours-from-now -> PB datetime string
  python3 -c "
from datetime import datetime, timedelta, timezone
print((datetime.now(timezone.utc) + timedelta(hours=int('$1'))).strftime('%Y-%m-%d %H:%M:%S.000Z'))
"
}

check() { # description
  if [ "$1" = "1" ]; then
    PASS=$((PASS + 1))
    echo "  ok - $2"
  else
    FAIL=$((FAIL + 1))
    echo "  FAIL - $2"
  fi
}

echo "==> health"
R=$(req GET /api/health)
check "$( [ "$(code_of "$R")" = "200" ] && echo 1 || echo 0 )" "api health returns 200 (got $(code_of "$R"))"

echo "==> admin login"
R=$(req POST /api/collections/_superusers/auth-with-password \
  "{\"identity\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}")
AT=$(body_of "$R" | json "d['token']")
check "$( [ -n "$AT" ] && echo 1 || echo 0 )" "superuser token obtained"

echo "==> collections exist"
R=$(req GET /api/collections?perPage=100 "" "$AT")
for c in users spots availability requests; do
  check "$( body_of "$R" | grep -q "\"name\":\"${c}\"" && echo 1 || echo 0 )" "collection '${c}' exists"
done

echo "==> spots seeded"
R=$(req GET /api/collections/spots/records?perPage=1 "" "$AT")
check "$( [ "$(body_of "$R" | json "d['totalItems']")" = "304" ] && echo 1 || echo 0 )" "304 seeded spots"

echo "==> register two users"
TS=$(date +%s)
U1_EMAIL="alice${TS}@example.com"
U2_EMAIL="bob${TS}@example.com"
R=$(req POST /api/collections/users/records \
  "{\"name\":\"Alice\",\"email\":\"${U1_EMAIL}\",\"password\":\"secret123\",\"passwordConfirm\":\"secret123\",\"building\":\"1\",\"apartment\":\"5\",\"language\":\"en\"}")
U1_ID=$(body_of "$R" | json "d['id']")
check "$( [ -n "$U1_ID" ] && echo 1 || echo 0 )" "alice registered (id=$U1_ID)"

R=$(req POST /api/collections/users/records \
  "{\"name\":\"Bob\",\"email\":\"${U2_EMAIL}\",\"password\":\"secret123\",\"passwordConfirm\":\"secret123\",\"building\":\"2\",\"language\":\"en\"}")
U2_ID=$(body_of "$R" | json "d['id']")
check "$( [ -n "$U2_ID" ] && echo 1 || echo 0 )" "bob registered (id=$U2_ID)"

echo "==> unapproved users cannot log in"
R=$(req POST /api/collections/users/auth-with-password \
  "{\"identity\":\"${U1_EMAIL}\",\"password\":\"secret123\"}")
check "$( [ "$(code_of "$R")" = "403" ] && echo 1 || echo 0 )" "alice login blocked (403, got $(code_of "$R"))"

echo "==> admin approves users"
R=$(req PATCH "/api/collections/users/records/${U1_ID}" '{"approved":true}' "$AT")
check "$( [ "$(code_of "$R")" = "200" ] && echo 1 || echo 0 )" "alice approved"
R=$(req PATCH "/api/collections/users/records/${U2_ID}" '{"approved":true}' "$AT")
check "$( [ "$(code_of "$R")" = "200" ] && echo 1 || echo 0 )" "bob approved"

echo "==> approved users can log in"
R=$(req POST /api/collections/users/auth-with-password \
  "{\"identity\":\"${U1_EMAIL}\",\"password\":\"secret123\"}")
T1=$(body_of "$R" | json "d['token']")
check "$( [ -n "$T1" ] && echo 1 || echo 0 )" "alice token obtained"
R=$(req POST /api/collections/users/auth-with-password \
  "{\"identity\":\"${U2_EMAIL}\",\"password\":\"secret123\"}")
T2=$(body_of "$R" | json "d['token']")
check "$( [ -n "$T2" ] && echo 1 || echo 0 )" "bob token obtained"

echo "==> assign a spot to bob (owner)"
R=$(req GET '/api/collections/spots/records?perPage=1&sort=number' "" "$AT")
SPOT_ID=$(body_of "$R" | json "d['items'][0]['id']")
SPOT_NUM=$(body_of "$R" | json "d['items'][0]['number']")
R=$(req PATCH "/api/collections/spots/records/${SPOT_ID}" "{\"owner\":\"${U2_ID}\"}" "$AT")
check "$( [ "$(code_of "$R")" = "200" ] && echo 1 || echo 0 )" "spot ${SPOT_NUM} assigned to bob"

echo "==> bob declares availability"
echo "    cleaning up stale availability/requests from previous runs"
R=$(req GET '/api/collections/availability/records?perPage=100&sort=-id' "" "$AT")
for ID in $(body_of "$R" | json "' '.join([x['id'] for x in d['items']])"); do
  req DELETE "/api/collections/availability/records/${ID}" "" "$AT" >/dev/null
done
R=$(req GET '/api/collections/requests/records?perPage=100&sort=-id' "" "$AT")
for ID in $(body_of "$R" | json "' '.join([x['id'] for x in d['items']])"); do
  req DELETE "/api/collections/requests/records/${ID}" "" "$AT" >/dev/null
done
FROM1=$(dt 2)
TO1=$(dt 5)
R=$(req POST /api/collections/availability/records \
  "{\"spot\":\"${SPOT_ID}\",\"from\":\"${FROM1}\",\"to\":\"${TO1}\",\"reason\":\"vacation\"}" "$T2")
check "$( [ "$(code_of "$R")" = "200" ] && echo 1 || echo 0 )" "bob creates availability"
check "$( [ "$(body_of "$R" | json "d['status']")" = "available" ] && echo 1 || echo 0 )" "availability status available"

echo "==> alice submits a request inside the window"
FROM2=$(dt 3)
TO2=$(dt 4)
R=$(req POST /api/collections/requests/records \
  "{\"from\":\"${FROM2}\",\"to\":\"${TO2}\",\"guests\":2,\"note\":\"family\"}" "$T1")
REQ1=$(body_of "$R" | json "d['id']")
check "$( [ -n "$REQ1" ] && echo 1 || echo 0 )" "alice request created (id=$REQ1)"

echo "==> bob confirms the request"
R=$(req POST "/api/guestspot/requests/${REQ1}/confirm" "{\"spot\":\"${SPOT_ID}\"}" "$T2")
check "$( [ "$(code_of "$R")" = "200" ] && echo 1 || echo 0 )" "confirm route returns 200"
check "$( [ "$(body_of "$R" | json "d['status']")" = "confirmed" ] && echo 1 || echo 0 )" "request confirmed"

echo "==> overlapping request cannot reuse the same spot"
R=$(req POST /api/collections/requests/records \
  "{\"from\":\"${FROM2}\",\"to\":\"${TO2}\",\"guests\":1}" "$T1")
REQ2=$(body_of "$R" | json "d['id']")
check "$( [ -n "$REQ2" ] && echo 1 || echo 0 )" "second request created"
R=$(req POST "/api/guestspot/requests/${REQ2}/confirm" "{\"spot\":\"${SPOT_ID}\"}" "$T2")
check "$( [ "$(code_of "$R")" = "400" ] && echo 1 || echo 0 )" "conflict rejected (400, got $(code_of "$R"))"

echo "==> spot owner is hidden from non-owners"
R=$(req GET "/api/collections/spots/records/${SPOT_ID}" "" "$T1")
OWNER=$(body_of "$R" | json "d['owner']")
check "$( [ -z "$OWNER" ] && echo 1 || echo 0 )" "alice cannot see spot owner"

echo "==> alice completes the confirmed request"
R=$(req POST "/api/guestspot/requests/${REQ1}/complete" "" "$T1")
check "$( [ "$(code_of "$R")" = "200" ] && echo 1 || echo 0 )" "complete route returns 200"
check "$( [ "$(body_of "$R" | json "d['status']")" = "completed" ] && echo 1 || echo 0 )" "request completed"

echo "==> non-owner cannot confirm"
R=$(req POST "/api/guestspot/requests/${REQ2}/confirm" "{\"spot\":\"${SPOT_ID}\"}" "$T1")
check "$( [ "$(code_of "$R")" = "403" ] && echo 1 || echo 0 )" "alice (not owner) blocked from confirming (403, got $(code_of "$R"))"

echo
echo "smoke: ${PASS} passed, ${FAIL} failed"
[ "${FAIL}" -eq 0 ] || exit 1
