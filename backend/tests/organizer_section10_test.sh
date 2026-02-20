#!/bin/bash

set -u

BASE_URL="${BASE_URL:-http://localhost:5000/api}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

ADMIN_COOKIE="$SCRIPT_DIR/.org10_admin_cookies.txt"
ORGANIZER_COOKIE="$SCRIPT_DIR/.org10_organizer_cookies.txt"
PARTICIPANT_COOKIE="$SCRIPT_DIR/.org10_participant_cookies.txt"

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
const obj = JSON.parse(input);
let cur = obj;
for (const part of path) {
  if (!part) continue;
  if (cur == null) process.exit(1);
  cur = /^\d+$/.test(part) ? cur[Number(part)] : cur[part];
}
if (cur === undefined || cur === null) process.exit(1);
process.stdout.write(typeof cur === "object" ? JSON.stringify(cur) : String(cur));
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
    echo -e "${GREEN}✓ ${label}${NC}"
  else
    echo -e "${RED}✗ ${label} (expected $expected got $HTTP_CODE)${NC}"
    echo "Response: $BODY"
    cleanup
    exit 1
  fi
}

if [ ! -f "$ENV_FILE" ]; then
  echo -e "${RED}Missing backend .env${NC}"
  exit 1
fi

ADMIN_EMAIL="$(grep '^ADMIN_EMAIL=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '\r')"
ADMIN_PASSWORD="$(grep '^ADMIN_PASSWORD=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '\r')"

cleanup

STAMP="$(date +%s)"
CATEGORY_NAME="Org10Category${STAMP}"
ORGANIZER_NAME="org10${STAMP}"
PARTICIPANT_EMAIL="org10.participant.${STAMP}@iiit.ac.in"

REG_DEADLINE="2030-02-10T10:00:00.000Z"
START_DATE="2030-02-11T10:00:00.000Z"
END_DATE="2030-02-12T10:00:00.000Z"

echo -e "${YELLOW}1) Admin login${NC}"
api_call "POST" "$BASE_URL/auth/login" "" "$ADMIN_COOKIE" "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}"
expect_code "200" "Admin login"

echo -e "${YELLOW}2) Create category + organizer${NC}"
api_call "POST" "$BASE_URL/clubs/categories" "$ADMIN_COOKIE" "" "{\"name\":\"$CATEGORY_NAME\",\"description\":\"Org10 category\"}"
expect_code "201" "Create category"
CATEGORY_ID="$(json_get "$BODY" "category._id")"

api_call "POST" "$BASE_URL/clubs" "$ADMIN_COOKIE" "" "{\"organizerName\":\"$ORGANIZER_NAME\",\"category\":\"$CATEGORY_ID\",\"description\":\"Org10 organizer\",\"contactNumber\":\"9999999999\"}"
expect_code "201" "Create organizer"
ORGANIZER_EMAIL="$(json_get "$BODY" "generatedCredentials.email")"
ORGANIZER_PASSWORD="$(json_get "$BODY" "generatedCredentials.password")"

echo -e "${YELLOW}3) Organizer login${NC}"
api_call "POST" "$BASE_URL/auth/login" "" "$ORGANIZER_COOKIE" "{\"email\":\"$ORGANIZER_EMAIL\",\"password\":\"$ORGANIZER_PASSWORD\"}"
expect_code "200" "Organizer login"

echo -e "${YELLOW}4) Update organizer profile incl webhook URL${NC}"
api_call "PUT" "$BASE_URL/user/profile" "$ORGANIZER_COOKIE" "" "{\"organizerName\":\"$ORGANIZER_NAME\",\"category\":\"$CATEGORY_ID\",\"description\":\"Updated desc\",\"contactNumber\":\"9999999998\",\"discordWebhookUrl\":\"https://invalid.example/webhook\"}"
expect_code "200" "Organizer profile update"

echo -e "${YELLOW}5) Create draft event${NC}"
CREATE_EVENT_JSON="{\"name\":\"Org10 Event $STAMP\",\"description\":\"Section10 event\",\"type\":\"NORMAL\",\"eligibility\":\"ALL\",\"registrationDeadline\":\"$REG_DEADLINE\",\"startDate\":\"$START_DATE\",\"endDate\":\"$END_DATE\",\"registrationLimit\":50,\"registrationFee\":20,\"tags\":[\"org10\"],\"customFormSchema\":[{\"type\":\"text\",\"label\":\"Why join?\",\"required\":true,\"order\":0}],\"items\":[]}"
api_call "POST" "$BASE_URL/events" "$ORGANIZER_COOKIE" "" "$CREATE_EVENT_JSON"
expect_code "201" "Create draft event"
EVENT_ID="$(json_get "$BODY" "event._id")"

echo -e "${YELLOW}6) Publish should fail on webhook delivery${NC}"
api_call "POST" "$BASE_URL/events/$EVENT_ID/publish" "$ORGANIZER_COOKIE" "" ""
expect_code "400" "Publish fails when webhook fails"

echo -e "${YELLOW}7) Remove webhook and publish successfully${NC}"
api_call "PUT" "$BASE_URL/user/profile" "$ORGANIZER_COOKIE" "" "{\"discordWebhookUrl\":\"\"}"
expect_code "200" "Clear webhook URL"
api_call "POST" "$BASE_URL/events/$EVENT_ID/publish" "$ORGANIZER_COOKIE" "" ""
expect_code "200" "Publish event"

echo -e "${YELLOW}8) Start, close, complete lifecycle${NC}"
api_call "POST" "$BASE_URL/events/$EVENT_ID/start" "$ORGANIZER_COOKIE" "" ""
expect_code "200" "Start event"
api_call "POST" "$BASE_URL/events/$EVENT_ID/close" "$ORGANIZER_COOKIE" "" ""
expect_code "200" "Close event"
api_call "POST" "$BASE_URL/events/$EVENT_ID/complete" "$ORGANIZER_COOKIE" "" ""
expect_code "200" "Complete event"

echo -e "${YELLOW}9) Organizer list summary includes completed summary${NC}"
api_call "GET" "$BASE_URL/events/organizer/events?includeCompletedSummary=true" "$ORGANIZER_COOKIE" "" ""
expect_code "200" "Organizer events list"
SUMMARY_REG="$(json_get "$BODY" "completedSummary.registrations")" || {
  echo -e "${RED}Could not parse completedSummary${NC}"; cleanup; exit 1;
}
if [ -z "$SUMMARY_REG" ]; then
  echo -e "${RED}✗ completedSummary missing${NC}"
  cleanup
  exit 1
fi

echo -e "${YELLOW}10) Organizer detail analytics endpoint${NC}"
api_call "GET" "$BASE_URL/events/organizer/events/$EVENT_ID/analytics" "$ORGANIZER_COOKIE" "" ""
expect_code "200" "Organizer event analytics"
TEAM_RATE="$(json_get "$BODY" "analytics.teamCompletionRate")" || {
  echo -e "${RED}Missing teamCompletionRate${NC}"; cleanup; exit 1;
}
if [ -z "$TEAM_RATE" ]; then
  echo -e "${RED}✗ teamCompletionRate missing${NC}"
  cleanup
  exit 1
fi

echo -e "${GREEN}Organizer Section 10 test passed.${NC}"
cleanup
