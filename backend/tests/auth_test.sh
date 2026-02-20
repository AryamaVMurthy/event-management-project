#!/bin/bash

# ============================================
# FELICITY AUTH API - END TO END TEST SCRIPT
# ============================================
# Usage: ./tests/auth_test.sh
# Make sure server is running on localhost:5000
# ============================================

BASE_URL="http://localhost:5000/api/auth"
COOKIE_FILE="cookies.txt"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "============================================"
echo "FELICITY AUTH API - END TO END TESTS"
echo "============================================"
echo ""

# Clean up cookie file
rm -f $COOKIE_FILE

# ============================================
# TEST 1: Register IIIT Participant
# ============================================
echo -e "${YELLOW}TEST 1: Register IIIT Participant${NC}"
echo "POST /api/auth/register (IIIT email)"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -c $COOKIE_FILE -X POST "$BASE_URL/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teststudent@iiit.ac.in",
    "password": "password123",
    "firstName": "Test",
    "lastName": "Student",
    "contactNumber": "9876543210",
    "participantType": "IIIT_PARTICIPANT"
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 201 ]; then
  echo -e "${GREEN}✓ PASSED - Status: $HTTP_CODE${NC}"
  echo "Response: $BODY" | head -c 200
  echo "..."
else
  echo -e "${RED}✗ FAILED - Status: $HTTP_CODE${NC}"
  echo "Response: $BODY"
fi
echo ""
echo "--------------------------------------------"
echo ""

# ============================================
# TEST 2: Register Non-IIIT Participant
# ============================================
echo -e "${YELLOW}TEST 2: Register Non-IIIT Participant${NC}"
echo "POST /api/auth/register (non-IIIT email)"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "external@gmail.com",
    "password": "password123",
    "firstName": "External",
    "lastName": "User",
    "contactNumber": "1234567890",
    "participantType": "NON_IIIT_PARTICIPANT",
    "collegeOrgName": "IIT Delhi"
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 201 ]; then
  echo -e "${GREEN}✓ PASSED - Status: $HTTP_CODE${NC}"
  echo "Response: $BODY" | head -c 200
  echo "..."
else
  echo -e "${RED}✗ FAILED - Status: $HTTP_CODE${NC}"
  echo "Response: $BODY"
fi
echo ""
echo "--------------------------------------------"
echo ""

# ============================================
# TEST 3: Register with Invalid IIIT Email (should fail)
# ============================================
echo -e "${YELLOW}TEST 3: Register with Invalid IIIT Email (should fail)${NC}"
echo "POST /api/auth/register (gmail instead of iiit.ac.in)"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "fake@gmail.com",
    "password": "password123",
    "firstName": "Fake",
    "lastName": "IIIT",
    "contactNumber": "9876543210",
    "participantType": "IIIT_PARTICIPANT"
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 400 ]; then
  echo -e "${GREEN}✓ PASSED - Correctly rejected with Status: $HTTP_CODE${NC}"
  echo "Response: $BODY"
else
  echo -e "${RED}✗ FAILED - Expected 400, got Status: $HTTP_CODE${NC}"
  echo "Response: $BODY"
fi
echo ""
echo "--------------------------------------------"
echo ""

# ============================================
# TEST 4: Duplicate Registration (should fail)
# ============================================
echo -e "${YELLOW}TEST 4: Duplicate Registration (should fail)${NC}"
echo "POST /api/auth/register (same email as TEST 1)"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teststudent@iiit.ac.in",
    "password": "password123",
    "firstName": "Duplicate",
    "lastName": "User",
    "contactNumber": "9876543210",
    "participantType": "IIIT_PARTICIPANT"
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 400 ]; then
  echo -e "${GREEN}✓ PASSED - Correctly rejected duplicate with Status: $HTTP_CODE${NC}"
  echo "Response: $BODY"
else
  echo -e "${RED}✗ FAILED - Expected 400, got Status: $HTTP_CODE${NC}"
  echo "Response: $BODY"
fi
echo ""
echo "--------------------------------------------"
echo ""

# ============================================
# TEST 5: Login as IIIT Participant
# ============================================
echo -e "${YELLOW}TEST 5: Login as IIIT Participant${NC}"
echo "POST /api/auth/login"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -c $COOKIE_FILE -X POST "$BASE_URL/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teststudent@iiit.ac.in",
    "password": "password123"
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ]; then
  echo -e "${GREEN}✓ PASSED - Status: $HTTP_CODE${NC}"
  # Extract token for later use
  TOKEN=$(echo "$BODY" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
  echo "Token received: ${TOKEN:0:50}..."
else
  echo -e "${RED}✗ FAILED - Status: $HTTP_CODE${NC}"
  echo "Response: $BODY"
fi
echo ""
echo "--------------------------------------------"
echo ""

# ============================================
# TEST 6: Login with Wrong Password (should fail)
# ============================================
echo -e "${YELLOW}TEST 6: Login with Wrong Password (should fail)${NC}"
echo "POST /api/auth/login (incorrect password)"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teststudent@iiit.ac.in",
    "password": "wrongpassword"
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 401 ]; then
  echo -e "${GREEN}✓ PASSED - Correctly rejected with Status: $HTTP_CODE${NC}"
  echo "Response: $BODY"
else
  echo -e "${RED}✗ FAILED - Expected 401, got Status: $HTTP_CODE${NC}"
  echo "Response: $BODY"
fi
echo ""
echo "--------------------------------------------"
echo ""

# ============================================
# TEST 7: Login as Admin
# ============================================
echo -e "${YELLOW}TEST 7: Login as Admin${NC}"
echo "POST /api/auth/login (admin credentials from .env)"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin-felicity@iiit.ac.in",
    "password": "admin123"
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ]; then
  echo -e "${GREEN}✓ PASSED - Status: $HTTP_CODE${NC}"
  # Check if role is admin
  if echo "$BODY" | grep -q '"role":"admin"'; then
    echo -e "${GREEN}✓ Role is admin${NC}"
  fi
  echo "Response: $BODY" | head -c 200
  echo "..."
else
  echo -e "${RED}✗ FAILED - Status: $HTTP_CODE${NC}"
  echo "Response: $BODY"
fi
echo ""
echo "--------------------------------------------"
echo ""

# ============================================
# TEST 8: Logout
# ============================================
echo -e "${YELLOW}TEST 8: Logout${NC}"
echo "POST /api/auth/logout"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -b $COOKIE_FILE -X POST "$BASE_URL/logout")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ]; then
  echo -e "${GREEN}✓ PASSED - Status: $HTTP_CODE${NC}"
  echo "Response: $BODY"
else
  echo -e "${RED}✗ FAILED - Status: $HTTP_CODE${NC}"
  echo "Response: $BODY"
fi
echo ""
echo "--------------------------------------------"
echo ""

# ============================================
# TEST 9: Login Non-IIIT Participant
# ============================================
echo -e "${YELLOW}TEST 9: Login Non-IIIT Participant${NC}"
echo "POST /api/auth/login (external user)"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "external@gmail.com",
    "password": "password123"
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ]; then
  echo -e "${GREEN}✓ PASSED - Status: $HTTP_CODE${NC}"
  echo "Response: $BODY" | head -c 200
  echo "..."
else
  echo -e "${RED}✗ FAILED - Status: $HTTP_CODE${NC}"
  echo "Response: $BODY"
fi
echo ""
echo "--------------------------------------------"
echo ""

# ============================================
# TEST 10: Invalid Email Format (should fail)
# ============================================
echo -e "${YELLOW}TEST 10: Invalid Email Format (should fail)${NC}"
echo "POST /api/auth/register (invalid email)"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "notanemail",
    "password": "password123",
    "firstName": "Bad",
    "lastName": "Email",
    "contactNumber": "9876543210",
    "participantType": "NON_IIIT_PARTICIPANT",
    "collegeOrgName": "Test College"
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 400 ]; then
  echo -e "${GREEN}✓ PASSED - Correctly rejected with Status: $HTTP_CODE${NC}"
  echo "Response: $BODY"
else
  echo -e "${RED}✗ FAILED - Expected 400, got Status: $HTTP_CODE${NC}"
  echo "Response: $BODY"
fi
echo ""
echo "--------------------------------------------"
echo ""

# ============================================
# CLEANUP
# ============================================
rm -f $COOKIE_FILE

echo ""
echo "============================================"
echo "TEST SUITE COMPLETED"
echo "============================================"
echo ""
echo "Note: To test protected routes, you need to"
echo "add a /me endpoint in authRoutes.js first."
echo ""
