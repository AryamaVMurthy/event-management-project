#!/bin/bash

set -u

BASE_URL="${BASE_URL:-http://localhost:5000/api}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../../.env"

ADMIN_COOKIE="$SCRIPT_DIR/.adv01_admin_cookie.txt"
ORGANIZER_COOKIE="$SCRIPT_DIR/.adv01_organizer_cookie.txt"
PARTICIPANT_COOKIE="$SCRIPT_DIR/.adv01_participant_cookie.txt"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

RESPONSE=""
HTTP_CODE=""
BODY=""

cleanup() {
  rm -f "$ADMIN_COOKIE" "$ORGANIZER_COOKIE" "$PARTICIPANT_COOKIE"
}

json_get() {
  local json="$1"
  local path="$2"
  echo "$json" | node -e '
const fs = require("fs");
const input = fs.readFileSync(0, "utf8");
const path = process.argv[1].split(".");
let obj;
try {
  obj = JSON.parse(input);
} catch (err) {
  process.exit(2);
}
let cur = obj;
for (const part of path) {
  if (!part) continue;
  if (cur == null) process.exit(3);
  if (/^\d+$/.test(part)) cur = cur[Number(part)];
  else cur = cur[part];
}
if (cur === undefined || cur === null) process.exit(4);
if (typeof cur === "object") process.stdout.write(JSON.stringify(cur));
else process.stdout.write(String(cur));
' "$path"
}

api_call() {
  local method="$1"
  local url="$2"
  local cookie_in="$3"
  local cookie_out="$4"
  local data="$5"

  local cmd=(curl -s -w "\n%{http_code}" -X "$method" "$url")
  if [ -n "$cookie_in" ]; then
    cmd+=( -b "$cookie_in" )
  fi
  if [ -n "$cookie_out" ]; then
    cmd+=( -c "$cookie_out" )
  fi
  if [ -n "$data" ]; then
    cmd+=( -H "Content-Type: application/json" -d "$data" )
  fi

  RESPONSE="$("${cmd[@]}")"
  HTTP_CODE="$(echo "$RESPONSE" | tail -n1)"
  BODY="$(echo "$RESPONSE" | sed '$d')"
}

expect_code() {
  local expected="$1"
  local label="$2"
  if [ "$HTTP_CODE" = "$expected" ]; then
    echo -e "${GREEN}✓ ${label} (HTTP ${HTTP_CODE})${NC}"
  else
    echo -e "${RED}✗ ${label} failed (expected ${expected}, got ${HTTP_CODE})${NC}"
    echo "Response: $BODY"
    cleanup
    exit 1
  fi
}

if [ ! -f "$ENV_FILE" ]; then
  echo -e "${RED}Missing backend .env at $ENV_FILE${NC}"
  exit 1
fi

ADMIN_EMAIL="$(grep '^ADMIN_EMAIL=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '\r')"
ADMIN_PASSWORD="$(grep '^ADMIN_PASSWORD=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '\r')"

if [ -z "$ADMIN_EMAIL" ] || [ -z "$ADMIN_PASSWORD" ]; then
  echo -e "${RED}ADMIN_EMAIL or ADMIN_PASSWORD missing in backend/.env${NC}"
  exit 1
fi

cleanup

STAMP="$(date +%s)"
CATEGORY_NAME="Adv01Category${STAMP}"
ORGANIZER_NAME="adv01org${STAMP}"
PARTICIPANT_EMAIL="adv01.participant.${STAMP}@iiit.ac.in"


echo "============================================"
echo "ADV-01 ORGANIZER PASSWORD RESET REQUEST TESTS"
echo "============================================"
echo ""

echo -e "${YELLOW}1) Admin login${NC}"
api_call "POST" "$BASE_URL/auth/login" "" "$ADMIN_COOKIE" "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}"
expect_code "200" "Admin login"

echo -e "${YELLOW}2) Create category + organizer${NC}"
api_call "POST" "$BASE_URL/clubs/categories" "$ADMIN_COOKIE" "" "{\"name\":\"$CATEGORY_NAME\",\"description\":\"ADV01 category\"}"
expect_code "201" "Create category"
CATEGORY_ID="$(json_get "$BODY" "category._id")" || {
  echo -e "${RED}Could not parse category id${NC}"; cleanup; exit 1;
}

api_call "POST" "$BASE_URL/clubs" "$ADMIN_COOKIE" "" "{\"organizerName\":\"$ORGANIZER_NAME\",\"category\":\"$CATEGORY_ID\",\"description\":\"ADV01 organizer\",\"contactNumber\":\"9999999999\"}"
expect_code "201" "Create organizer"
ORGANIZER_EMAIL="$(json_get "$BODY" "generatedCredentials.email")" || {
  echo -e "${RED}Could not parse organizer email${NC}"; cleanup; exit 1;
}
ORGANIZER_PASSWORD="$(json_get "$BODY" "generatedCredentials.password")" || {
  echo -e "${RED}Could not parse organizer password${NC}"; cleanup; exit 1;
}

echo -e "${YELLOW}3) Organizer login${NC}"
api_call "POST" "$BASE_URL/auth/login" "" "$ORGANIZER_COOKIE" "{\"email\":\"$ORGANIZER_EMAIL\",\"password\":\"$ORGANIZER_PASSWORD\"}"
expect_code "200" "Organizer login"

echo -e "${YELLOW}4) Organizer creates reset request${NC}"
api_call "POST" "$BASE_URL/user/password-reset-requests" "$ORGANIZER_COOKIE" "" "{\"reason\":\"Forgot credentials\"}"
expect_code "201" "Create organizer reset request"
STATUS="$(json_get "$BODY" "request.status")" || {
  echo -e "${RED}Could not parse request status${NC}"; cleanup; exit 1;
}
if [ "$STATUS" != "PENDING" ]; then
  echo -e "${RED}Expected PENDING status, got $STATUS${NC}"
  cleanup
  exit 1
fi

echo -e "${YELLOW}5) Organizer views own reset request history${NC}"
api_call "GET" "$BASE_URL/user/password-reset-requests" "$ORGANIZER_COOKIE" "" ""
expect_code "200" "List organizer reset requests"
REQ_COUNT="$(echo "$BODY" | node -e '
const fs = require("fs");
const body = JSON.parse(fs.readFileSync(0, "utf8"));
process.stdout.write(String((body.requests || []).length));
')" || {
  echo -e "${RED}Could not parse request count${NC}"; cleanup; exit 1;
}
if [ "$REQ_COUNT" -lt 1 ]; then
  echo -e "${RED}Expected at least one request in organizer history${NC}"
  cleanup
  exit 1
fi

echo -e "${YELLOW}6) Non-organizer forbidden from creating organizer reset request${NC}"
api_call "POST" "$BASE_URL/auth/register" "" "$PARTICIPANT_COOKIE" "{\"email\":\"$PARTICIPANT_EMAIL\",\"password\":\"password123\",\"firstName\":\"Adv\",\"lastName\":\"One\",\"contactNumber\":\"9876543210\",\"participantType\":\"IIIT_PARTICIPANT\"}"
expect_code "201" "Participant register"

api_call "POST" "$BASE_URL/user/password-reset-requests" "$PARTICIPANT_COOKIE" "" "{\"reason\":\"Should fail\"}"
expect_code "403" "Participant forbidden for organizer reset request"

echo -e "${GREEN}ADV-01 tests passed.${NC}"
cleanup
