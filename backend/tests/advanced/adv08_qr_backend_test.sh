#!/bin/bash

set -u

BASE_URL="${BASE_URL:-http://localhost:5000/api}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../../.env"

ADMIN_COOKIE="$SCRIPT_DIR/.adv08_admin_cookie.txt"
ORGANIZER_COOKIE="$SCRIPT_DIR/.adv08_organizer_cookie.txt"
PARTICIPANT1_COOKIE="$SCRIPT_DIR/.adv08_participant1_cookie.txt"
PARTICIPANT2_COOKIE="$SCRIPT_DIR/.adv08_participant2_cookie.txt"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

RESPONSE=""
HTTP_CODE=""
BODY=""

cleanup() {
  rm -f "$ADMIN_COOKIE" "$ORGANIZER_COOKIE" "$PARTICIPANT1_COOKIE" "$PARTICIPANT2_COOKIE"
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
CATEGORY_NAME="Adv08Category${STAMP}"
ORGANIZER_NAME="adv08org${STAMP}"
PARTICIPANT1_EMAIL="adv08.participant1.${STAMP}@iiit.ac.in"
PARTICIPANT2_EMAIL="adv08.participant2.${STAMP}@iiit.ac.in"
REG_DEADLINE="$(date -u -d '+1 day' +"%Y-%m-%dT%H:%M:%SZ")"
START_DATE="$(date -u -d '+2 day' +"%Y-%m-%dT%H:%M:%SZ")"
END_DATE="$(date -u -d '+3 day' +"%Y-%m-%dT%H:%M:%SZ")"

echo "============================================"
echo "ADV-08 QR ATTENDANCE BACKEND TESTS"
echo "============================================"
echo ""

echo -e "${YELLOW}1) Admin login + organizer setup${NC}"
api_call "POST" "$BASE_URL/auth/login" "" "$ADMIN_COOKIE" "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}"
expect_code "200" "Admin login"

api_call "POST" "$BASE_URL/clubs/categories" "$ADMIN_COOKIE" "" "{\"name\":\"$CATEGORY_NAME\",\"description\":\"ADV08 category\"}"
expect_code "201" "Create category"
CATEGORY_ID="$(json_get "$BODY" "category._id")" || {
  echo -e "${RED}Could not parse category id${NC}"; cleanup; exit 1;
}

api_call "POST" "$BASE_URL/clubs" "$ADMIN_COOKIE" "" "{\"organizerName\":\"$ORGANIZER_NAME\",\"category\":\"$CATEGORY_ID\",\"description\":\"ADV08 organizer\",\"contactNumber\":\"9999999999\"}"
expect_code "201" "Create organizer"
ORGANIZER_EMAIL="$(json_get "$BODY" "generatedCredentials.email")" || {
  echo -e "${RED}Could not parse organizer email${NC}"; cleanup; exit 1;
}
ORGANIZER_PASSWORD="$(json_get "$BODY" "generatedCredentials.password")" || {
  echo -e "${RED}Could not parse organizer password${NC}"; cleanup; exit 1;
}

echo -e "${YELLOW}2) Organizer creates and publishes event${NC}"
api_call "POST" "$BASE_URL/auth/login" "" "$ORGANIZER_COOKIE" "{\"email\":\"$ORGANIZER_EMAIL\",\"password\":\"$ORGANIZER_PASSWORD\"}"
expect_code "200" "Organizer login"

EVENT_JSON="{\"name\":\"ADV08 QR Event $STAMP\",\"description\":\"QR scan flow\",\"type\":\"NORMAL\",\"eligibility\":\"ALL\",\"registrationDeadline\":\"$REG_DEADLINE\",\"startDate\":\"$START_DATE\",\"endDate\":\"$END_DATE\",\"registrationLimit\":10,\"registrationFee\":0,\"tags\":[\"adv08\"],\"customFormSchema\":[],\"items\":[]}"
api_call "POST" "$BASE_URL/events" "$ORGANIZER_COOKIE" "" "$EVENT_JSON"
expect_code "201" "Create event"
EVENT_ID="$(json_get "$BODY" "event._id")" || {
  echo -e "${RED}Could not parse event id${NC}"; cleanup; exit 1;
}

api_call "POST" "$BASE_URL/events/$EVENT_ID/publish" "$ORGANIZER_COOKIE" "" ""
expect_code "200" "Publish event"

echo -e "${YELLOW}3) Two participants register${NC}"
api_call "POST" "$BASE_URL/auth/register" "" "$PARTICIPANT1_COOKIE" "{\"email\":\"$PARTICIPANT1_EMAIL\",\"password\":\"password123\",\"firstName\":\"QR\",\"lastName\":\"One\",\"contactNumber\":\"9876543210\",\"participantType\":\"IIIT_PARTICIPANT\"}"
expect_code "201" "Participant1 register"

api_call "POST" "$BASE_URL/events/$EVENT_ID/register" "$PARTICIPANT1_COOKIE" "" "{\"responses\":{}}"
expect_code "201" "Participant1 event registration"
REG1_ID="$(json_get "$BODY" "registration._id")" || {
  echo -e "${RED}Could not parse reg1 id${NC}"; cleanup; exit 1;
}
TICKET1_ID="$(json_get "$BODY" "ticket.ticketId")" || {
  echo -e "${RED}Could not parse ticket1 id${NC}"; cleanup; exit 1;
}

api_call "POST" "$BASE_URL/auth/register" "" "$PARTICIPANT2_COOKIE" "{\"email\":\"$PARTICIPANT2_EMAIL\",\"password\":\"password123\",\"firstName\":\"QR\",\"lastName\":\"Two\",\"contactNumber\":\"9876543211\",\"participantType\":\"IIIT_PARTICIPANT\"}"
expect_code "201" "Participant2 register"

api_call "POST" "$BASE_URL/events/$EVENT_ID/register" "$PARTICIPANT2_COOKIE" "" "{\"responses\":{}}"
expect_code "201" "Participant2 event registration"
REG2_ID="$(json_get "$BODY" "registration._id")" || {
  echo -e "${RED}Could not parse reg2 id${NC}"; cleanup; exit 1;
}

echo -e "${YELLOW}4) Organizer scans valid QR${NC}"
api_call "GET" "$BASE_URL/tickets/$TICKET1_ID" "$PARTICIPANT1_COOKIE" "" ""
expect_code "200" "Get ticket details for QR payload"
QR_PAYLOAD_JSON="$(json_get "$BODY" "ticket.qrPayload")" || {
  echo -e "${RED}Could not parse qr payload${NC}"; cleanup; exit 1;
}

api_call "POST" "$BASE_URL/events/organizer/events/$EVENT_ID/attendance/scan" "$ORGANIZER_COOKIE" "" "{\"qrPayload\":$QR_PAYLOAD_JSON}"
expect_code "200" "First valid scan marks attendance"

echo -e "${YELLOW}5) Duplicate scan is rejected${NC}"
api_call "POST" "$BASE_URL/events/organizer/events/$EVENT_ID/attendance/scan" "$ORGANIZER_COOKIE" "" "{\"qrPayload\":$QR_PAYLOAD_JSON}"
expect_code "409" "Duplicate scan returns conflict"

echo -e "${YELLOW}6) Invalid scan payload is rejected${NC}"
INVALID_QR_PAYLOAD="$(echo "$QR_PAYLOAD_JSON" | node -e '
const fs = require("fs");
const input = fs.readFileSync(0, "utf8");
const payload = JSON.parse(input);
payload.ticketId = `${payload.ticketId}-invalid`;
process.stdout.write(JSON.stringify(payload));
')"
api_call "POST" "$BASE_URL/events/organizer/events/$EVENT_ID/attendance/scan" "$ORGANIZER_COOKIE" "" "{\"qrPayload\":$INVALID_QR_PAYLOAD}"
expect_code "400" "Invalid scan rejected"

echo -e "${YELLOW}7) Live summary reflects scan counts${NC}"
api_call "GET" "$BASE_URL/events/organizer/events/$EVENT_ID/attendance/live" "$ORGANIZER_COOKIE" "" ""
expect_code "200" "Live attendance summary"
ATTENDED_COUNT="$(json_get "$BODY" "summary.attendedCount")" || {
  echo -e "${RED}Could not parse attended count${NC}"; cleanup; exit 1;
}
UNATTENDED_COUNT="$(json_get "$BODY" "summary.unattendedCount")" || {
  echo -e "${RED}Could not parse unattended count${NC}"; cleanup; exit 1;
}
if [ "$ATTENDED_COUNT" != "1" ] || [ "$UNATTENDED_COUNT" != "1" ]; then
  echo -e "${RED}Unexpected live summary counts attended=$ATTENDED_COUNT unattended=$UNATTENDED_COUNT${NC}"
  cleanup
  exit 1
fi

HAS_DUPLICATE_LOG="$(echo "$BODY" | node -e '
const fs = require("fs");
const body = JSON.parse(fs.readFileSync(0, "utf8"));
const has = (body.summary?.recentLogs || []).some((log) => log.action === "SCAN_DUPLICATE");
process.stdout.write(has ? "yes" : "no");
')"
if [ "$HAS_DUPLICATE_LOG" != "yes" ]; then
  echo -e "${RED}Expected SCAN_DUPLICATE in recent logs${NC}"
  cleanup
  exit 1
fi

echo -e "${YELLOW}8) Manual override marks second participant attendance${NC}"
api_call "POST" "$BASE_URL/events/organizer/events/$EVENT_ID/attendance/override" "$ORGANIZER_COOKIE" "" "{\"registrationId\":\"$REG2_ID\",\"attended\":true,\"reason\":\"Manual gate approval\"}"
expect_code "200" "Manual override success"

api_call "GET" "$BASE_URL/events/organizer/events/$EVENT_ID/attendance/live" "$ORGANIZER_COOKIE" "" ""
expect_code "200" "Live summary after override"
ATTENDED_COUNT2="$(json_get "$BODY" "summary.attendedCount")" || {
  echo -e "${RED}Could not parse attended count after override${NC}"; cleanup; exit 1;
}
UNATTENDED_COUNT2="$(json_get "$BODY" "summary.unattendedCount")" || {
  echo -e "${RED}Could not parse unattended count after override${NC}"; cleanup; exit 1;
}
if [ "$ATTENDED_COUNT2" != "2" ] || [ "$UNATTENDED_COUNT2" != "0" ]; then
  echo -e "${RED}Unexpected post-override counts attended=$ATTENDED_COUNT2 unattended=$UNATTENDED_COUNT2${NC}"
  cleanup
  exit 1
fi
HAS_OVERRIDE_LOG="$(echo "$BODY" | node -e '
const fs = require("fs");
const body = JSON.parse(fs.readFileSync(0, "utf8"));
const has = (body.summary?.recentLogs || []).some((log) => log.action === "MANUAL_OVERRIDE");
process.stdout.write(has ? "yes" : "no");
')"
if [ "$HAS_OVERRIDE_LOG" != "yes" ]; then
  echo -e "${RED}Expected MANUAL_OVERRIDE in recent logs${NC}"
  cleanup
  exit 1
fi

echo -e "${GREEN}ADV-08 tests passed.${NC}"
cleanup
