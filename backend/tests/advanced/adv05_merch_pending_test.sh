#!/bin/bash

set -u

BASE_URL="${BASE_URL:-http://localhost:5000/api}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../../.env"

ADMIN_COOKIE="$SCRIPT_DIR/.adv05_admin_cookie.txt"
ORGANIZER_COOKIE="$SCRIPT_DIR/.adv05_organizer_cookie.txt"
PARTICIPANT_COOKIE="$SCRIPT_DIR/.adv05_participant_cookie.txt"

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
CATEGORY_NAME="Adv05Category${STAMP}"
ORGANIZER_NAME="adv05org${STAMP}"
PARTICIPANT_EMAIL="adv05.participant.${STAMP}@iiit.ac.in"
REG_DEADLINE="$(date -u -d '+1 day' +"%Y-%m-%dT%H:%M:%SZ")"
START_DATE="$(date -u -d '+2 day' +"%Y-%m-%dT%H:%M:%SZ")"
END_DATE="$(date -u -d '+3 day' +"%Y-%m-%dT%H:%M:%SZ")"

echo "============================================"
echo "ADV-05 MERCH PENDING PAYMENT TESTS"
echo "============================================"
echo ""

echo -e "${YELLOW}1) Admin login${NC}"
api_call "POST" "$BASE_URL/auth/login" "" "$ADMIN_COOKIE" "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}"
expect_code "200" "Admin login"

echo -e "${YELLOW}2) Create category + organizer${NC}"
api_call "POST" "$BASE_URL/clubs/categories" "$ADMIN_COOKIE" "" "{\"name\":\"$CATEGORY_NAME\",\"description\":\"ADV05 category\"}"
expect_code "201" "Create category"
CATEGORY_ID="$(json_get "$BODY" "category._id")" || {
  echo -e "${RED}Could not parse category id${NC}"; cleanup; exit 1;
}

api_call "POST" "$BASE_URL/clubs" "$ADMIN_COOKIE" "" "{\"organizerName\":\"$ORGANIZER_NAME\",\"category\":\"$CATEGORY_ID\",\"description\":\"ADV05 organizer\",\"contactNumber\":\"9999999999\"}"
expect_code "201" "Create organizer"
ORGANIZER_EMAIL="$(json_get "$BODY" "generatedCredentials.email")" || {
  echo -e "${RED}Could not parse organizer email${NC}"; cleanup; exit 1;
}
ORGANIZER_PASSWORD="$(json_get "$BODY" "generatedCredentials.password")" || {
  echo -e "${RED}Could not parse organizer password${NC}"; cleanup; exit 1;
}

echo -e "${YELLOW}3) Organizer creates and publishes merchandise event${NC}"
api_call "POST" "$BASE_URL/auth/login" "" "$ORGANIZER_COOKIE" "{\"email\":\"$ORGANIZER_EMAIL\",\"password\":\"$ORGANIZER_PASSWORD\"}"
expect_code "200" "Organizer login"

MERCH_EVENT_JSON="{\"name\":\"ADV05 Merch Event $STAMP\",\"description\":\"Pending payment flow\",\"type\":\"MERCHANDISE\",\"eligibility\":\"ALL\",\"registrationDeadline\":\"$REG_DEADLINE\",\"startDate\":\"$START_DATE\",\"endDate\":\"$END_DATE\",\"registrationLimit\":10,\"registrationFee\":0,\"tags\":[\"adv05\"],\"customFormSchema\":[],\"items\":[{\"name\":\"Hoodie\",\"description\":\"Fest hoodie\",\"purchaseLimitPerParticipant\":2,\"variants\":[{\"size\":\"M\",\"color\":\"Black\",\"label\":\"M/Black\",\"price\":999,\"stockQty\":5}]}]}"
api_call "POST" "$BASE_URL/events" "$ORGANIZER_COOKIE" "" "$MERCH_EVENT_JSON"
expect_code "201" "Create merch event"
MERCH_EVENT_ID="$(json_get "$BODY" "event._id")" || {
  echo -e "${RED}Could not parse merch event id${NC}"; cleanup; exit 1;
}
MERCH_ITEM_ID="$(json_get "$BODY" "event.items.0.itemId")" || {
  echo -e "${RED}Could not parse merch item id${NC}"; cleanup; exit 1;
}
MERCH_VARIANT_ID="$(json_get "$BODY" "event.items.0.variants.0.variantId")" || {
  echo -e "${RED}Could not parse merch variant id${NC}"; cleanup; exit 1;
}
INITIAL_STOCK="$(json_get "$BODY" "event.items.0.variants.0.stockQty")" || {
  echo -e "${RED}Could not parse initial stock${NC}"; cleanup; exit 1;
}

api_call "POST" "$BASE_URL/events/$MERCH_EVENT_ID/publish" "$ORGANIZER_COOKIE" "" ""
expect_code "200" "Publish merch event"

echo -e "${YELLOW}4) Participant purchases merch -> pending, no ticket/email${NC}"
api_call "POST" "$BASE_URL/auth/register" "" "$PARTICIPANT_COOKIE" "{\"email\":\"$PARTICIPANT_EMAIL\",\"password\":\"password123\",\"firstName\":\"Adv\",\"lastName\":\"Five\",\"contactNumber\":\"9876543210\",\"participantType\":\"IIIT_PARTICIPANT\"}"
expect_code "201" "Participant register"

api_call "POST" "$BASE_URL/events/$MERCH_EVENT_ID/purchase" "$PARTICIPANT_COOKIE" "" "{\"itemId\":\"$MERCH_ITEM_ID\",\"variantId\":\"$MERCH_VARIANT_ID\",\"quantity\":1}"
expect_code "201" "Purchase merch"
REGISTRATION_ID="$(json_get "$BODY" "registration._id")" || {
  echo -e "${RED}Could not parse registration id${NC}"; cleanup; exit 1;
}
PAYMENT_STATUS="$(json_get "$BODY" "registration.merchPurchase.paymentStatus")" || {
  echo -e "${RED}Could not parse payment status${NC}"; cleanup; exit 1;
}
if [ "$PAYMENT_STATUS" != "PAYMENT_PENDING" ]; then
  echo -e "${RED}Expected PAYMENT_PENDING, got $PAYMENT_STATUS${NC}"
  cleanup
  exit 1
fi
if echo "$BODY" | grep -q '"ticket"'; then
  echo -e "${RED}Purchase should not return ticket for pending payment${NC}"
  cleanup
  exit 1
fi
if echo "$BODY" | grep -q '"email"'; then
  echo -e "${RED}Purchase should not return email for pending payment${NC}"
  cleanup
  exit 1
fi

echo -e "${YELLOW}5) No ticket exists and stock remains unchanged${NC}"
api_call "GET" "$BASE_URL/events/organizer/events/$MERCH_EVENT_ID/participants" "$ORGANIZER_COOKIE" "" ""
expect_code "200" "Organizer participants list"
HAS_TICKET="$(echo "$BODY" | node -e '
const fs = require("fs");
const body = JSON.parse(fs.readFileSync(0, "utf8"));
const targetId = process.argv[1];
const row = (body.participants || []).find((p) => String(p.registrationId) === targetId);
if (!row) {
  process.stdout.write("missing");
  process.exit(0);
}
process.stdout.write(row.ticketId ? "yes" : "no");
' "$REGISTRATION_ID")" || {
  echo -e "${RED}Could not verify ticket absence${NC}"; cleanup; exit 1;
}
if [ "$HAS_TICKET" = "missing" ]; then
  echo -e "${RED}Registration row missing in organizer participants list${NC}"
  cleanup
  exit 1
fi
if [ "$HAS_TICKET" != "no" ]; then
  echo -e "${RED}Expected no ticket for pending merch order${NC}"
  cleanup
  exit 1
fi

api_call "GET" "$BASE_URL/events/organizer/events/$MERCH_EVENT_ID" "$ORGANIZER_COOKIE" "" ""
expect_code "200" "Organizer event details"
FINAL_STOCK="$(json_get "$BODY" "event.items.0.variants.0.stockQty")" || {
  echo -e "${RED}Could not parse final stock${NC}"; cleanup; exit 1;
}
if [ "$FINAL_STOCK" != "$INITIAL_STOCK" ]; then
  echo -e "${RED}Stock should stay unchanged for PAYMENT_PENDING orders (initial=$INITIAL_STOCK, final=$FINAL_STOCK)${NC}"
  cleanup
  exit 1
fi

echo -e "${GREEN}ADV-05 tests passed.${NC}"
cleanup
