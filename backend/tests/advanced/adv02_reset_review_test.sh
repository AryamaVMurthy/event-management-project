#!/bin/bash

set -u

BASE_URL="${BASE_URL:-http://localhost:5000/api}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../../.env"

ADMIN_COOKIE="$SCRIPT_DIR/.adv02_admin_cookie.txt"
ORGANIZER_COOKIE="$SCRIPT_DIR/.adv02_organizer_cookie.txt"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

RESPONSE=""
HTTP_CODE=""
BODY=""

cleanup() {
  rm -f "$ADMIN_COOKIE" "$ORGANIZER_COOKIE"
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
} catch {
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
CATEGORY_NAME="Adv02Category${STAMP}"
ORGANIZER_NAME="adv02org${STAMP}"


echo "============================================"
echo "ADV-02 PASSWORD RESET REVIEW FLOW TESTS"
echo "============================================"
echo ""

echo -e "${YELLOW}1) Admin login${NC}"
api_call "POST" "$BASE_URL/auth/login" "" "$ADMIN_COOKIE" "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}"
expect_code "200" "Admin login"

echo -e "${YELLOW}2) Create category + organizer${NC}"
api_call "POST" "$BASE_URL/clubs/categories" "$ADMIN_COOKIE" "" "{\"name\":\"$CATEGORY_NAME\",\"description\":\"ADV02 category\"}"
expect_code "201" "Create category"
CATEGORY_ID="$(json_get "$BODY" "category._id")" || {
  echo -e "${RED}Could not parse category id${NC}"; cleanup; exit 1;
}

api_call "POST" "$BASE_URL/clubs" "$ADMIN_COOKIE" "" "{\"organizerName\":\"$ORGANIZER_NAME\",\"category\":\"$CATEGORY_ID\",\"description\":\"ADV02 organizer\",\"contactNumber\":\"9999999999\"}"
expect_code "201" "Create organizer"
ORGANIZER_ID="$(json_get "$BODY" "club._id")" || {
  echo -e "${RED}Could not parse organizer id${NC}"; cleanup; exit 1;
}
ORGANIZER_EMAIL="$(json_get "$BODY" "generatedCredentials.email")" || {
  echo -e "${RED}Could not parse organizer email${NC}"; cleanup; exit 1;
}
ORGANIZER_PASSWORD="$(json_get "$BODY" "generatedCredentials.password")" || {
  echo -e "${RED}Could not parse organizer password${NC}"; cleanup; exit 1;
}

echo -e "${YELLOW}3) Organizer login and create reset request${NC}"
api_call "POST" "$BASE_URL/auth/login" "" "$ORGANIZER_COOKIE" "{\"email\":\"$ORGANIZER_EMAIL\",\"password\":\"$ORGANIZER_PASSWORD\"}"
expect_code "200" "Organizer login"

api_call "POST" "$BASE_URL/user/password-reset-requests" "$ORGANIZER_COOKIE" "" "{\"reason\":\"Cannot login reliably\"}"
expect_code "201" "Organizer creates reset request"
REQUEST_ID="$(json_get "$BODY" "request._id")" || {
  echo -e "${RED}Could not parse request id${NC}"; cleanup; exit 1;
}

echo -e "${YELLOW}4) Admin sees pending request${NC}"
api_call "GET" "$BASE_URL/admin/password-reset-requests?status=PENDING" "$ADMIN_COOKIE" "" ""
expect_code "200" "Admin list pending reset requests"
FOUND_PENDING="$(echo "$BODY" | node -e '
const fs = require("fs");
const body = JSON.parse(fs.readFileSync(0, "utf8"));
const id = process.argv[1];
const found = (body.requests || []).some((r) => String(r._id) === id && String(r.status) === "PENDING");
process.stdout.write(found ? "yes" : "no");
' "$REQUEST_ID")" || {
  echo -e "${RED}Could not verify pending request list${NC}"; cleanup; exit 1;
}
if [ "$FOUND_PENDING" != "yes" ]; then
  echo -e "${RED}Pending request not found in admin list${NC}"
  cleanup
  exit 1
fi

echo -e "${YELLOW}5) Admin approves request and gets temp credentials once${NC}"
api_call "PATCH" "$BASE_URL/admin/password-reset-requests/$REQUEST_ID/review" "$ADMIN_COOKIE" "" "{\"status\":\"APPROVED\",\"adminComment\":\"Approved after identity check\"}"
expect_code "200" "Admin approve request"
TEMP_PASSWORD="$(json_get "$BODY" "generatedCredentials.password")" || {
  echo -e "${RED}Could not parse generated temp password${NC}"; cleanup; exit 1;
}
TEMP_EMAIL="$(json_get "$BODY" "generatedCredentials.email")" || {
  echo -e "${RED}Could not parse generated email${NC}"; cleanup; exit 1;
}
if [ -z "$TEMP_PASSWORD" ] || [ -z "$TEMP_EMAIL" ]; then
  echo -e "${RED}Generated credentials empty${NC}"
  cleanup
  exit 1
fi

api_call "PATCH" "$BASE_URL/admin/password-reset-requests/$REQUEST_ID/review" "$ADMIN_COOKIE" "" "{\"status\":\"REJECTED\",\"adminComment\":\"Must fail\"}"
expect_code "409" "Re-review blocked"

echo -e "${YELLOW}6) Organizer sees reviewed status fields${NC}"
api_call "GET" "$BASE_URL/user/password-reset-requests" "$ORGANIZER_COOKIE" "" ""
expect_code "200" "Organizer lists reset request history"
CHECK_HISTORY="$(echo "$BODY" | node -e '
const fs = require("fs");
const body = JSON.parse(fs.readFileSync(0, "utf8"));
const targetId = process.argv[1];
const req = (body.requests || []).find((r) => String(r._id) === targetId);
const ok = !!req && req.status === "APPROVED" &&
  req.reviewedAt != null &&
  req.adminComment === "Approved after identity check";
process.stdout.write(ok ? "yes" : "no");
' "$REQUEST_ID")" || {
  echo -e "${RED}Could not parse organizer history check${NC}"; cleanup; exit 1;
}
if [ "$CHECK_HISTORY" != "yes" ]; then
  echo -e "${RED}Organizer history missing reviewed fields${NC}"
  cleanup
  exit 1
fi

echo -e "${YELLOW}7) Organizer logs in with approved temporary credentials${NC}"
api_call "POST" "$BASE_URL/auth/login" "" "" "{\"email\":\"$TEMP_EMAIL\",\"password\":\"$TEMP_PASSWORD\"}"
expect_code "200" "Organizer login with temporary credentials"

echo -e "${YELLOW}8) Reject a new organizer-originated request${NC}"
api_call "POST" "$BASE_URL/user/password-reset-requests" "$ORGANIZER_COOKIE" "" "{\"reason\":\"Second attempt\"}"
expect_code "201" "Organizer creates second request"
REQUEST2_ID="$(json_get "$BODY" "request._id")" || {
  echo -e "${RED}Could not parse second request id${NC}"; cleanup; exit 1;
}

api_call "PATCH" "$BASE_URL/admin/password-reset-requests/$REQUEST2_ID/review" "$ADMIN_COOKIE" "" "{\"status\":\"REJECTED\",\"adminComment\":\"Not enough proof\"}"
expect_code "200" "Admin reject request"

api_call "GET" "$BASE_URL/user/password-reset-requests" "$ORGANIZER_COOKIE" "" ""
expect_code "200" "Organizer lists reset history after rejection"
CHECK_REJECT="$(echo "$BODY" | node -e '
const fs = require("fs");
const body = JSON.parse(fs.readFileSync(0, "utf8"));
const targetId = process.argv[1];
const req = (body.requests || []).find((r) => String(r._id) === targetId);
const ok = !!req && req.status === "REJECTED" && req.adminComment === "Not enough proof";
process.stdout.write(ok ? "yes" : "no");
' "$REQUEST2_ID")" || {
  echo -e "${RED}Could not verify rejected request history${NC}"; cleanup; exit 1;
}
if [ "$CHECK_REJECT" != "yes" ]; then
  echo -e "${RED}Rejected request fields not visible to organizer${NC}"
  cleanup
  exit 1
fi

echo -e "${GREEN}ADV-02 tests passed.${NC}"
cleanup
