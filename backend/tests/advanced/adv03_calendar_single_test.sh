#!/bin/bash

set -u

BASE_URL="${BASE_URL:-http://localhost:5000/api}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../../.env"

ADMIN_COOKIE="$SCRIPT_DIR/.adv03_admin_cookie.txt"
ORGANIZER_COOKIE="$SCRIPT_DIR/.adv03_organizer_cookie.txt"
PARTICIPANT_COOKIE="$SCRIPT_DIR/.adv03_participant_cookie.txt"
OTHER_PARTICIPANT_COOKIE="$SCRIPT_DIR/.adv03_participant_other_cookie.txt"

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
CATEGORY_NAME="Adv03Category${STAMP}"
ORGANIZER_NAME="adv03org${STAMP}"
PARTICIPANT_EMAIL="adv03.participant.${STAMP}@iiit.ac.in"
OTHER_PARTICIPANT_EMAIL="adv03.other.${STAMP}@iiit.ac.in"
REG_DEADLINE="$(date -u -d '+1 day' +"%Y-%m-%dT%H:%M:%SZ")"
START_DATE="$(date -u -d '+2 day' +"%Y-%m-%dT%H:%M:%SZ")"
END_DATE="$(date -u -d '+3 day' +"%Y-%m-%dT%H:%M:%SZ")"

echo "============================================"
echo "ADV-03 CALENDAR SINGLE EVENT TESTS"
echo "============================================"
echo ""

echo -e "${YELLOW}1) Admin login${NC}"
api_call "POST" "$BASE_URL/auth/login" "" "$ADMIN_COOKIE" "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}"
expect_code "200" "Admin login"

echo -e "${YELLOW}2) Create category + organizer${NC}"
api_call "POST" "$BASE_URL/clubs/categories" "$ADMIN_COOKIE" "" "{\"name\":\"$CATEGORY_NAME\",\"description\":\"ADV03 category\"}"
expect_code "201" "Create category"
CATEGORY_ID="$(json_get "$BODY" "category._id")" || {
  echo -e "${RED}Could not parse category id${NC}"; cleanup; exit 1;
}

api_call "POST" "$BASE_URL/clubs" "$ADMIN_COOKIE" "" "{\"organizerName\":\"$ORGANIZER_NAME\",\"category\":\"$CATEGORY_ID\",\"description\":\"ADV03 organizer\",\"contactNumber\":\"9999999999\"}"
expect_code "201" "Create organizer"
ORGANIZER_EMAIL="$(json_get "$BODY" "generatedCredentials.email")" || {
  echo -e "${RED}Could not parse organizer email${NC}"; cleanup; exit 1;
}
ORGANIZER_PASSWORD="$(json_get "$BODY" "generatedCredentials.password")" || {
  echo -e "${RED}Could not parse organizer password${NC}"; cleanup; exit 1;
}

echo -e "${YELLOW}3) Organizer creates and publishes normal event${NC}"
api_call "POST" "$BASE_URL/auth/login" "" "$ORGANIZER_COOKIE" "{\"email\":\"$ORGANIZER_EMAIL\",\"password\":\"$ORGANIZER_PASSWORD\"}"
expect_code "200" "Organizer login"

EVENT_PAYLOAD="{\"name\":\"ADV03 Event $STAMP\",\"description\":\"Calendar export event\",\"type\":\"NORMAL\",\"eligibility\":\"ALL\",\"registrationDeadline\":\"$REG_DEADLINE\",\"startDate\":\"$START_DATE\",\"endDate\":\"$END_DATE\",\"registrationLimit\":50,\"registrationFee\":0,\"tags\":[\"adv03\"],\"customFormSchema\":[],\"items\":[]}"
api_call "POST" "$BASE_URL/events" "$ORGANIZER_COOKIE" "" "$EVENT_PAYLOAD"
expect_code "201" "Create event"
EVENT_ID="$(json_get "$BODY" "event._id")" || {
  echo -e "${RED}Could not parse event id${NC}"; cleanup; exit 1;
}

api_call "POST" "$BASE_URL/events/$EVENT_ID/publish" "$ORGANIZER_COOKIE" "" ""
expect_code "200" "Publish event"

echo -e "${YELLOW}4) Participant registers for event${NC}"
api_call "POST" "$BASE_URL/auth/register" "" "$PARTICIPANT_COOKIE" "{\"email\":\"$PARTICIPANT_EMAIL\",\"password\":\"password123\",\"firstName\":\"Adv\",\"lastName\":\"Three\",\"contactNumber\":\"9876543210\",\"participantType\":\"IIIT_PARTICIPANT\"}"
expect_code "201" "Participant register"

api_call "POST" "$BASE_URL/events/$EVENT_ID/register" "$PARTICIPANT_COOKIE" "" "{\"responses\":{}}"
expect_code "201" "Participant event registration"
REGISTRATION_ID="$(json_get "$BODY" "registration._id")" || {
  echo -e "${RED}Could not parse registration id${NC}"; cleanup; exit 1;
}

echo -e "${YELLOW}5) Owner participant downloads ICS${NC}"
api_call "GET" "$BASE_URL/calendar/registrations/$REGISTRATION_ID.ics" "$PARTICIPANT_COOKIE" "" ""
expect_code "200" "Calendar ICS download"
if ! echo "$HEADERS" | grep -iq "content-type: text/calendar"; then
  echo -e "${RED}Expected text/calendar content type${NC}"
  cleanup
  exit 1
fi
if ! echo "$BODY" | grep -q "BEGIN:VCALENDAR"; then
  echo -e "${RED}ICS missing BEGIN:VCALENDAR${NC}"
  cleanup
  exit 1
fi
if ! echo "$BODY" | grep -q "BEGIN:VEVENT"; then
  echo -e "${RED}ICS missing BEGIN:VEVENT${NC}"
  cleanup
  exit 1
fi

echo -e "${YELLOW}6) Owner participant fetches provider links${NC}"
api_call "GET" "$BASE_URL/calendar/registrations/$REGISTRATION_ID/links" "$PARTICIPANT_COOKIE" "" ""
expect_code "200" "Calendar links"
GOOGLE_LINK="$(json_get "$BODY" "links.google")" || {
  echo -e "${RED}Could not parse google link${NC}"; cleanup; exit 1;
}
OUTLOOK_LINK="$(json_get "$BODY" "links.outlook")" || {
  echo -e "${RED}Could not parse outlook link${NC}"; cleanup; exit 1;
}
if [ -z "$GOOGLE_LINK" ] || [ -z "$OUTLOOK_LINK" ]; then
  echo -e "${RED}Calendar links are empty${NC}"
  cleanup
  exit 1
fi

echo -e "${YELLOW}7) Another participant cannot access owner registration calendar${NC}"
api_call "POST" "$BASE_URL/auth/register" "" "$OTHER_PARTICIPANT_COOKIE" "{\"email\":\"$OTHER_PARTICIPANT_EMAIL\",\"password\":\"password123\",\"firstName\":\"Adv\",\"lastName\":\"Other\",\"contactNumber\":\"9876543211\",\"participantType\":\"NON_IIIT_PARTICIPANT\",\"collegeOrgName\":\"Other College\"}"
expect_code "201" "Other participant register"

api_call "GET" "$BASE_URL/calendar/registrations/$REGISTRATION_ID.ics" "$OTHER_PARTICIPANT_COOKIE" "" ""
expect_code "403" "Unauthorized ICS access denied"

api_call "GET" "$BASE_URL/calendar/registrations/$REGISTRATION_ID/links" "$OTHER_PARTICIPANT_COOKIE" "" ""
expect_code "403" "Unauthorized links access denied"

echo -e "${GREEN}ADV-03 tests passed.${NC}"
cleanup
