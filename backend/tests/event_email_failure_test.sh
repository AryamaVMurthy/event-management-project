#!/bin/bash

# ============================================================
# FELICITY EVENTS EMAIL FAILURE TEST SCRIPT
# ============================================================
# 1) Startup must fail fast when SMTP config is invalid
# 2) Register and merch approval must return 502 and rollback on email fail
# ============================================================

set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/.."
ENV_FILE="$BACKEND_DIR/.env"

BASE_URL="http://localhost:5001/api"

ADMIN_COOKIE="$SCRIPT_DIR/.event_fail_admin_cookies.txt"
ORGANIZER_COOKIE="$SCRIPT_DIR/.event_fail_organizer_cookies.txt"
PARTICIPANT_COOKIE="$SCRIPT_DIR/.event_fail_participant_cookies.txt"
PARTICIPANT2_COOKIE="$SCRIPT_DIR/.event_fail_participant2_cookies.txt"
BAD_STARTUP_LOG="$SCRIPT_DIR/.event_fail_bad_startup.log"
FORCED_FAIL_LOG="$SCRIPT_DIR/.event_fail_forced_send.log"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

RESPONSE=""
HTTP_CODE=""
BODY=""
SERVER_PID=""
PAYMENT_PROOF_FILE=""

cleanup() {
  rm -f \
    "$ADMIN_COOKIE" \
    "$ORGANIZER_COOKIE" \
    "$PARTICIPANT_COOKIE" \
    "$PARTICIPANT2_COOKIE" \
    "$BAD_STARTUP_LOG"
  if [ -n "$PAYMENT_PROOF_FILE" ] && [ -f "$PAYMENT_PROOF_FILE" ]; then
    rm -f "$PAYMENT_PROOF_FILE"
  fi
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT

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

json_array_length() {
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
if (!Array.isArray(cur)) process.exit(4);
process.stdout.write(String(cur.length));
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
    exit 1
  fi
}

if [ ! -f "$ENV_FILE" ]; then
  echo -e "${RED}Missing backend .env at $ENV_FILE${NC}"
  exit 1
fi

ADMIN_EMAIL="$(grep '^ADMIN_EMAIL=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '\r')"
ADMIN_PASSWORD="$(grep '^ADMIN_PASSWORD=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '\r')"
MONGO_URI="$(grep '^MONGO_URI=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '\r')"
SMTP_HOST="$(grep '^SMTP_HOST=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '\r')"
SMTP_PORT="$(grep '^SMTP_PORT=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '\r')"
SMTP_SECURE="$(grep '^SMTP_SECURE=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '\r')"
SMTP_USER="$(grep '^SMTP_USER=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '\r')"
SMTP_PASS="$(grep '^SMTP_PASS=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '\r')"
SMTP_FROM="$(grep '^SMTP_FROM=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '\r')"

if [ -z "$ADMIN_EMAIL" ] || [ -z "$ADMIN_PASSWORD" ] || [ -z "$MONGO_URI" ]; then
  echo -e "${RED}ADMIN_EMAIL / ADMIN_PASSWORD / MONGO_URI missing in backend/.env${NC}"
  exit 1
fi

if [ -z "$SMTP_HOST" ] || [ -z "$SMTP_PORT" ] || [ -z "$SMTP_SECURE" ] || [ -z "$SMTP_USER" ] || [ -z "$SMTP_PASS" ] || [ -z "$SMTP_FROM" ]; then
  echo -e "${RED}SMTP_HOST/PORT/SECURE/USER/PASS/FROM must be configured in backend/.env for this test${NC}"
  exit 1
fi

echo "======================================================="
echo "EMAIL FAILURE TESTS"
echo "======================================================="
echo ""

echo -e "${YELLOW}A) Startup fails fast with invalid SMTP config${NC}"
set +e
(
  cd "$BACKEND_DIR" || exit 1
  timeout 20 env \
    PORT=5012 \
    SMTP_HOST=invalid.smtp.local \
    SMTP_PORT=587 \
    SMTP_SECURE=false \
    SMTP_USER=invalid \
    SMTP_PASS=invalid \
    SMTP_FROM="$SMTP_FROM" \
    node server.js >"$BAD_STARTUP_LOG" 2>&1
)
BAD_EXIT=$?
set -e

if [ "$BAD_EXIT" = "0" ]; then
  echo -e "${RED}✗ Server started with invalid SMTP config${NC}"
  exit 1
fi
if [ "$BAD_EXIT" = "124" ]; then
  echo -e "${RED}✗ Server did not fail fast on invalid SMTP config (timeout)${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Server failed fast on invalid SMTP config${NC}"
echo ""

echo -e "${YELLOW}B) Register/Purchase rollback on send failure${NC}"
(
  cd "$BACKEND_DIR" || exit 1
  env \
    PORT=5001 \
    EMAIL_FORCE_FAIL_SEND=true \
    SMTP_HOST="$SMTP_HOST" \
    SMTP_PORT="$SMTP_PORT" \
    SMTP_SECURE="$SMTP_SECURE" \
    SMTP_USER="$SMTP_USER" \
    SMTP_PASS="$SMTP_PASS" \
    SMTP_FROM="$SMTP_FROM" \
    node server.js >"$FORCED_FAIL_LOG" 2>&1
) &
SERVER_PID=$!
sleep 4

if ! kill -0 "$SERVER_PID" 2>/dev/null; then
  echo -e "${RED}✗ Forced-failure test server did not start${NC}"
  cat "$FORCED_FAIL_LOG"
  exit 1
fi

STAMP="$(date +%s)"
CATEGORY_NAME="EmailFailCategory${STAMP}"
ORGANIZER_NAME="organizer${STAMP}"
PARTICIPANT_EMAIL="email.fail.participant.${STAMP}@iiit.ac.in"
PARTICIPANT2_EMAIL="email.fail.participant2.${STAMP}@iiit.ac.in"

REG_DEADLINE="2030-01-10T10:00:00.000Z"
START_DATE="2030-01-11T10:00:00.000Z"
END_DATE="2030-01-12T10:00:00.000Z"

api_call "POST" "$BASE_URL/auth/login" "" "$ADMIN_COOKIE" "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}"
expect_code "200" "Admin login"

api_call "POST" "$BASE_URL/clubs/categories" "$ADMIN_COOKIE" "" "{\"name\":\"$CATEGORY_NAME\",\"description\":\"Email failure test category\"}"
expect_code "201" "Create category"
CATEGORY_ID="$(json_get "$BODY" "category._id")" || { echo -e "${RED}Could not parse category id${NC}"; exit 1; }

CREATE_ORG_JSON="{\"organizerName\":\"$ORGANIZER_NAME\",\"category\":\"$CATEGORY_ID\",\"description\":\"Email failure test organizer\",\"contactNumber\":\"9999999999\"}"
api_call "POST" "$BASE_URL/clubs" "$ADMIN_COOKIE" "" "$CREATE_ORG_JSON"
expect_code "201" "Create organizer"
ORGANIZER_EMAIL="$(json_get "$BODY" "generatedCredentials.email")" || { echo -e "${RED}Could not parse organizer email${NC}"; exit 1; }
ORGANIZER_PASSWORD="$(json_get "$BODY" "generatedCredentials.password")" || { echo -e "${RED}Could not parse organizer password${NC}"; exit 1; }

api_call "POST" "$BASE_URL/auth/login" "" "$ORGANIZER_COOKIE" "{\"email\":\"$ORGANIZER_EMAIL\",\"password\":\"$ORGANIZER_PASSWORD\"}"
expect_code "200" "Organizer login"

REGISTER_JSON="{\"email\":\"$PARTICIPANT_EMAIL\",\"password\":\"password123\",\"firstName\":\"Fail\",\"lastName\":\"Case\",\"contactNumber\":\"9876543210\",\"participantType\":\"IIIT_PARTICIPANT\"}"
api_call "POST" "$BASE_URL/auth/register" "" "$PARTICIPANT_COOKIE" "$REGISTER_JSON"
expect_code "201" "Participant 1 register"

REGISTER2_JSON="{\"email\":\"$PARTICIPANT2_EMAIL\",\"password\":\"password123\",\"firstName\":\"Fail2\",\"lastName\":\"Case2\",\"contactNumber\":\"9876543211\",\"participantType\":\"IIIT_PARTICIPANT\"}"
api_call "POST" "$BASE_URL/auth/register" "" "$PARTICIPANT2_COOKIE" "$REGISTER2_JSON"
expect_code "201" "Participant 2 register"

CREATE_EVENT_JSON="{\"name\":\"Email Fail Normal $STAMP\",\"description\":\"Normal fail event\",\"type\":\"NORMAL\",\"eligibility\":\"ALL\",\"registrationDeadline\":\"$REG_DEADLINE\",\"startDate\":\"$START_DATE\",\"endDate\":\"$END_DATE\",\"registrationLimit\":100,\"registrationFee\":0,\"tags\":[\"email-fail\"],\"customFormSchema\":[{\"type\":\"text\",\"label\":\"Why join?\",\"required\":true,\"order\":0}],\"items\":[]}"
api_call "POST" "$BASE_URL/events" "$ORGANIZER_COOKIE" "" "$CREATE_EVENT_JSON"
expect_code "201" "Create normal event"
EVENT_ID="$(json_get "$BODY" "event._id")" || { echo -e "${RED}Could not parse normal event id${NC}"; exit 1; }
TEXT_FIELD_ID="$(json_get "$BODY" "event.customFormSchema.0.id")" || { echo -e "${RED}Could not parse generated normal field id${NC}"; exit 1; }
api_call "POST" "$BASE_URL/events/$EVENT_ID/publish" "$ORGANIZER_COOKIE" "" ""
expect_code "200" "Publish normal event"

api_call "POST" "$BASE_URL/events/$EVENT_ID/register" "$PARTICIPANT_COOKIE" "" "{\"responses\":{\"$TEXT_FIELD_ID\":\"forced email fail\"}}"
expect_code "502" "Normal registration fails on email"
REGISTER_FAIL_CODE="$(json_get "$BODY" "code")" || { echo -e "${RED}Could not parse error code for normal registration failure${NC}"; exit 1; }
if [ "$REGISTER_FAIL_CODE" != "EMAIL_DELIVERY_FAILED" ]; then
  echo -e "${RED}✗ Wrong error code for normal registration failure${NC}"
  exit 1
fi

MERCH_EVENT_JSON="{\"name\":\"Email Fail Merch $STAMP\",\"description\":\"Merch fail event\",\"type\":\"MERCHANDISE\",\"eligibility\":\"ALL\",\"registrationDeadline\":\"$REG_DEADLINE\",\"startDate\":\"$START_DATE\",\"endDate\":\"$END_DATE\",\"registrationLimit\":10,\"registrationFee\":0,\"tags\":[\"email-fail\"],\"customFormSchema\":[],\"items\":[{\"name\":\"T-Shirt\",\"description\":\"Fest Tee\",\"purchaseLimitPerParticipant\":1,\"variants\":[{\"size\":\"M\",\"color\":\"Black\",\"label\":\"M/Black\",\"price\":499,\"stockQty\":1}]}]}"
api_call "POST" "$BASE_URL/events" "$ORGANIZER_COOKIE" "" "$MERCH_EVENT_JSON"
expect_code "201" "Create merch event"
MERCH_EVENT_ID="$(json_get "$BODY" "event._id")" || { echo -e "${RED}Could not parse merch event id${NC}"; exit 1; }
MERCH_ITEM_ID="$(json_get "$BODY" "event.items.0.itemId")" || { echo -e "${RED}Could not parse generated merch item id${NC}"; exit 1; }
MERCH_VARIANT_ID="$(json_get "$BODY" "event.items.0.variants.0.variantId")" || { echo -e "${RED}Could not parse generated merch variant id${NC}"; exit 1; }
api_call "POST" "$BASE_URL/events/$MERCH_EVENT_ID/publish" "$ORGANIZER_COOKIE" "" ""
expect_code "200" "Publish merch event"

api_call "POST" "$BASE_URL/events/$MERCH_EVENT_ID/purchase" "$PARTICIPANT2_COOKIE" "" "{\"itemId\":\"$MERCH_ITEM_ID\",\"variantId\":\"$MERCH_VARIANT_ID\",\"quantity\":1}"
expect_code "201" "Merch purchase creates pending order"
MERCH_REGISTRATION_ID="$(json_get "$BODY" "registration._id")" || { echo -e "${RED}Could not parse merch registration id${NC}"; exit 1; }

PAYMENT_PROOF_FILE="$(mktemp --suffix=.pdf)"
echo "forced email failure proof" > "$PAYMENT_PROOF_FILE"
api_upload_file "$BASE_URL/events/registrations/$MERCH_REGISTRATION_ID/payment-proof" "$PARTICIPANT2_COOKIE" "$PAYMENT_PROOF_FILE"
expect_code "200" "Upload merch payment proof"

api_call "PATCH" "$BASE_URL/events/organizer/events/$MERCH_EVENT_ID/merch-orders/$MERCH_REGISTRATION_ID/review" "$ORGANIZER_COOKIE" "" "{\"status\":\"APPROVED\",\"reviewComment\":\"force send fail\"}"
expect_code "502" "Merch approval fails on email"
APPROVAL_FAIL_CODE="$(json_get "$BODY" "code")" || { echo -e "${RED}Could not parse error code for merch approval failure${NC}"; exit 1; }
if [ "$APPROVAL_FAIL_CODE" != "EMAIL_DELIVERY_FAILED" ]; then
  echo -e "${RED}✗ Wrong error code for merch approval failure${NC}"
  exit 1
fi

api_call "GET" "$BASE_URL/events/organizer/events/$EVENT_ID/participants" "$ORGANIZER_COOKIE" "" ""
expect_code "200" "Normal event participants check"
NORMAL_PARTICIPANTS_LEN="$(json_array_length "$BODY" "participants")" || { echo -e "${RED}Could not parse normal participants length${NC}"; exit 1; }
if [ "$NORMAL_PARTICIPANTS_LEN" != "0" ]; then
  echo -e "${RED}✗ Normal event registration was not rolled back${NC}"
  exit 1
fi

api_call "GET" "$BASE_URL/events/organizer/events/$MERCH_EVENT_ID/participants" "$ORGANIZER_COOKIE" "" ""
expect_code "200" "Merch event participants check"
MERCH_PARTICIPANTS_LEN="$(json_array_length "$BODY" "participants")" || { echo -e "${RED}Could not parse merch participants length${NC}"; exit 1; }
if [ "$MERCH_PARTICIPANTS_LEN" != "1" ]; then
  echo -e "${RED}✗ Merch pending order should remain after approval email failure${NC}"
  exit 1
fi
MERCH_TICKET_ID="$(json_get "$BODY" "participants.0.ticketId" || true)"
if [ -n "${MERCH_TICKET_ID:-}" ] && [ "$MERCH_TICKET_ID" != "null" ]; then
  echo -e "${RED}✗ Ticket should not remain after approval rollback${NC}"
  exit 1
fi

api_call "GET" "$BASE_URL/events/$MERCH_EVENT_ID" "$PARTICIPANT_COOKIE" "" ""
expect_code "200" "Merch event details for stock check"
RESTORED_STOCK="$(json_get "$BODY" "event.items.0.variants.0.stockQty")" || { echo -e "${RED}Could not parse restored stock${NC}"; exit 1; }
if [ "$RESTORED_STOCK" != "1" ]; then
  echo -e "${RED}✗ Merchandise stock was not restored (expected 1, got $RESTORED_STOCK)${NC}"
  exit 1
fi

(cd "$BACKEND_DIR" && node --input-type=module -e '
import mongoose from "mongoose";
const [uri, eventId, merchEventId] = process.argv.slice(1);
await mongoose.connect(uri);
const db = mongoose.connection.db;
const toObjectId = (id) => new mongoose.Types.ObjectId(id);
const normalRegCount = await db.collection("registrations").countDocuments({ eventId: toObjectId(eventId) });
const normalTicketCount = await db.collection("tickets").countDocuments({ eventId: toObjectId(eventId) });
const merchRegCount = await db.collection("registrations").countDocuments({ eventId: toObjectId(merchEventId) });
const merchTicketCount = await db.collection("tickets").countDocuments({ eventId: toObjectId(merchEventId) });
await mongoose.disconnect();
if (normalRegCount !== 0 || normalTicketCount !== 0 || merchRegCount !== 1 || merchTicketCount !== 0) {
  console.error(`Rollback DB check failed: normalReg=${normalRegCount}, normalTicket=${normalTicketCount}, merchReg=${merchRegCount}, merchTicket=${merchTicketCount}`);
  process.exit(1);
}
' "$MONGO_URI" "$EVENT_ID" "$MERCH_EVENT_ID")

echo -e "${GREEN}✓ Rollback checks passed for failed email sends${NC}"
echo ""
echo -e "${GREEN}All email failure tests passed successfully.${NC}"
