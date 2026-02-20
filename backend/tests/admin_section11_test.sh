#!/bin/bash

set -u

BASE_URL="${BASE_URL:-http://localhost:5000/api}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

ADMIN_COOKIE="$SCRIPT_DIR/.admin11_admin_cookies.txt"
ORGANIZER_COOKIE="$SCRIPT_DIR/.admin11_organizer_cookies.txt"

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
  [ -n "$cookie_in" ] && cmd+=( -b "$cookie_in" )
  [ -n "$cookie_out" ] && cmd+=( -c "$cookie_out" )
  [ -n "$data" ] && cmd+=( -H "Content-Type: application/json" -d "$data" )

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
CATEGORY_NAME="Admin11Category${STAMP}"
ORGANIZER_NAME="admin11organizer${STAMP}"

echo "============================================"
echo "ADMIN SECTION 11 - END TO END TESTS"
echo "============================================"
echo ""

echo -e "${YELLOW}1) Admin login${NC}"
api_call "POST" "$BASE_URL/auth/login" "" "$ADMIN_COOKIE" "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}"
expect_code "200" "Admin login"
echo ""

echo -e "${YELLOW}2) Create category${NC}"
api_call "POST" "$BASE_URL/clubs/categories" "$ADMIN_COOKIE" "" "{\"name\":\"$CATEGORY_NAME\",\"description\":\"Admin11 category\"}"
expect_code "201" "Create category"
CATEGORY_ID="$(json_get "$BODY" "category._id")" || {
  echo -e "${RED}Could not parse category id${NC}"; cleanup; exit 1;
}
echo ""

echo -e "${YELLOW}3) Create organizer with generated credentials${NC}"
api_call "POST" "$BASE_URL/clubs" "$ADMIN_COOKIE" "" "{\"organizerName\":\"$ORGANIZER_NAME\",\"category\":\"$CATEGORY_ID\",\"description\":\"Admin11 organizer\",\"contactNumber\":\"9999999999\"}"
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
echo ""

echo -e "${YELLOW}4) Organizer login with generated credentials${NC}"
api_call "POST" "$BASE_URL/auth/login" "" "$ORGANIZER_COOKIE" "{\"email\":\"$ORGANIZER_EMAIL\",\"password\":\"$ORGANIZER_PASSWORD\"}"
expect_code "200" "Organizer login initial"
echo ""

echo -e "${YELLOW}5) Disable organizer and verify login blocked${NC}"
api_call "PATCH" "$BASE_URL/admin/organizers/$ORGANIZER_ID/status" "$ADMIN_COOKIE" "" "{\"accountStatus\":\"DISABLED\"}"
expect_code "200" "Disable organizer"
api_call "POST" "$BASE_URL/auth/login" "" "" "{\"email\":\"$ORGANIZER_EMAIL\",\"password\":\"$ORGANIZER_PASSWORD\"}"
expect_code "403" "Disabled organizer login blocked"
echo ""

echo -e "${YELLOW}6) Archive organizer and verify login blocked${NC}"
api_call "PATCH" "$BASE_URL/admin/organizers/$ORGANIZER_ID/status" "$ADMIN_COOKIE" "" "{\"accountStatus\":\"ARCHIVED\"}"
expect_code "200" "Archive organizer"
api_call "POST" "$BASE_URL/auth/login" "" "" "{\"email\":\"$ORGANIZER_EMAIL\",\"password\":\"$ORGANIZER_PASSWORD\"}"
expect_code "403" "Archived organizer login blocked"
echo ""

echo -e "${YELLOW}7) Reactivate organizer and verify login works${NC}"
api_call "PATCH" "$BASE_URL/admin/organizers/$ORGANIZER_ID/status" "$ADMIN_COOKIE" "" "{\"accountStatus\":\"ACTIVE\"}"
expect_code "200" "Activate organizer"
api_call "POST" "$BASE_URL/auth/login" "" "" "{\"email\":\"$ORGANIZER_EMAIL\",\"password\":\"$ORGANIZER_PASSWORD\"}"
expect_code "200" "Reactivated organizer login"
echo ""

echo -e "${YELLOW}8) Create password reset request${NC}"
api_call "POST" "$BASE_URL/admin/password-reset-requests" "$ADMIN_COOKIE" "" "{\"organizerId\":\"$ORGANIZER_ID\",\"reason\":\"Forgot password\"}"
expect_code "201" "Create password reset request"
REQUEST_ID="$(json_get "$BODY" "request._id")" || {
  echo -e "${RED}Could not parse request id${NC}"; cleanup; exit 1;
}
echo ""

echo -e "${YELLOW}9) Approve request and get temp credentials${NC}"
api_call "PATCH" "$BASE_URL/admin/password-reset-requests/$REQUEST_ID/review" "$ADMIN_COOKIE" "" "{\"status\":\"APPROVED\",\"adminComment\":\"Approved\"}"
expect_code "200" "Approve reset request"
TEMP_PASSWORD="$(json_get "$BODY" "generatedCredentials.password")" || {
  echo -e "${RED}Could not parse temp password${NC}"; cleanup; exit 1;
}
if [ -z "$TEMP_PASSWORD" ]; then
  echo -e "${RED}Temp password is empty${NC}"
  cleanup
  exit 1
fi
echo ""

echo -e "${YELLOW}10) Organizer login with temp password${NC}"
api_call "POST" "$BASE_URL/auth/login" "" "" "{\"email\":\"$ORGANIZER_EMAIL\",\"password\":\"$TEMP_PASSWORD\"}"
expect_code "200" "Organizer login with temp password"
echo ""

echo -e "${YELLOW}11) Create and reject another reset request${NC}"
api_call "POST" "$BASE_URL/admin/password-reset-requests" "$ADMIN_COOKIE" "" "{\"organizerId\":\"$ORGANIZER_ID\",\"reason\":\"Second request\"}"
expect_code "201" "Create second reset request"
REQUEST_ID_2="$(json_get "$BODY" "request._id")" || {
  echo -e "${RED}Could not parse second request id${NC}"; cleanup; exit 1;
}
api_call "PATCH" "$BASE_URL/admin/password-reset-requests/$REQUEST_ID_2/review" "$ADMIN_COOKIE" "" "{\"status\":\"REJECTED\",\"adminComment\":\"Rejected\"}"
expect_code "200" "Reject reset request"
echo ""

echo -e "${YELLOW}12) Permanent delete organizer and verify login fails${NC}"
api_call "DELETE" "$BASE_URL/admin/organizers/$ORGANIZER_ID" "$ADMIN_COOKIE" "" ""
expect_code "200" "Delete organizer permanently"
api_call "POST" "$BASE_URL/auth/login" "" "" "{\"email\":\"$ORGANIZER_EMAIL\",\"password\":\"$TEMP_PASSWORD\"}"
expect_code "401" "Deleted organizer login fails"
echo ""

echo -e "${YELLOW}13) Verify organizer removed from admin list${NC}"
api_call "GET" "$BASE_URL/admin/organizers?status=ALL&q=$ORGANIZER_NAME" "$ADMIN_COOKIE" "" ""
expect_code "200" "List organizers"
ORGANIZERS_JSON="$(json_get "$BODY" "organizers")" || {
  echo -e "${RED}Could not parse organizers list${NC}"; cleanup; exit 1;
}
if echo "$ORGANIZERS_JSON" | grep -q "$ORGANIZER_ID"; then
  echo -e "${RED}Organizer still present after delete${NC}"
  cleanup
  exit 1
fi
echo -e "${GREEN}✓ Organizer removed from list${NC}"
echo ""

echo -e "${GREEN}All Section 11 admin tests passed successfully.${NC}"
cleanup
