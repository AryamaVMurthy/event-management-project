#!/bin/bash

set -u

BASE_URL="${BASE_URL:-http://localhost:5000/api}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../../.env"

ADMIN_COOKIE="$SCRIPT_DIR/.adv07_admin_cookie.txt"
ORGANIZER_COOKIE="$SCRIPT_DIR/.adv07_organizer_cookie.txt"
PARTICIPANT_COOKIE="$SCRIPT_DIR/.adv07_participant_cookie.txt"
PARTICIPANT2_COOKIE="$SCRIPT_DIR/.adv07_participant2_cookie.txt"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

RESPONSE=""
HTTP_CODE=""
BODY=""

cleanup() {
  rm -f "$ADMIN_COOKIE" "$ORGANIZER_COOKIE" "$PARTICIPANT_COOKIE" "$PARTICIPANT2_COOKIE"
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

api_upload_file() {
  local url="$1"
  local cookie_in="$2"
  local file_path="$3"

  local cmd=(curl -s -w "\n%{http_code}" -X POST "$url")
  if [ -n "$cookie_in" ]; then
    cmd+=( -b "$cookie_in" )
  fi
  cmd+=( -F "paymentProof=@${file_path}" )

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
CATEGORY_NAME="Adv07Category${STAMP}"
ORGANIZER_NAME="adv07org${STAMP}"
PARTICIPANT_EMAIL="adv07.participant.${STAMP}@iiit.ac.in"
PARTICIPANT2_EMAIL="adv07.participant2.${STAMP}@iiit.ac.in"
REG_DEADLINE="$(date -u -d '+1 day' +"%Y-%m-%dT%H:%M:%SZ")"
START_DATE="$(date -u -d '+2 day' +"%Y-%m-%dT%H:%M:%SZ")"
END_DATE="$(date -u -d '+3 day' +"%Y-%m-%dT%H:%M:%SZ")"
PROOF1_FILE="$(mktemp --suffix=.pdf)"
PROOF2_FILE="$(mktemp --suffix=.pdf)"

echo "Proof #1" > "$PROOF1_FILE"
echo "Proof #2" > "$PROOF2_FILE"

echo "============================================"
echo "ADV-07 MERCH REVIEW FINALIZATION TESTS"
echo "============================================"
echo ""

echo -e "${YELLOW}1) Admin login${NC}"
api_call "POST" "$BASE_URL/auth/login" "" "$ADMIN_COOKIE" "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}"
expect_code "200" "Admin login"

echo -e "${YELLOW}2) Create category + organizer${NC}"
api_call "POST" "$BASE_URL/clubs/categories" "$ADMIN_COOKIE" "" "{\"name\":\"$CATEGORY_NAME\",\"description\":\"ADV07 category\"}"
expect_code "201" "Create category"
CATEGORY_ID="$(json_get "$BODY" "category._id")" || {
  echo -e "${RED}Could not parse category id${NC}"; cleanup; rm -f "$PROOF1_FILE" "$PROOF2_FILE"; exit 1;
}

api_call "POST" "$BASE_URL/clubs" "$ADMIN_COOKIE" "" "{\"organizerName\":\"$ORGANIZER_NAME\",\"category\":\"$CATEGORY_ID\",\"description\":\"ADV07 organizer\",\"contactNumber\":\"9999999999\"}"
expect_code "201" "Create organizer"
ORGANIZER_EMAIL="$(json_get "$BODY" "generatedCredentials.email")" || {
  echo -e "${RED}Could not parse organizer email${NC}"; cleanup; rm -f "$PROOF1_FILE" "$PROOF2_FILE"; exit 1;
}
ORGANIZER_PASSWORD="$(json_get "$BODY" "generatedCredentials.password")" || {
  echo -e "${RED}Could not parse organizer password${NC}"; cleanup; rm -f "$PROOF1_FILE" "$PROOF2_FILE"; exit 1;
}

echo -e "${YELLOW}3) Organizer creates/publishes merchandise event${NC}"
api_call "POST" "$BASE_URL/auth/login" "" "$ORGANIZER_COOKIE" "{\"email\":\"$ORGANIZER_EMAIL\",\"password\":\"$ORGANIZER_PASSWORD\"}"
expect_code "200" "Organizer login"

MERCH_EVENT_JSON="{\"name\":\"ADV07 Merch Event $STAMP\",\"description\":\"Approval finalization flow\",\"type\":\"MERCHANDISE\",\"eligibility\":\"ALL\",\"registrationDeadline\":\"$REG_DEADLINE\",\"startDate\":\"$START_DATE\",\"endDate\":\"$END_DATE\",\"registrationLimit\":10,\"registrationFee\":0,\"tags\":[\"adv07\"],\"customFormSchema\":[],\"items\":[{\"name\":\"Tee\",\"description\":\"Fest tee\",\"purchaseLimitPerParticipant\":1,\"variants\":[{\"size\":\"M\",\"color\":\"Black\",\"label\":\"M/Black\",\"price\":499,\"stockQty\":2}]}]}"
api_call "POST" "$BASE_URL/events" "$ORGANIZER_COOKIE" "" "$MERCH_EVENT_JSON"
expect_code "201" "Create merch event"
MERCH_EVENT_ID="$(json_get "$BODY" "event._id")" || {
  echo -e "${RED}Could not parse merch event id${NC}"; cleanup; rm -f "$PROOF1_FILE" "$PROOF2_FILE"; exit 1;
}
MERCH_ITEM_ID="$(json_get "$BODY" "event.items.0.itemId")" || {
  echo -e "${RED}Could not parse item id${NC}"; cleanup; rm -f "$PROOF1_FILE" "$PROOF2_FILE"; exit 1;
}
MERCH_VARIANT_ID="$(json_get "$BODY" "event.items.0.variants.0.variantId")" || {
  echo -e "${RED}Could not parse variant id${NC}"; cleanup; rm -f "$PROOF1_FILE" "$PROOF2_FILE"; exit 1;
}

api_call "POST" "$BASE_URL/events/$MERCH_EVENT_ID/publish" "$ORGANIZER_COOKIE" "" ""
expect_code "200" "Publish merch event"

echo -e "${YELLOW}4) Participant1 purchase + proof upload + approval${NC}"
api_call "POST" "$BASE_URL/auth/register" "" "$PARTICIPANT_COOKIE" "{\"email\":\"$PARTICIPANT_EMAIL\",\"password\":\"password123\",\"firstName\":\"Adv\",\"lastName\":\"Seven\",\"contactNumber\":\"9876543210\",\"participantType\":\"IIIT_PARTICIPANT\"}"
expect_code "201" "Participant1 register"

api_call "POST" "$BASE_URL/events/$MERCH_EVENT_ID/purchase" "$PARTICIPANT_COOKIE" "" "{\"itemId\":\"$MERCH_ITEM_ID\",\"variantId\":\"$MERCH_VARIANT_ID\",\"quantity\":1}"
expect_code "201" "Participant1 purchase"
REG1_ID="$(json_get "$BODY" "registration._id")" || {
  echo -e "${RED}Could not parse participant1 registration id${NC}"; cleanup; rm -f "$PROOF1_FILE" "$PROOF2_FILE"; exit 1;
}

api_upload_file "$BASE_URL/events/registrations/$REG1_ID/payment-proof" "$PARTICIPANT_COOKIE" "$PROOF1_FILE"
expect_code "200" "Participant1 upload proof"

api_call "PATCH" "$BASE_URL/events/organizer/events/$MERCH_EVENT_ID/merch-orders/$REG1_ID/review" "$ORGANIZER_COOKIE" "" "{\"status\":\"APPROVED\",\"reviewComment\":\"Payment verified\"}"
expect_code "200" "Organizer approves order"
APPROVED_STATUS="$(json_get "$BODY" "order.paymentStatus")" || {
  echo -e "${RED}Could not parse approved status${NC}"; cleanup; rm -f "$PROOF1_FILE" "$PROOF2_FILE"; exit 1;
}
if [ "$APPROVED_STATUS" != "APPROVED" ]; then
  echo -e "${RED}Expected APPROVED status, got $APPROVED_STATUS${NC}"
  cleanup
  rm -f "$PROOF1_FILE" "$PROOF2_FILE"
  exit 1
fi
TICKET_ID="$(json_get "$BODY" "ticket.ticketId")" || {
  echo -e "${RED}Could not parse generated ticket id${NC}"; cleanup; rm -f "$PROOF1_FILE" "$PROOF2_FILE"; exit 1;
}

api_call "GET" "$BASE_URL/events/organizer/events/$MERCH_EVENT_ID/participants" "$ORGANIZER_COOKIE" "" ""
expect_code "200" "Organizer participants after approval"
HAS_TICKET1="$(echo "$BODY" | node -e '
const fs = require("fs");
const body = JSON.parse(fs.readFileSync(0, "utf8"));
const regId = process.argv[1];
const row = (body.participants || []).find((p) => String(p.registrationId) === regId);
if (!row) process.stdout.write("missing");
else process.stdout.write(row.ticketId ? "yes" : "no");
' "$REG1_ID")"
if [ "$HAS_TICKET1" != "yes" ]; then
  echo -e "${RED}Expected ticket for approved order${NC}"
  cleanup
  rm -f "$PROOF1_FILE" "$PROOF2_FILE"
  exit 1
fi

api_call "GET" "$BASE_URL/events/organizer/events/$MERCH_EVENT_ID" "$ORGANIZER_COOKIE" "" ""
expect_code "200" "Event details after approval"
STOCK_AFTER_APPROVAL="$(json_get "$BODY" "event.items.0.variants.0.stockQty")" || {
  echo -e "${RED}Could not parse stock after approval${NC}"; cleanup; rm -f "$PROOF1_FILE" "$PROOF2_FILE"; exit 1;
}
if [ "$STOCK_AFTER_APPROVAL" != "1" ]; then
  echo -e "${RED}Expected stock=1 after one approval, got $STOCK_AFTER_APPROVAL${NC}"
  cleanup
  rm -f "$PROOF1_FILE" "$PROOF2_FILE"
  exit 1
fi

api_call "PATCH" "$BASE_URL/events/organizer/events/$MERCH_EVENT_ID/merch-orders/$REG1_ID/review" "$ORGANIZER_COOKIE" "" "{\"status\":\"REJECTED\",\"reviewComment\":\"Second review should fail\"}"
expect_code "409" "Duplicate review blocked"

echo -e "${YELLOW}5) Participant2 purchase + proof upload + rejection${NC}"
api_call "POST" "$BASE_URL/auth/register" "" "$PARTICIPANT2_COOKIE" "{\"email\":\"$PARTICIPANT2_EMAIL\",\"password\":\"password123\",\"firstName\":\"Adv\",\"lastName\":\"SevenB\",\"contactNumber\":\"9876543211\",\"participantType\":\"IIIT_PARTICIPANT\"}"
expect_code "201" "Participant2 register"

api_call "POST" "$BASE_URL/events/$MERCH_EVENT_ID/purchase" "$PARTICIPANT2_COOKIE" "" "{\"itemId\":\"$MERCH_ITEM_ID\",\"variantId\":\"$MERCH_VARIANT_ID\",\"quantity\":1}"
expect_code "201" "Participant2 purchase"
REG2_ID="$(json_get "$BODY" "registration._id")" || {
  echo -e "${RED}Could not parse participant2 registration id${NC}"; cleanup; rm -f "$PROOF1_FILE" "$PROOF2_FILE"; exit 1;
}

api_upload_file "$BASE_URL/events/registrations/$REG2_ID/payment-proof" "$PARTICIPANT2_COOKIE" "$PROOF2_FILE"
expect_code "200" "Participant2 upload proof"

api_call "PATCH" "$BASE_URL/events/organizer/events/$MERCH_EVENT_ID/merch-orders/$REG2_ID/review" "$ORGANIZER_COOKIE" "" "{\"status\":\"REJECTED\",\"reviewComment\":\"Proof invalid\"}"
expect_code "200" "Organizer rejects order"
REJECTED_STATUS="$(json_get "$BODY" "order.paymentStatus")" || {
  echo -e "${RED}Could not parse rejected status${NC}"; cleanup; rm -f "$PROOF1_FILE" "$PROOF2_FILE"; exit 1;
}
if [ "$REJECTED_STATUS" != "REJECTED" ]; then
  echo -e "${RED}Expected REJECTED status, got $REJECTED_STATUS${NC}"
  cleanup
  rm -f "$PROOF1_FILE" "$PROOF2_FILE"
  exit 1
fi
if echo "$BODY" | grep -q '"ticket"'; then
  echo -e "${RED}Rejected order should not contain ticket${NC}"
  cleanup
  rm -f "$PROOF1_FILE" "$PROOF2_FILE"
  exit 1
fi

api_call "GET" "$BASE_URL/events/organizer/events/$MERCH_EVENT_ID" "$ORGANIZER_COOKIE" "" ""
expect_code "200" "Event details after rejection"
STOCK_AFTER_REJECTION="$(json_get "$BODY" "event.items.0.variants.0.stockQty")" || {
  echo -e "${RED}Could not parse stock after rejection${NC}"; cleanup; rm -f "$PROOF1_FILE" "$PROOF2_FILE"; exit 1;
}
if [ "$STOCK_AFTER_REJECTION" != "1" ]; then
  echo -e "${RED}Stock should remain 1 after rejection, got $STOCK_AFTER_REJECTION${NC}"
  cleanup
  rm -f "$PROOF1_FILE" "$PROOF2_FILE"
  exit 1
fi

api_call "GET" "$BASE_URL/events/organizer/events/$MERCH_EVENT_ID/participants" "$ORGANIZER_COOKIE" "" ""
expect_code "200" "Organizer participants after rejection"
HAS_TICKET2="$(echo "$BODY" | node -e '
const fs = require("fs");
const body = JSON.parse(fs.readFileSync(0, "utf8"));
const regId = process.argv[1];
const row = (body.participants || []).find((p) => String(p.registrationId) === regId);
if (!row) process.stdout.write("missing");
else process.stdout.write(row.ticketId ? "yes" : "no");
' "$REG2_ID")"
if [ "$HAS_TICKET2" != "no" ]; then
  echo -e "${RED}Rejected order should not have ticket${NC}"
  cleanup
  rm -f "$PROOF1_FILE" "$PROOF2_FILE"
  exit 1
fi

echo -e "${GREEN}ADV-07 tests passed.${NC}"
cleanup
rm -f "$PROOF1_FILE" "$PROOF2_FILE"
