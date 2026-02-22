# Advanced Test Plan

## Per-Issue Gates
1. `bash backend/tests/advanced/adv01_reset_request_test.sh`
2. `bash backend/tests/advanced/adv02_reset_review_test.sh`
3. `bash backend/tests/advanced/adv03_calendar_single_test.sh`
4. `bash backend/tests/advanced/adv04_calendar_batch_test.sh`
5. `bash backend/tests/advanced/adv05_merch_pending_test.sh`
6. `bash backend/tests/advanced/adv06_payment_proof_test.sh`
7. `bash backend/tests/advanced/adv07_merch_review_finalize_test.sh`
8. `bash backend/tests/advanced/adv08_qr_backend_test.sh`
9. `bash backend/tests/advanced/adv09_qr_ui_flow_test.sh`

## Regression Gates
1. `bash backend/tests/auth_test.sh`
2. `bash backend/tests/event_test.sh`
3. `bash backend/tests/organizer_section10_test.sh`
4. `bash backend/tests/admin_section11_test.sh`
5. `bash backend/tests/event_email_failure_test.sh`
6. `bash backend/tests/draft_and_file_access_test.sh`

## Consolidated Gate
1. `bash backend/tests/advanced/advanced_workflow_test.sh`

## Latest Run Summary (2026-02-22)
1. Advanced issue gates: passed.
2. Regression suites listed above: passed.
3. Email failure rollback scenarios: passed after adapting merch flow to approval-time email delivery.
