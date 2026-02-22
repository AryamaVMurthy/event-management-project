#!/bin/bash

set -u

BASE_URL="${BASE_URL:-http://localhost:5000/api}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

ADMIN_COOKIE="$SCRIPT_DIR/.draft_file_admin_cookies.txt"
ORGANIZER_COOKIE="$SCRIPT_DIR/.draft_file_organizer_cookies.txt"
PARTICIPANT_COOKIE="$SCRIPT_DIR/.draft_file_participant_cookies.txt"
PARTICIPANT2_COOKIE="$SCRIPT_DIR/.draft_file_participant2_cookies.txt"
UPLOAD_FILE="$SCRIPT_DIR/.draft_file_upload.txt"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

RESPONSE=""
HTTP_CODE=""
BODY=""

cleanup() {
  rm -f \
    "$ADMIN_COOKIE" \
    "$ORGANIZER_COOKIE" \
    "$PARTICIPANT_COOKIE" \
    "$PARTICIPANT2_COOKIE" \
    "$UPLOAD_FILE"
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
CATEGORY_NAME="DraftFileCategory${STAMP}"
ORGANIZER_NAME="draftfileorg${STAMP}"
PARTICIPANT_EMAIL="draft.file.participant.${STAMP}@iiit.ac.in"
PARTICIPANT2_EMAIL="draft.file.participant2.${STAMP}@iiit.ac.in"

REG_DEADLINE="2030-03-10T10:00:00.000Z"
START_DATE="2030-03-11T10:00:00.000Z"
END_DATE="2030-03-12T10:00:00.000Z"

echo "============================================"
echo "DRAFT DELETE + FILE ACCESS TESTS"
echo "============================================"
echo ""

echo -e "${YELLOW}1) Admin login${NC}"
api_call "POST" "$BASE_URL/auth/login" "" "$ADMIN_COOKIE" "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}"
expect_code "200" "Admin login"

echo -e "${YELLOW}2) Create category + organizer${NC}"
api_call "POST" "$BASE_URL/clubs/categories" "$ADMIN_COOKIE" "" "{\"name\":\"$CATEGORY_NAME\",\"description\":\"Draft/File test category\"}"
expect_code "201" "Create category"
CATEGORY_ID="$(json_get "$BODY" "category._id")" || {
  echo -e "${RED}Could not parse category id${NC}"; cleanup; exit 1;
}
api_call "POST" "$BASE_URL/clubs" "$ADMIN_COOKIE" "" "{\"organizerName\":\"$ORGANIZER_NAME\",\"category\":\"$CATEGORY_ID\",\"description\":\"Draft/File organizer\",\"contactNumber\":\"9999999999\"}"
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

echo -e "${YELLOW}3) Organizer login${NC}"
api_call "POST" "$BASE_URL/auth/login" "" "$ORGANIZER_COOKIE" "{\"email\":\"$ORGANIZER_EMAIL\",\"password\":\"$ORGANIZER_PASSWORD\"}"
expect_code "200" "Organizer login"

echo -e "${YELLOW}4) Create draft event then delete it${NC}"
DRAFT_EVENT_JSON="{\"name\":\"Draft Delete Event $STAMP\",\"description\":\"Delete me\",\"type\":\"NORMAL\",\"eligibility\":\"ALL\",\"registrationDeadline\":\"$REG_DEADLINE\",\"startDate\":\"$START_DATE\",\"endDate\":\"$END_DATE\",\"registrationLimit\":10,\"registrationFee\":0,\"tags\":[\"draft\"],\"customFormSchema\":[{\"type\":\"text\",\"label\":\"Why join?\",\"required\":true,\"order\":0}],\"items\":[]}"
api_call "POST" "$BASE_URL/events" "$ORGANIZER_COOKIE" "" "$DRAFT_EVENT_JSON"
expect_code "201" "Create draft"
DRAFT_EVENT_ID="$(json_get "$BODY" "event._id")" || {
  echo -e "${RED}Could not parse draft event id${NC}"; cleanup; exit 1;
}
api_call "DELETE" "$BASE_URL/events/$DRAFT_EVENT_ID" "$ORGANIZER_COOKIE" "" ""
expect_code "200" "Delete draft event"
api_call "GET" "$BASE_URL/events/organizer/events/$DRAFT_EVENT_ID" "$ORGANIZER_COOKIE" "" ""
expect_code "404" "Deleted draft is not retrievable"

echo -e "${YELLOW}5) Participant registrations for file access checks${NC}"
api_call "POST" "$BASE_URL/auth/register" "" "$PARTICIPANT_COOKIE" "{\"email\":\"$PARTICIPANT_EMAIL\",\"password\":\"password123\",\"firstName\":\"Draft\",\"lastName\":\"Owner\",\"contactNumber\":\"9876543210\",\"participantType\":\"IIIT_PARTICIPANT\"}"
expect_code "201" "Participant 1 register"
api_call "POST" "$BASE_URL/auth/register" "" "$PARTICIPANT2_COOKIE" "{\"email\":\"$PARTICIPANT2_EMAIL\",\"password\":\"password123\",\"firstName\":\"Draft\",\"lastName\":\"Other\",\"contactNumber\":\"9876543211\",\"participantType\":\"IIIT_PARTICIPANT\"}"
expect_code "201" "Participant 2 register"

echo -e "${YELLOW}6) Create publishable event with file field${NC}"
FILE_EVENT_JSON="{\"name\":\"File Access Event $STAMP\",\"description\":\"File endpoint test\",\"type\":\"NORMAL\",\"eligibility\":\"ALL\",\"registrationDeadline\":\"$REG_DEADLINE\",\"startDate\":\"$START_DATE\",\"endDate\":\"$END_DATE\",\"registrationLimit\":20,\"registrationFee\":0,\"tags\":[\"files\"],\"customFormSchema\":[{\"type\":\"text\",\"label\":\"Why join?\",\"required\":true,\"order\":0},{\"type\":\"file\",\"label\":\"Proof\",\"required\":true,\"allowedMimeTypes\":[\"text/plain\"],\"maxFileSizeMB\":1,\"order\":1}],\"items\":[]}"
api_call "POST" "$BASE_URL/events" "$ORGANIZER_COOKIE" "" "$FILE_EVENT_JSON"
expect_code "201" "Create file event"
EVENT_ID="$(json_get "$BODY" "event._id")" || {
  echo -e "${RED}Could not parse file event id${NC}"; cleanup; exit 1;
}
TEXT_FIELD_ID="$(json_get "$BODY" "event.customFormSchema.0.id")" || {
  echo -e "${RED}Could not parse text field id${NC}"; cleanup; exit 1;
}
FILE_FIELD_ID="$(json_get "$BODY" "event.customFormSchema.1.id")" || {
  echo -e "${RED}Could not parse file field id${NC}"; cleanup; exit 1;
}
api_call "POST" "$BASE_URL/events/$EVENT_ID/publish" "$ORGANIZER_COOKIE" "" ""
expect_code "200" "Publish file event"

echo "uploaded file content" > "$UPLOAD_FILE"
RESPONSES_JSON="{\"$TEXT_FIELD_ID\":\"file test\"}"
RESPONSE="$(curl -s -w "\n%{http_code}" -X POST \
  -b "$PARTICIPANT_COOKIE" \
  -F "responses=$RESPONSES_JSON" \
  -F "$FILE_FIELD_ID=@$UPLOAD_FILE;type=text/plain" \
  "$BASE_URL/events/$EVENT_ID/register")"
HTTP_CODE="$(echo "$RESPONSE" | tail -n1)"
BODY="$(echo "$RESPONSE" | sed '$d')"
expect_code "201" "Participant registers with file"
REGISTRATION_ID="$(json_get "$BODY" "registration._id")" || {
  echo -e "${RED}Could not parse registration id${NC}"; cleanup; exit 1;
}

echo -e "${YELLOW}7) File list access checks${NC}"
api_call "GET" "$BASE_URL/events/registrations/$REGISTRATION_ID/files" "$PARTICIPANT_COOKIE" "" ""
expect_code "200" "Owner participant can list files"
LIST_FIELD_ID="$(json_get "$BODY" "files.0.fieldId")" || {
  echo -e "${RED}Could not parse fieldId from file list${NC}"; cleanup; exit 1;
}
if [ "$LIST_FIELD_ID" != "$FILE_FIELD_ID" ]; then
  echo -e "${RED}✗ Returned fieldId does not match uploaded file field${NC}"
  cleanup
  exit 1
fi
api_call "GET" "$BASE_URL/events/registrations/$REGISTRATION_ID/files" "$ORGANIZER_COOKIE" "" ""
expect_code "200" "Organizer can list files"
api_call "GET" "$BASE_URL/events/registrations/$REGISTRATION_ID/files" "$ADMIN_COOKIE" "" ""
expect_code "200" "Admin can list files"
api_call "GET" "$BASE_URL/events/registrations/$REGISTRATION_ID/files" "$PARTICIPANT2_COOKIE" "" ""
expect_code "403" "Non-owner participant blocked from file list"

echo -e "${YELLOW}8) File download access checks${NC}"
RESPONSE="$(curl -s -w "\n%{http_code}" -X GET -b "$PARTICIPANT_COOKIE" "$BASE_URL/events/files/$REGISTRATION_ID/$FILE_FIELD_ID")"
HTTP_CODE="$(echo "$RESPONSE" | tail -n1)"
BODY="$(echo "$RESPONSE" | sed '$d')"
expect_code "200" "Owner participant can download file"
RESPONSE="$(curl -s -w "\n%{http_code}" -X GET -b "$PARTICIPANT2_COOKIE" "$BASE_URL/events/files/$REGISTRATION_ID/$FILE_FIELD_ID")"
HTTP_CODE="$(echo "$RESPONSE" | tail -n1)"
BODY="$(echo "$RESPONSE" | sed '$d')"
expect_code "403" "Non-owner participant blocked from file download"

echo -e "${YELLOW}9) Admin organizer traversal checks${NC}"
api_call "GET" "$BASE_URL/events/organizer/events?organizerId=$ORGANIZER_ID" "$ADMIN_COOKIE" "" ""
expect_code "200" "Admin organizer event list"
if echo "$BODY" | grep -q "\"_id\":\"$EVENT_ID\""; then
  echo -e "${GREEN}✓ Admin list includes organizer event${NC}"
else
  echo -e "${RED}✗ Admin list missing organizer event${NC}"
  cleanup
  exit 1
fi
api_call "GET" "$BASE_URL/events/organizer/events/$EVENT_ID" "$ADMIN_COOKIE" "" ""
expect_code "200" "Admin can view organizer event details"
api_call "GET" "$BASE_URL/events/organizer/events/$EVENT_ID/participants" "$ADMIN_COOKIE" "" ""
expect_code "200" "Admin can view organizer participants"

echo -e "${GREEN}Draft delete + file access tests passed.${NC}"
cleanup
