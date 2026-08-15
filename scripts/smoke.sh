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
    echo "  FAIL - $2. Response: $(body_of "$R") (Code: $(code_of "$R"))"
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

echo "==> spots collection queryable"
R=$(req GET '/api/collections/spots/records?perPage=1' "" "$AT")
check "$( [ "$(body_of "$R" | json "d['totalItems']")" -ge 0 ] 2>/dev/null && echo 1 || echo 0 )" "spots collection queryable"

echo "==> admin-only collections are locked (empty-string rules are public in PB!)"
R=$(req POST /api/collections/spots/records '{"number":"ANON-1","building":"1","enabled":true}')
check "$( [ "$(code_of "$R")" = "403" ] && echo 1 || echo 0 )" "anonymous spot create blocked (403, got $(code_of "$R"))"
R=$(req POST /api/collections/spots/records '{"number":"LOCK-1","building":"1","enabled":true}' "$AT")
LOCK_SPOT_ID=$(body_of "$R" | json "d['id']")
check "$( [ -n "$LOCK_SPOT_ID" ] && echo 1 || echo 0 )" "admin creates a throwaway spot (id=$LOCK_SPOT_ID)"
if [ -n "$LOCK_SPOT_ID" ]; then
  R=$(req PATCH "/api/collections/spots/records/${LOCK_SPOT_ID}" '{"notes":"pwned"}')
  check "$( [ "$(code_of "$R")" = "403" ] && echo 1 || echo 0 )" "anonymous spot update blocked (403, got $(code_of "$R"))"
  R=$(req DELETE "/api/collections/spots/records/${LOCK_SPOT_ID}")
  check "$( [ "$(code_of "$R")" = "403" ] && echo 1 || echo 0 )" "anonymous spot delete blocked (403, got $(code_of "$R"))"
  req DELETE "/api/collections/spots/records/${LOCK_SPOT_ID}" "" "$AT" >/dev/null
fi
DEL_EMAIL="delme$(date +%s)@example.com"
R=$(req POST /api/collections/users/records \
  "{\"name\":\"DelMe\",\"email\":\"${DEL_EMAIL}\",\"password\":\"secret123\",\"passwordConfirm\":\"secret123\",\"building\":\"1\",\"language\":\"en\"}" "$AT")
DEL_USER_ID=$(body_of "$R" | json "d['id']")
if [ -n "$DEL_USER_ID" ]; then
  R=$(req DELETE "/api/collections/users/records/${DEL_USER_ID}")
  check "$( [ "$(code_of "$R")" = "403" ] && echo 1 || echo 0 )" "anonymous user delete blocked (403, got $(code_of "$R"))"
  req DELETE "/api/collections/users/records/${DEL_USER_ID}" "" "$AT" >/dev/null
fi
R=$(req GET '/api/collections/reg_attempts/records?perPage=1')
check "$( [ "$(code_of "$R")" = "403" ] && echo 1 || echo 0 )" "anonymous reg_attempts read blocked (403, got $(code_of "$R"))"

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

echo "==> create a spot and assign it to bob (owner)"
SPOT_NUM="9$(date +%s | tail -c 6)"
R=$(req POST /api/collections/spots/records \
  "{\"number\":\"${SPOT_NUM}\",\"building\":\"1\",\"zone\":\"Smoke\",\"enabled\":true}" "$AT")
SPOT_ID=$(body_of "$R" | json "d['id']")
echo "DEBUG: SPOT_ID=${SPOT_ID}"
check "$( [ -n "$SPOT_ID" ] && echo 1 || echo 0 )" "spot ${SPOT_NUM} created"
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
  "{\"spot\":\"${SPOT_ID}\",\"from\":\"${FROM1}\",\"to\":\"${TO1}\",\"reason\":\"vacation\",\"owner\":\"${U2_ID}\",\"status\":\"available\"}" "$T2")
check "$( [ "$(code_of "$R")" = "200" ] && echo 1 || echo 0 )" "bob creates availability"
check "$( [ "$(body_of "$R" | json "d['status']")" = "available" ] && echo 1 || echo 0 )" "availability status available"
check "$( [ "$(body_of "$R" | json "d['owner']")" = "$U2_ID" ] && echo 1 || echo 0 )" "availability owner forced to bob"

echo "==> non-owner cannot attach availability to someone else's spot"
R=$(req POST /api/collections/availability/records \
  "{\"spot\":\"${SPOT_ID}\",\"from\":\"${FROM1}\",\"to\":\"${TO1}\",\"status\":\"available\"}" "$T1")
check "$( [ "$(code_of "$R")" = "403" ] && echo 1 || echo 0 )" "alice (not owner) blocked from creating availability (403, got $(code_of "$R"))"

echo "==> alice submits a request inside the window"
FROM2=$(dt 3)
TO2=$(dt 4)
R=$(req POST /api/collections/requests/records \
  "{\"from\":\"${FROM2}\",\"to\":\"${TO2}\",\"guests\":2,\"note\":\"family\",\"requester\":\"${U1_ID}\",\"status\":\"pending\"}" "$T1")
REQ1=$(body_of "$R" | json "d['id']")
check "$( [ -n "$REQ1" ] && echo 1 || echo 0 )" "alice request created (id=$REQ1)"

echo "==> bob confirms the request"
R=$(req POST "/api/guestspot/requests/${REQ1}/confirm" "{\"spot\":\"${SPOT_ID}\"}" "$T2")
check "$( [ "$(code_of "$R")" = "200" ] && echo 1 || echo 0 )" "confirm route returns 200"
check "$( [ "$(body_of "$R" | json "d['status']")" = "confirmed" ] && echo 1 || echo 0 )" "request confirmed"

echo "==> confirmed request window is frozen"
R=$(req PATCH "/api/collections/requests/records/${REQ1}" "{\"to\":\"$(dt 6)\"}" "$T1")
check "$( [ "$(code_of "$R")" = "400" ] && echo 1 || echo 0 )" "requester cannot move confirmed window (400, got $(code_of "$R"))"

echo "==> spot cannot be deleted while a confirmed request references it"
R=$(req DELETE "/api/collections/spots/records/${SPOT_ID}" "" "$AT")
check "$( [ "$(code_of "$R")" = "400" ] && echo 1 || echo 0 )" "spot delete blocked (400, got $(code_of "$R"))"

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

echo "==> overlapping availability is rejected"
R=$(req POST /api/collections/availability/records \
  "{\"spot\":\"${SPOT_ID}\",\"from\":\"${FROM2}\",\"to\":\"${TO2}\",\"status\":\"available\"}" "$T2")
check "$( [ "$(code_of "$R")" = "400" ] && echo 1 || echo 0 )" "overlapping availability rejected (400, got $(code_of "$R"))"

echo "==> spot claim on registration"
U3_EMAIL="carol${TS}@example.com"
SPOT_CLAIM="8$(date +%s | tail -c 5)"
R=$(req POST /api/collections/users/records \
  "{\"name\":\"Carol\",\"email\":\"${U3_EMAIL}\",\"password\":\"secret123\",\"passwordConfirm\":\"secret123\",\"building\":\"3\",\"language\":\"en\",\"spotNumber\":\"${SPOT_CLAIM}\",\"spotZone\":\"ZoneA\"}")
U3_ID=$(body_of "$R" | json "d['id']")
check "$( [ -n "$U3_ID" ] && echo 1 || echo 0 )" "carol registered with spot claim (id=$U3_ID)"
R=$(req PATCH "/api/collections/users/records/${U3_ID}" '{"approved":true}' "$AT")
check "$( [ "$(code_of "$R")" = "200" ] && echo 1 || echo 0 )" "carol approved"
R=$(req GET "/api/collections/spots/records?perPage=100&filter=number%3D%22${SPOT_CLAIM}%22" "" "$AT")
CLAIM_SPOT_ID=$(body_of "$R" | json "d['items'][0]['id'] if d['items'] else ''")
check "$( [ -n "$CLAIM_SPOT_ID" ] && echo 1 || echo 0 )" "claimed spot ${SPOT_CLAIM} created on approval"
check "$( [ "$(body_of "$R" | json "d['items'][0]['owner'] if d['items'] else ''")" = "$U3_ID" ] && echo 1 || echo 0 )" "claimed spot owned by carol"

echo "==> admin requests sweep (expired / completed)"
R=$(req POST /api/collections/requests/records \
  "{\"from\":\"${FROM2}\",\"to\":\"${TO2}\",\"guests\":1}" "$T1")
REQ_P=$(body_of "$R" | json "d['id']")
check "$( [ -n "$REQ_P" ] && echo 1 || echo 0 )" "sweep pending request created (id=$REQ_P)"
R=$(req PATCH "/api/collections/requests/records/${REQ_P}" "{\"from\":\"$(dt -3)\",\"to\":\"$(dt -1)\"}" "$AT")
check "$( [ "$(code_of "$R")" = "200" ] && echo 1 || echo 0 )" "admin moved pending request window into the past"

R=$(req POST /api/collections/requests/records \
  "{\"from\":\"${FROM2}\",\"to\":\"${TO2}\",\"guests\":1}" "$T1")
REQ_PC=$(body_of "$R" | json "d['id']")
check "$( [ -n "$REQ_PC" ] && echo 1 || echo 0 )" "sweep confirm request created (id=$REQ_PC)"
R=$(req PATCH "/api/collections/requests/records/${REQ_PC}" "{\"from\":\"$(dt -3)\",\"to\":\"$(dt -1)\"}" "$AT")
check "$( [ "$(code_of "$R")" = "200" ] && echo 1 || echo 0 )" "admin moved confirm request window into the past"
R=$(req POST "/api/guestspot/requests/${REQ_PC}/confirm" "{\"spot\":\"${SPOT_ID}\"}" "$T2")
check "$( [ "$(body_of "$R" | json "d['status']")" = "confirmed" ] && echo 1 || echo 0 )" "past-window request confirmed"

R=$(req POST /api/collections/availability/records \
  "{\"spot\":\"${SPOT_ID}\",\"from\":\"$(dt -4)\",\"to\":\"$(dt -2)\",\"status\":\"available\"}" "$T2")
AVAIL_PAST=$(body_of "$R" | json "d['id']")
check "$( [ -n "$AVAIL_PAST" ] && echo 1 || echo 0 )" "past availability created (id=$AVAIL_PAST)"

R=$(req POST "/api/guestspot/admin/sweep" "" "$T1")
check "$( [ "$(code_of "$R")" = "403" ] && echo 1 || echo 0 )" "user token cannot trigger sweep (403, got $(code_of "$R"))"
R=$(req POST "/api/guestspot/admin/sweep" "" "$AT")
check "$( [ "$(code_of "$R")" = "200" ] && echo 1 || echo 0 )" "admin sweep returns 200"
R=$(req GET "/api/collections/requests/records/${REQ_P}" "" "$T1")
check "$( [ "$(body_of "$R" | json "d['status']")" = "expired" ] && echo 1 || echo 0 )" "past pending request expired"
R=$(req GET "/api/collections/requests/records/${REQ_PC}" "" "$T1")
check "$( [ "$(body_of "$R" | json "d['status']")" = "completed" ] && echo 1 || echo 0 )" "past confirmed request completed"
R=$(req GET "/api/collections/availability/records/${AVAIL_PAST}" "" "$AT")
check "$( [ "$(body_of "$R" | json "d['status']")" = "expired" ] && echo 1 || echo 0 )" "past availability window expired"

echo "==> registration spam throttle"
R=$(req GET '/api/collections/reg_attempts/records?perPage=100' "" "$AT")
THROTTLE_IP=$(body_of "$R" | json "d['items'][0]['ip'] if d['items'] else ''")
check "$( [ -n "$THROTTLE_IP" ] && echo 1 || echo 0 )" "registration attempts recorded (ip=$THROTTLE_IP)"
if [ -n "$THROTTLE_IP" ]; then
  COUNT=$(body_of "$R" | json "sum(1 for x in d['items'] if x['ip'] == '${THROTTLE_IP}')")
  NEED=$((10 - COUNT))
  for i in $(seq 1 $NEED); do
    req POST /api/collections/reg_attempts/records "{\"ip\":\"${THROTTLE_IP}\"}" "$AT" >/dev/null
  done
  R=$(req POST /api/collections/users/records \
    "{\"name\":\"Throttled\",\"email\":\"throttled${TS}@example.com\",\"password\":\"secret123\",\"passwordConfirm\":\"secret123\",\"building\":\"4\",\"language\":\"en\"}")
  check "$( [ "$(code_of "$R")" = "403" ] && echo 1 || echo 0 )" "over-limit registration rejected (403, got $(code_of "$R"))"
fi
R=$(req GET '/api/collections/reg_attempts/records?perPage=100' "" "$AT")
for ID in $(body_of "$R" | json "' '.join([x['id'] for x in d['items']])"); do
  req DELETE "/api/collections/reg_attempts/records/${ID}" "" "$AT" >/dev/null
done
echo "    cleaned up reg_attempts rows"

echo "==> deleting a user detaches their spots"
R=$(req DELETE "/api/collections/users/records/${U2_ID}" "" "$AT")
check "$( [ "$(code_of "$R")" = "204" ] && echo 1 || echo 0 )" "bob deleted"
R=$(req GET "/api/collections/spots/records/${SPOT_ID}" "" "$AT")
check "$( [ -z "$(body_of "$R" | json "d['owner']")" ] && echo 1 || echo 0 )" "bob's spot detached on user delete"

echo "==> cleanup"
R=$(req DELETE "/api/collections/spots/records/${CLAIM_SPOT_ID}" "" "$AT")
check "$( [ "$(code_of "$R")" = "204" ] && echo 1 || echo 0 )" "claim spot ${SPOT_CLAIM} removed"
R=$(req DELETE "/api/collections/spots/records/${SPOT_ID}" "" "$AT")
check "$( [ "$(code_of "$R")" = "204" ] && echo 1 || echo 0 )" "test spot ${SPOT_NUM} removed"

echo
echo "smoke: ${PASS} passed, ${FAIL} failed"
[ "${FAIL}" -eq 0 ] || exit 1
