#!/bin/bash

# ============================================
# FELICITY EVENTS API - END TO END TEST SCRIPT
# ============================================
# Usage: ./tests/event_test.sh
# Make sure server is running on localhost:5000
# ============================================

set -u

BASE_URL="${BASE_URL:-http://localhost:5000/api}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

ADMIN_COOKIE="$SCRIPT_DIR/.event_admin_cookies.txt"
ORGANIZER_COOKIE="$SCRIPT_DIR/.event_organizer_cookies.txt"
PARTICIPANT_COOKIE="$SCRIPT_DIR/.event_participant_cookies.txt"
PARTICIPANT2_COOKIE="$SCRIPT_DIR/.event_participant2_cookies.txt"
TEST_UPLOAD_FILE="$SCRIPT_DIR/.event_test_upload.txt"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

RESPONSE=""
HTTP_CODE=""
BODY=""

cleanup() {
  rm -f "$ADMIN_COOKIE" "$ORGANIZER_COOKIE" "$PARTICIPANT_COOKIE" "$PARTICIPANT2_COOKIE" "$TEST_UPLOAD_FILE"
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
CATEGORY_NAME="EventsTestCategory${STAMP}"
ORGANIZER_NAME="organizer${STAMP}"
PARTICIPANT_EMAIL="events.participant.${STAMP}@iiit.ac.in"
PARTICIPANT2_EMAIL="events.participant2.${STAMP}@iiit.ac.in"

REG_DEADLINE="2030-01-10T10:00:00.000Z"
START_DATE="2030-01-11T10:00:00.000Z"
END_DATE="2030-01-12T10:00:00.000Z"

echo "============================================"
echo "FELICITY EVENTS API - END TO END TESTS"
echo "============================================"
echo ""

# 1) Admin login
echo -e "${YELLOW}1) Admin login${NC}"
api_call "POST" "$BASE_URL/auth/login" "" "$ADMIN_COOKIE" "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}"
expect_code "200" "Admin login"
echo ""

# 1.1) Email health endpoint
echo -e "${YELLOW}1.1) Email health${NC}"
api_call "GET" "$BASE_URL/system/email-health" "$ADMIN_COOKIE" "" ""
expect_code "200" "Email health"
EMAIL_HEALTH_OK="$(json_get "$BODY" "ok")" || {
  echo -e "${RED}Could not parse email health ok${NC}"; cleanup; exit 1;
}
EMAIL_HEALTH_MODE="$(json_get "$BODY" "mode")" || {
  echo -e "${RED}Could not parse email health mode${NC}"; cleanup; exit 1;
}
if [ "$EMAIL_HEALTH_OK" != "true" ] || [ "$EMAIL_HEALTH_MODE" != "smtp" ]; then
  echo -e "${RED}✗ Email health is not ready${NC}"
  cleanup
  exit 1
fi
echo -e "${GREEN}✓ Email health reports SMTP ready${NC}"
echo ""

# 2) Create category
echo -e "${YELLOW}2) Create category${NC}"
api_call "POST" "$BASE_URL/clubs/categories" "$ADMIN_COOKIE" "" "{\"name\":\"$CATEGORY_NAME\",\"description\":\"Test category\"}"
expect_code "201" "Create category"
CATEGORY_ID="$(json_get "$BODY" "category._id")" || {
  echo -e "${RED}Could not parse category id${NC}"; cleanup; exit 1;
}
echo "Category ID: $CATEGORY_ID"
echo ""

# 3) Create organizer
echo -e "${YELLOW}3) Create organizer${NC}"
CREATE_ORG_JSON="{\"organizerName\":\"$ORGANIZER_NAME\",\"category\":\"$CATEGORY_ID\",\"description\":\"Test organizer\",\"contactNumber\":\"9999999999\"}"
api_call "POST" "$BASE_URL/clubs" "$ADMIN_COOKIE" "" "$CREATE_ORG_JSON"
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
echo "Organizer login email: $ORGANIZER_EMAIL"
echo ""

# 4) Organizer login
echo -e "${YELLOW}4) Organizer login${NC}"
api_call "POST" "$BASE_URL/auth/login" "" "$ORGANIZER_COOKIE" "{\"email\":\"$ORGANIZER_EMAIL\",\"password\":\"$ORGANIZER_PASSWORD\"}"
expect_code "200" "Organizer login"
echo ""

# 5) Participant registration
echo -e "${YELLOW}5) Participant registration${NC}"
REGISTER_JSON="{\"email\":\"$PARTICIPANT_EMAIL\",\"password\":\"password123\",\"firstName\":\"Event\",\"lastName\":\"Tester\",\"contactNumber\":\"9876543210\",\"participantType\":\"IIIT_PARTICIPANT\"}"
api_call "POST" "$BASE_URL/auth/register" "" "$PARTICIPANT_COOKIE" "$REGISTER_JSON"
expect_code "201" "Participant register"
echo "Participant email: $PARTICIPANT_EMAIL"
echo ""

# 5.1) Second participant registration (for merchandise stock test)
echo -e "${YELLOW}5.1) Second participant registration${NC}"
REGISTER2_JSON="{\"email\":\"$PARTICIPANT2_EMAIL\",\"password\":\"password123\",\"firstName\":\"Event2\",\"lastName\":\"Tester2\",\"contactNumber\":\"9876543211\",\"participantType\":\"IIIT_PARTICIPANT\"}"
api_call "POST" "$BASE_URL/auth/register" "" "$PARTICIPANT2_COOKIE" "$REGISTER2_JSON"
expect_code "201" "Second participant register"
echo "Second participant email: $PARTICIPANT2_EMAIL"
echo ""

# 6) Organizer creates draft event
echo -e "${YELLOW}6) Organizer creates draft event${NC}"
CREATE_EVENT_JSON="{\"name\":\"Test Normal Event $STAMP\",\"description\":\"Simple test event\",\"type\":\"NORMAL\",\"eligibility\":\"ALL\",\"registrationDeadline\":\"$REG_DEADLINE\",\"startDate\":\"$START_DATE\",\"endDate\":\"$END_DATE\",\"registrationLimit\":100,\"registrationFee\":0,\"tags\":[\"test\"],\"customFormSchema\":[{\"type\":\"text\",\"label\":\"Why join?\",\"required\":true,\"order\":0},{\"type\":\"file\",\"label\":\"Resume\",\"required\":true,\"allowedMimeTypes\":[\"text/plain\"],\"maxFileSizeMB\":1,\"order\":1}],\"items\":[]}"
api_call "POST" "$BASE_URL/events" "$ORGANIZER_COOKIE" "" "$CREATE_EVENT_JSON"
expect_code "201" "Create event"
EVENT_ID="$(json_get "$BODY" "event._id")" || {
  echo -e "${RED}Could not parse event id${NC}"; cleanup; exit 1;
}
TEXT_FIELD_ID="$(json_get "$BODY" "event.customFormSchema.0.id")" || {
  echo -e "${RED}Could not parse generated text field id${NC}"; cleanup; exit 1;
}
FILE_FIELD_ID="$(json_get "$BODY" "event.customFormSchema.1.id")" || {
  echo -e "${RED}Could not parse generated file field id${NC}"; cleanup; exit 1;
}
if [ -z "$TEXT_FIELD_ID" ] || [ -z "$FILE_FIELD_ID" ]; then
  echo -e "${RED}✗ Generated custom form IDs are empty${NC}"
  cleanup
  exit 1
fi
if [ "$TEXT_FIELD_ID" = "$FILE_FIELD_ID" ]; then
  echo -e "${RED}✗ Generated custom form IDs should be unique${NC}"
  cleanup
  exit 1
fi
echo "Event ID: $EVENT_ID"
echo ""

# 7) Publish event
echo -e "${YELLOW}7) Publish event${NC}"
api_call "POST" "$BASE_URL/events/$EVENT_ID/publish" "$ORGANIZER_COOKIE" "" ""
expect_code "200" "Publish event"
echo ""

# 7.0) Start event (PUBLISHED -> ONGOING)
echo -e "${YELLOW}7.0) Start event${NC}"
api_call "POST" "$BASE_URL/events/$EVENT_ID/start" "$ORGANIZER_COOKIE" "" ""
expect_code "200" "Start event"
echo ""

# 7.1) Organizer detail public endpoint
echo -e "${YELLOW}7.1) Organizer detail page data${NC}"
api_call "GET" "$BASE_URL/clubs/$ORGANIZER_ID/events" "$PARTICIPANT_COOKIE" "" ""
expect_code "200" "Get organizer detail data"
DETAIL_ORG_NAME="$(json_get "$BODY" "organizer.organizerName")" || {
  echo -e "${RED}Could not parse organizer detail organizerName${NC}"; cleanup; exit 1;
}
if [ "$DETAIL_ORG_NAME" != "$ORGANIZER_NAME" ]; then
  echo -e "${RED}✗ Organizer detail returned wrong organizer name${NC}"
  cleanup
  exit 1
fi
DETAIL_UPCOMING_JSON="$(json_get "$BODY" "upcomingEvents")" || {
  echo -e "${RED}Could not parse organizer detail upcomingEvents${NC}"; cleanup; exit 1;
}
if echo "$DETAIL_UPCOMING_JSON" | grep -q "\"id\":\"$EVENT_ID\""; then
  echo -e "${GREEN}✓ Organizer detail includes upcoming created event${NC}"
else
  echo -e "${RED}✗ Organizer detail missing created event in upcoming list${NC}"
  cleanup
  exit 1
fi
echo ""

# 8) Participant browse events
echo -e "${YELLOW}8) Participant browse events${NC}"
api_call "GET" "$BASE_URL/events" "$PARTICIPANT_COOKIE" "" ""
expect_code "200" "Browse events"
echo ""

# 8.1) Partial search check
echo -e "${YELLOW}8.1) Partial search returns created event${NC}"
api_call "GET" "$BASE_URL/events?search=Test" "$PARTICIPANT_COOKIE" "" ""
expect_code "200" "Partial search"
EVENTS_JSON="$(json_get "$BODY" "events")" || {
  echo -e "${RED}Could not parse events array${NC}"; cleanup; exit 1;
}
if echo "$EVENTS_JSON" | grep -q "\"id\":\"$EVENT_ID\""; then
  echo -e "${GREEN}✓ Partial search includes created event${NC}"
else
  echo -e "${RED}✗ Partial search missing created event${NC}"
  cleanup
  exit 1
fi
echo ""

# 8.2) Fuzzy typo search check
echo -e "${YELLOW}8.2) Fuzzy typo search returns created event${NC}"
api_call "GET" "$BASE_URL/events?search=orgnizer" "$PARTICIPANT_COOKIE" "" ""
expect_code "200" "Fuzzy search"
EVENTS_JSON="$(json_get "$BODY" "events")" || {
  echo -e "${RED}Could not parse events array${NC}"; cleanup; exit 1;
}
if echo "$EVENTS_JSON" | grep -q "\"id\":\"$EVENT_ID\""; then
  echo -e "${GREEN}✓ Fuzzy search includes created event${NC}"
else
  echo -e "${RED}✗ Fuzzy search missing created event${NC}"
  cleanup
  exit 1
fi
echo ""

# 8.3) Followed filter with no followed clubs
echo -e "${YELLOW}8.3) Followed filter before following clubs${NC}"
api_call "GET" "$BASE_URL/events?followedOnly=true" "$PARTICIPANT_COOKIE" "" ""
expect_code "200" "Followed-only before follow"
NO_FOLLOWED_CLUBS="$(json_get "$BODY" "meta.noFollowedClubs")" || {
  echo -e "${RED}Could not parse meta.noFollowedClubs${NC}"; cleanup; exit 1;
}
if [ "$NO_FOLLOWED_CLUBS" != "true" ]; then
  echo -e "${RED}✗ Expected meta.noFollowedClubs=true${NC}"
  cleanup
  exit 1
fi
EVENTS_LEN="$(json_array_length "$BODY" "events")" || {
  echo -e "${RED}Could not parse events length${NC}"; cleanup; exit 1;
}
if [ "$EVENTS_LEN" != "0" ]; then
  echo -e "${RED}✗ Expected zero events for followed-only before follow${NC}"
  cleanup
  exit 1
fi
echo -e "${GREEN}✓ Followed-only empty state works${NC}"
echo ""

# 8.4) Follow organizer and recheck followed filter
echo -e "${YELLOW}8.4) Follow organizer and recheck followed-only${NC}"
api_call "PUT" "$BASE_URL/user/followed-clubs" "$PARTICIPANT_COOKIE" "" "{\"followedClubs\":[\"$ORGANIZER_ID\"]}"
expect_code "200" "Follow organizer"
api_call "GET" "$BASE_URL/events?followedOnly=true" "$PARTICIPANT_COOKIE" "" ""
expect_code "200" "Followed-only after follow"
EVENTS_JSON="$(json_get "$BODY" "events")" || {
  echo -e "${RED}Could not parse events array${NC}"; cleanup; exit 1;
}
if echo "$EVENTS_JSON" | grep -q "\"id\":\"$EVENT_ID\""; then
  echo -e "${GREEN}✓ Followed-only includes followed organizer event${NC}"
else
  echo -e "${RED}✗ Followed-only missing followed organizer event${NC}"
  cleanup
  exit 1
fi
echo ""

# 9) Participant event detail
echo -e "${YELLOW}9) Participant event detail${NC}"
api_call "GET" "$BASE_URL/events/$EVENT_ID" "$PARTICIPANT_COOKIE" "" ""
expect_code "200" "Get event details"
echo ""

# 10) Participant register to event
echo -e "${YELLOW}10) Participant register to event${NC}"
echo "hello file upload test" > "$TEST_UPLOAD_FILE"
RESPONSES_JSON="{\"$TEXT_FIELD_ID\":\"I like events\"}"
RESPONSE="$(curl -s -w "\n%{http_code}" -X POST \
  -b "$PARTICIPANT_COOKIE" \
  -F "responses=$RESPONSES_JSON" \
  -F "$FILE_FIELD_ID=@$TEST_UPLOAD_FILE;type=text/plain" \
  "$BASE_URL/events/$EVENT_ID/register")"
HTTP_CODE="$(echo "$RESPONSE" | tail -n1)"
BODY="$(echo "$RESPONSE" | sed '$d')"
expect_code "201" "Register for event"
TICKET_ID="$(json_get "$BODY" "ticket.ticketId")" || {
  echo -e "${RED}Could not parse ticket id${NC}"; cleanup; exit 1;
}
REGISTRATION_ID="$(json_get "$BODY" "registration._id")" || {
  echo -e "${RED}Could not parse registration id${NC}"; cleanup; exit 1;
}
NORMAL_EMAIL_SENT="$(json_get "$BODY" "email.sent")" || {
  echo -e "${RED}Could not parse registration email status${NC}"; cleanup; exit 1;
}
if [ "$NORMAL_EMAIL_SENT" != "true" ]; then
  echo -e "${RED}✗ Normal registration ticket email not sent${NC}"
  cleanup
  exit 1
fi
NORMAL_EMAIL_MODE="$(json_get "$BODY" "email.mode")" || {
  echo -e "${RED}Could not parse registration email mode${NC}"; cleanup; exit 1;
}
if [ "$NORMAL_EMAIL_MODE" != "smtp" ]; then
  echo -e "${RED}✗ Normal registration email mode is not smtp${NC}"
  cleanup
  exit 1
fi
if echo "$BODY" | grep -q '"messageId":null'; then
  echo -e "${YELLOW}! Normal registration provider returned null messageId${NC}"
else
  NORMAL_MESSAGE_ID="$(json_get "$BODY" "email.messageId")" || {
    echo -e "${RED}Could not parse registration messageId${NC}"; cleanup; exit 1;
  }
  if [ -z "$NORMAL_MESSAGE_ID" ]; then
    echo -e "${RED}✗ Normal registration messageId is empty${NC}"
    cleanup
    exit 1
  fi
fi
echo "Ticket ID: $TICKET_ID"
echo ""

# 10.1) Trending includes registered event
echo -e "${YELLOW}10.1) Trending contains registered event${NC}"
api_call "GET" "$BASE_URL/events" "$PARTICIPANT_COOKIE" "" ""
expect_code "200" "Browse events for trending check"
TRENDING_JSON="$(json_get "$BODY" "trendingEvents")" || {
  echo -e "${RED}Could not parse trendingEvents array${NC}"; cleanup; exit 1;
}
if echo "$TRENDING_JSON" | grep -q "\"id\":\"$EVENT_ID\""; then
  echo -e "${GREEN}✓ Trending includes registered event${NC}"
else
  echo -e "${YELLOW}! Trending does not include this event (global top-5 may be saturated by other recent events)${NC}"
fi
echo ""

# 10.2) Organizer creates merchandise event
echo -e "${YELLOW}10.2) Organizer creates merchandise event${NC}"
MERCH_EVENT_JSON="{\"name\":\"Test Merch Event $STAMP\",\"description\":\"Merch test event\",\"type\":\"MERCHANDISE\",\"eligibility\":\"ALL\",\"registrationDeadline\":\"$REG_DEADLINE\",\"startDate\":\"$START_DATE\",\"endDate\":\"$END_DATE\",\"registrationLimit\":10,\"registrationFee\":0,\"tags\":[\"merch\"],\"customFormSchema\":[],\"items\":[{\"name\":\"T-Shirt\",\"description\":\"Fest Tee\",\"purchaseLimitPerParticipant\":1,\"variants\":[{\"size\":\"M\",\"color\":\"Black\",\"label\":\"M/Black\",\"price\":499,\"stockQty\":1}]}]}"
api_call "POST" "$BASE_URL/events" "$ORGANIZER_COOKIE" "" "$MERCH_EVENT_JSON"
expect_code "201" "Create merchandise event"
MERCH_EVENT_ID="$(json_get "$BODY" "event._id")" || {
  echo -e "${RED}Could not parse merchandise event id${NC}"; cleanup; exit 1;
}
MERCH_ITEM_ID="$(json_get "$BODY" "event.items.0.itemId")" || {
  echo -e "${RED}Could not parse generated merchandise item id${NC}"; cleanup; exit 1;
}
MERCH_VARIANT_ID="$(json_get "$BODY" "event.items.0.variants.0.variantId")" || {
  echo -e "${RED}Could not parse generated merchandise variant id${NC}"; cleanup; exit 1;
}
if [ -z "$MERCH_ITEM_ID" ] || [ -z "$MERCH_VARIANT_ID" ]; then
  echo -e "${RED}✗ Generated merchandise IDs are empty${NC}"
  cleanup
  exit 1
fi
api_call "POST" "$BASE_URL/events/$MERCH_EVENT_ID/publish" "$ORGANIZER_COOKIE" "" ""
expect_code "200" "Publish merchandise event"
echo ""

# 10.3) Participant2 purchases merchandise (pending payment, no ticket/email)
echo -e "${YELLOW}10.3) Merchandise purchase creates pending order${NC}"
api_call "POST" "$BASE_URL/events/$MERCH_EVENT_ID/purchase" "$PARTICIPANT2_COOKIE" "" "{\"itemId\":\"$MERCH_ITEM_ID\",\"variantId\":\"$MERCH_VARIANT_ID\",\"quantity\":1}"
expect_code "201" "Purchase merchandise"
MERCH_REGISTRATION_ID="$(json_get "$BODY" "registration._id")" || {
  echo -e "${RED}Could not parse merchandise registration id${NC}"; cleanup; exit 1;
}
MERCH_PAYMENT_STATUS="$(json_get "$BODY" "registration.merchPurchase.paymentStatus")" || {
  echo -e "${RED}Could not parse merchandise payment status${NC}"; cleanup; exit 1;
}
if [ "$MERCH_PAYMENT_STATUS" != "PAYMENT_PENDING" ]; then
  echo -e "${RED}✗ Merchandise purchase should be PAYMENT_PENDING${NC}"
  cleanup
  exit 1
fi
if echo "$BODY" | grep -q '"ticket"'; then
  echo -e "${RED}✗ Merchandise purchase should not create ticket before approval${NC}"
  cleanup
  exit 1
fi
if echo "$BODY" | grep -q '"email"'; then
  echo -e "${RED}✗ Merchandise purchase should not send email before approval${NC}"
  cleanup
  exit 1
fi
echo "Merch registration ID: $MERCH_REGISTRATION_ID"
echo ""

# 10.4) Duplicate purchase by same participant is blocked
echo -e "${YELLOW}10.4) Merchandise duplicate purchase blocked${NC}"
api_call "POST" "$BASE_URL/events/$MERCH_EVENT_ID/purchase" "$PARTICIPANT2_COOKIE" "" "{\"itemId\":\"$MERCH_ITEM_ID\",\"variantId\":\"$MERCH_VARIANT_ID\",\"quantity\":1}"
expect_code "409" "Duplicate merchandise purchase blocked"
if echo "$BODY" | grep -qi "already registered"; then
  echo -e "${GREEN}✓ Correct duplicate purchase error${NC}"
else
  echo -e "${RED}✗ Duplicate purchase error message mismatch${NC}"
  echo "Response: $BODY"
  cleanup
  exit 1
fi
echo ""

# 11) Participant my-events dashboard
echo -e "${YELLOW}11) Participant my-events${NC}"
api_call "GET" "$BASE_URL/user/my-events" "$PARTICIPANT_COOKIE" "" ""
expect_code "200" "Get my-events"
echo ""

# 12) Organizer participants list
echo -e "${YELLOW}12) Organizer participants list${NC}"
api_call "GET" "$BASE_URL/events/organizer/events/$EVENT_ID/participants" "$ORGANIZER_COOKIE" "" ""
expect_code "200" "Get participants"
echo ""

# 13) Organizer mark attendance
echo -e "${YELLOW}13) Organizer mark attendance${NC}"
api_call "PATCH" "$BASE_URL/events/organizer/events/$EVENT_ID/participants/$REGISTRATION_ID/attendance" "$ORGANIZER_COOKIE" "" "{\"attended\":true}"
expect_code "200" "Mark attendance"
echo ""

# 14) Organizer CSV export
echo -e "${YELLOW}14) Organizer export participants CSV${NC}"
RESPONSE="$(curl -s -w "\n%{http_code}" -b "$ORGANIZER_COOKIE" "$BASE_URL/events/organizer/events/$EVENT_ID/participants/export")"
HTTP_CODE="$(echo "$RESPONSE" | tail -n1)"
BODY="$(echo "$RESPONSE" | sed '$d')"
expect_code "200" "Export CSV"
if echo "$BODY" | grep -q "Participant Name"; then
  echo -e "${GREEN}✓ CSV header found${NC}"
else
  echo -e "${RED}✗ CSV header missing${NC}"
  cleanup
  exit 1
fi
echo ""

# 15) Ticket detail lookup
echo -e "${YELLOW}15) Ticket detail lookup${NC}"
api_call "GET" "$BASE_URL/tickets/$TICKET_ID" "$PARTICIPANT_COOKIE" "" ""
expect_code "200" "Get ticket by id"
NORMAL_QR="$(json_get "$BODY" "ticket.qrCodeDataUrl")" || {
  echo -e "${RED}Could not parse normal ticket qrCodeDataUrl${NC}"; cleanup; exit 1;
}
if echo "$NORMAL_QR" | grep -q "^data:image/png;base64,"; then
  echo -e "${GREEN}✓ Normal ticket QR exists${NC}"
else
  echo -e "${RED}✗ Normal ticket QR missing${NC}"
  cleanup
  exit 1
fi
echo ""

# 16) Close + complete lifecycle
echo -e "${YELLOW}16) Close and complete event${NC}"
api_call "POST" "$BASE_URL/events/$EVENT_ID/close" "$ORGANIZER_COOKIE" "" ""
expect_code "200" "Close event"
api_call "POST" "$BASE_URL/events/$EVENT_ID/complete" "$ORGANIZER_COOKIE" "" ""
expect_code "200" "Complete event"
echo ""

echo -e "${GREEN}All event tests passed successfully.${NC}"
cleanup
