#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

run_case() {
  local script_name="$1"
  echo -e "${YELLOW}Running ${script_name}${NC}"
  bash "$SCRIPT_DIR/${script_name}"
  echo -e "${GREEN}Completed ${script_name}${NC}"
  echo ""
}

echo "============================================"
echo "ADVANCED WORKFLOW TEST RUNNER"
echo "============================================"
echo ""

run_case "adv01_reset_request_test.sh"
run_case "adv02_reset_review_test.sh"
run_case "adv03_calendar_single_test.sh"
run_case "adv04_calendar_batch_test.sh"
run_case "adv05_merch_pending_test.sh"
run_case "adv06_payment_proof_test.sh"
run_case "adv07_merch_review_finalize_test.sh"
run_case "adv08_qr_backend_test.sh"
run_case "adv09_qr_ui_flow_test.sh"

echo -e "${GREEN}All advanced workflow tests passed.${NC}"
