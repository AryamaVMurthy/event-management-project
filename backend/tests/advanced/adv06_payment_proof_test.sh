#!/bin/bash

set -u

BASE_URL="${BASE_URL:-http://localhost:5000/api}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../../.env"

ADMIN_COOKIE="$SCRIPT_DIR/.adv06_admin_cookie.txt"
ORGANIZER_COOKIE="$SCRIPT_DIR/.adv06_organizer_cookie.txt"
PARTICIPANT_COOKIE="$SCRIPT_DIR/.adv06_participant_cookie.txt"
OTHER_PARTICIPANT_COOKIE="$SCRIPT_DIR/.adv06_participant_other_cookie.txt"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

RESPONSE=""
HTTP_CODE=""
BODY=""
HEADERS=""

cleanup() {
  rm -f "$ADMIN_COOKIE" "$ORGANIZER_COOKIE" "$PARTICIPANT_COOKIE" "$OTHER_PARTICIPANT_COOKIE"
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

  local header_file
  header_file="$(mktemp)"

  local cmd=(curl -s -D "$header_file" -w "\n%{http_code}" -X "$method" "$url")
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
  HEADERS="$(cat "$header_file")"
  rm -f "$header_file"
}

api_upload_file() {
  local url="$1"
  local cookie_in="$2"
  local cookie_out="$3"
  local field_name="$4"
  local file_path="$5"

  local header_file
  header_file="$(mktemp)"

  local cmd=(curl -s -D "$header_file" -w "\n%{http_code}" -X POST "$url")
  if [ -n "$cookie_in" ]; then
    cmd+=( -b "$cookie_in" )
  fi
  if [ -n "$cookie_out" ]; then
    cmd+=( -c "$cookie_out" )
  fi
  cmd+=( -F "${field_name}=@${file_path}" )

  RESPONSE="$("${cmd[@]}")"
  HTTP_CODE="$(echo "$RESPONSE" | tail -n1)"
  BODY="$(echo "$RESPONSE" | sed '$d')"
  HEADERS="$(cat "$header_file")"
  rm -f "$header_file"
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
CATEGORY_NAME="Adv06Category${STAMP}"
ORGANIZER_NAME="adv06org${STAMP}"
PARTICIPANT_EMAIL="adv06.participant.${STAMP}@iiit.ac.in"
OTHER_PARTICIPANT_EMAIL="adv06.other.${STAMP}@iiit.ac.in"
REG_DEADLINE="$(date -u -d '+1 day' +"%Y-%m-%dT%H:%M:%SZ")"
START_DATE="$(date -u -d '+2 day' +"%Y-%m-%dT%H:%M:%SZ")"
END_DATE="$(date -u -d '+3 day' +"%Y-%m-%dT%H:%M:%SZ")"
PAYMENT_PROOF_FILE="$(mktemp --suffix=.pdf)"

echo "Fake payment proof for ADV-06" > "$PAYMENT_PROOF_FILE"

echo "============================================"
echo "ADV-06 PAYMENT PROOF + ORGANIZER QUEUE TESTS"
echo "============================================"
echo ""

echo -e "${YELLOW}1) Admin login${NC}"
api_call "POST" "$BASE_URL/auth/login" "" "$ADMIN_COOKIE" "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}"
expect_code "200" "Admin login"

echo -e "${YELLOW}2) Create category + organizer${NC}"
api_call "POST" "$BASE_URL/clubs/categories" "$ADMIN_COOKIE" "" "{\"name\":\"$CATEGORY_NAME\",\"description\":\"ADV06 category\"}"
expect_code "201" "Create category"
CATEGORY_ID="$(json_get "$BODY" "category._id")" || {
  echo -e "${RED}Could not parse category id${NC}"; cleanup; rm -f "$PAYMENT_PROOF_FILE"; exit 1;
}

api_call "POST" "$BASE_URL/clubs" "$ADMIN_COOKIE" "" "{\"organizerName\":\"$ORGANIZER_NAME\",\"category\":\"$CATEGORY_ID\",\"description\":\"ADV06 organizer\",\"contactNumber\":\"9999999999\"}"
expect_code "201" "Create organizer"
ORGANIZER_EMAIL="$(json_get "$BODY" "generatedCredentials.email")" || {
  echo -e "${RED}Could not parse organizer email${NC}"; cleanup; rm -f "$PAYMENT_PROOF_FILE"; exit 1;
}
ORGANIZER_PASSWORD="$(json_get "$BODY" "generatedCredentials.password")" || {
  echo -e "${RED}Could not parse organizer password${NC}"; cleanup; rm -f "$PAYMENT_PROOF_FILE"; exit 1;
}

echo -e "${YELLOW}3) Organizer creates and publishes merchandise event${NC}"
api_call "POST" "$BASE_URL/auth/login" "" "$ORGANIZER_COOKIE" "{\"email\":\"$ORGANIZER_EMAIL\",\"password\":\"$ORGANIZER_PASSWORD\"}"
expect_code "200" "Organizer login"

MERCH_EVENT_JSON="{\"name\":\"ADV06 Merch Event $STAMP\",\"description\":\"Payment proof flow\",\"type\":\"MERCHANDISE\",\"eligibility\":\"ALL\",\"registrationDeadline\":\"$REG_DEADLINE\",\"startDate\":\"$START_DATE\",\"endDate\":\"$END_DATE\",\"registrationLimit\":10,\"registrationFee\":0,\"tags\":[\"adv06\"],\"customFormSchema\":[],\"items\":[{\"name\":\"Tee\",\"description\":\"Fest tee\",\"purchaseLimitPerParticipant\":1,\"variants\":[{\"size\":\"M\",\"color\":\"Black\",\"label\":\"M/Black\",\"price\":499,\"stockQty\":3}]}]}"
api_call "POST" "$BASE_URL/events" "$ORGANIZER_COOKIE" "" "$MERCH_EVENT_JSON"
expect_code "201" "Create merch event"
MERCH_EVENT_ID="$(json_get "$BODY" "event._id")" || {
  echo -e "${RED}Could not parse merch event id${NC}"; cleanup; rm -f "$PAYMENT_PROOF_FILE"; exit 1;
}
MERCH_ITEM_ID="$(json_get "$BODY" "event.items.0.itemId")" || {
  echo -e "${RED}Could not parse item id${NC}"; cleanup; rm -f "$PAYMENT_PROOF_FILE"; exit 1;
}
MERCH_VARIANT_ID="$(json_get "$BODY" "event.items.0.variants.0.variantId")" || {
  echo -e "${RED}Could not parse variant id${NC}"; cleanup; rm -f "$PAYMENT_PROOF_FILE"; exit 1;
}
api_call "POST" "$BASE_URL/events/$MERCH_EVENT_ID/publish" "$ORGANIZER_COOKIE" "" ""
expect_code "200" "Publish merch event"

echo -e "${YELLOW}4) Participant purchases and uploads payment proof${NC}"
api_call "POST" "$BASE_URL/auth/register" "" "$PARTICIPANT_COOKIE" "{\"email\":\"$PARTICIPANT_EMAIL\",\"password\":\"password123\",\"firstName\":\"Adv\",\"lastName\":\"Six\",\"contactNumber\":\"9876543210\",\"participantType\":\"IIIT_PARTICIPANT\"}"
expect_code "201" "Participant register"

api_call "POST" "$BASE_URL/events/$MERCH_EVENT_ID/purchase" "$PARTICIPANT_COOKIE" "" "{\"itemId\":\"$MERCH_ITEM_ID\",\"variantId\":\"$MERCH_VARIANT_ID\",\"quantity\":1}"
expect_code "201" "Participant purchase"
REGISTRATION_ID="$(json_get "$BODY" "registration._id")" || {
  echo -e "${RED}Could not parse registration id${NC}"; cleanup; rm -f "$PAYMENT_PROOF_FILE"; exit 1;
}

api_upload_file "$BASE_URL/events/registrations/$REGISTRATION_ID/payment-proof" "$PARTICIPANT_COOKIE" "" "paymentProof" "$PAYMENT_PROOF_FILE"
expect_code "200" "Upload payment proof"
PAYMENT_STATUS="$(json_get "$BODY" "order.paymentStatus")" || {
  echo -e "${RED}Could not parse payment status${NC}"; cleanup; rm -f "$PAYMENT_PROOF_FILE"; exit 1;
}
if [ "$PAYMENT_STATUS" != "PENDING_APPROVAL" ]; then
  echo -e "${RED}Expected PENDING_APPROVAL after upload, got $PAYMENT_STATUS${NC}"
  cleanup
  rm -f "$PAYMENT_PROOF_FILE"
  exit 1
fi

echo -e "${YELLOW}5) Organizer sees pending order in merch queue${NC}"
api_call "GET" "$BASE_URL/events/organizer/events/$MERCH_EVENT_ID/merch-orders?paymentStatus=PENDING_APPROVAL" "$ORGANIZER_COOKIE" "" ""
expect_code "200" "Organizer merch queue"
FOUND_ORDER="$(echo "$BODY" | node -e '
const fs = require("fs");
const body = JSON.parse(fs.readFileSync(0, "utf8"));
const target = process.argv[1];
const found = (body.orders || []).some((o) => String(o.registrationId) === target && o.paymentProof);
process.stdout.write(found ? "yes" : "no");
' "$REGISTRATION_ID")" || {
  echo -e "${RED}Could not parse organizer queue${NC}"; cleanup; rm -f "$PAYMENT_PROOF_FILE"; exit 1;
}
if [ "$FOUND_ORDER" != "yes" ]; then
  echo -e "${RED}Organizer queue missing pending proof order${NC}"
  cleanup
  rm -f "$PAYMENT_PROOF_FILE"
  exit 1
fi

echo -e "${YELLOW}6) Organizer and admin can retrieve/download payment proof${NC}"
api_call "GET" "$BASE_URL/events/registrations/$REGISTRATION_ID/payment-proof" "$ORGANIZER_COOKIE" "" ""
expect_code "200" "Organizer payment-proof metadata"

api_call "GET" "$BASE_URL/events/registrations/$REGISTRATION_ID/payment-proof?download=true" "$ORGANIZER_COOKIE" "" ""
expect_code "200" "Organizer payment-proof download"
if ! echo "$HEADERS" | grep -iq "content-disposition: attachment"; then
  echo -e "${RED}Expected attachment content-disposition for download${NC}"
  cleanup
  rm -f "$PAYMENT_PROOF_FILE"
  exit 1
fi

api_call "GET" "$BASE_URL/events/registrations/$REGISTRATION_ID/payment-proof" "$ADMIN_COOKIE" "" ""
expect_code "200" "Admin payment-proof metadata"

echo -e "${YELLOW}7) Unauthorized participant is denied${NC}"
api_call "POST" "$BASE_URL/auth/register" "" "$OTHER_PARTICIPANT_COOKIE" "{\"email\":\"$OTHER_PARTICIPANT_EMAIL\",\"password\":\"password123\",\"firstName\":\"Adv\",\"lastName\":\"Other\",\"contactNumber\":\"9876543211\",\"participantType\":\"NON_IIIT_PARTICIPANT\",\"collegeOrgName\":\"Other College\"}"
expect_code "201" "Other participant register"

api_call "GET" "$BASE_URL/events/registrations/$REGISTRATION_ID/payment-proof" "$OTHER_PARTICIPANT_COOKIE" "" ""
expect_code "403" "Other participant forbidden from proof metadata"

api_call "GET" "$BASE_URL/events/registrations/$REGISTRATION_ID/payment-proof?download=true" "$OTHER_PARTICIPANT_COOKIE" "" ""
expect_code "403" "Other participant forbidden from proof download"

echo -e "${GREEN}ADV-06 tests passed.${NC}"
cleanup
rm -f "$PAYMENT_PROOF_FILE"
