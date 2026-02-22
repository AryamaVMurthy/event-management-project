# Advanced Issue Index

## Scope
Implemented advanced issues ADV-01 through ADV-09 with per-issue gates and regression checks.

## Issue Status
1. ADV-01 Organizer reset request tracer bullet: `done`
2. ADV-02 Password reset review completion: `done`
3. ADV-03 Calendar single-event export: `done`
4. ADV-04 Calendar batch export + reminder override: `done`
5. ADV-05 Merchandise pending-payment purchase flow: `done`
6. ADV-06 Payment proof upload + organizer queue: `done`
7. ADV-07 Approve/reject transactional finalization: `done`
8. ADV-08 QR attendance backend: `done`
9. ADV-09 QR scanner UI flow + manual override: `done`
10. ADV-10 Hardening + evidence: `done`

## Execution Order
1. Reset workflow (ADV-01, ADV-02)
2. Calendar workflow (ADV-03, ADV-04)
3. Merchandise payment lifecycle (ADV-05, ADV-06, ADV-07)
4. QR attendance workflow (ADV-08, ADV-09)
5. Consolidation and evidence (ADV-10)

## Evidence Commands
1. `bash backend/tests/advanced/advanced_workflow_test.sh`
2. `bash backend/tests/auth_test.sh`
3. `bash backend/tests/event_test.sh`
4. `bash backend/tests/organizer_section10_test.sh`
5. `bash backend/tests/admin_section11_test.sh`
6. `bash backend/tests/event_email_failure_test.sh`
7. `bash backend/tests/draft_and_file_access_test.sh`
