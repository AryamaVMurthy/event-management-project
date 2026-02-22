# Controller Modularization + Size Enforcement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor backend controllers into modular files so no file in `backend/controllers` exceeds the agreed limit, while preserving all existing API behavior.

**Architecture:** Keep route contracts unchanged, split large controller files by domain responsibility, and migrate incrementally using barrel exports to avoid big-bang breakage. Add an automated size guard to prevent regressions. Use existing E2E shell tests as behavior lock.

**Tech Stack:** Node 22, Express 5, Mongoose, Zod, shell-based API tests in `backend/tests/*.sh`.

---

## Baseline (Current Hotspots)

- `backend/controllers/events/eventShared.js` — 742 lines
- `backend/controllers/events/participantEventController.js` — 674 lines
- `backend/controllers/events/organizerEventController.js` — 440 lines
- `backend/controllers/userController.js` — 314 lines
- `backend/controllers/adminController.js` — 244 lines

## Refactor Policy

- Hard cap: **240 lines** per file inside `backend/controllers/**/*.js`.
- Soft target: 80-180 lines for most controller modules.
- No API contract changes (same routes, methods, response shapes, errors).
- No hidden fallback logic; fail explicitly with existing error helpers.

---

### Task 1: Add Size Guardrails Before Refactor

**Files:**
- Create: `backend/scripts/check-controller-size.mjs`
- Modify: `backend/package.json`

**Step 1: Implement controller size checker**
- Recursively scan `backend/controllers/**/*.js`.
- Report file line counts sorted descending.
- Exit non-zero if any file exceeds `--max` (default 240).

**Step 2: Add package scripts**
- `check:controller-size`: `node scripts/check-controller-size.mjs --max 240`
- `check:controllers`: alias to `check:controller-size`

**Step 3: Run baseline checker**
Run: `cd backend && npm run check:controller-size`
Expected: FAIL, listing the current oversized files.

**Step 4: Commit**
- `chore(backend): add controller size guard script`

---

### Task 2: Split `eventShared.js` into Focused Shared Modules

**Files:**
- Create: `backend/controllers/events/shared/access.js`
- Create: `backend/controllers/events/shared/payloadNormalization.js`
- Create: `backend/controllers/events/shared/queryAndSearch.js`
- Create: `backend/controllers/events/shared/eligibility.js`
- Create: `backend/controllers/events/shared/registrationValidation.js`
- Create: `backend/controllers/events/shared/ticketing.js`
- Create: `backend/controllers/events/shared/participantsTable.js`
- Create: `backend/controllers/events/shared/index.js`
- Modify: `backend/controllers/events/eventShared.js`

**Step 1: Move access and ownership helpers**
- `isObjectId`, `getEventOr404`, `assertOrganizerOwnsEvent`, organizer/admin access helpers, registration-file access helper.

**Step 2: Move payload canonicalization helpers**
- create/update payload normalization, form/item id canonicalization.

**Step 3: Move list query schema + fuzzy search logic**
- list query parse zod schema and Fuse search helpers.

**Step 4: Move eligibility and blocking checks**
- participant role checks, deadline/eligibility/capacity checks, blocking reason enrichment.

**Step 5: Move response/ticket/participant export helpers**
- normal response validation, ticket creation, participant rows/csv generation.

**Step 6: Convert `eventShared.js` to barrel only**
- Keep exports stable from a compact re-export file.

**Step 7: Run targeted regression tests**
Run:
- `cd backend && bash tests/event_test.sh`
- `cd backend && bash tests/draft_and_file_access_test.sh`
Expected: PASS

**Step 8: Commit**
- `refactor(events): split event shared helpers by concern`

---

### Task 3: Split Participant Event Controller

**Files:**
- Create: `backend/controllers/events/participant/listEventsController.js`
- Create: `backend/controllers/events/participant/detailsController.js`
- Create: `backend/controllers/events/participant/registerController.js`
- Create: `backend/controllers/events/participant/purchaseController.js`
- Create: `backend/controllers/events/participant/fileAccessController.js`
- Create: `backend/controllers/events/participant/services/ticketEmailService.js`
- Create: `backend/controllers/events/participant/services/uploadedResponsesService.js`
- Create: `backend/controllers/events/participant/services/trendingService.js`
- Create: `backend/controllers/events/participant/index.js`
- Modify: `backend/controllers/events/participantEventController.js`

**Step 1: Move list and detail handlers**
- Extract `listEvents` and `getEventDetails` with unchanged request/response behavior.

**Step 2: Move registration flow**
- Extract parsing + upload validation + rollback + registration/ticket/email flow.

**Step 3: Move merchandise flow**
- Extract `purchaseMerchandise` and stock rollback behavior.

**Step 4: Move file list/download handlers**
- Extract `listRegistrationFiles` and `downloadRegistrationFile`.

**Step 5: Convert `participantEventController.js` to barrel**
- Re-export all participant handlers.

**Step 6: Run participant-focused tests**
Run:
- `cd backend && bash tests/event_test.sh`
- `cd backend && bash tests/event_email_failure_test.sh`
- `cd backend && bash tests/draft_and_file_access_test.sh`
Expected: PASS

**Step 7: Commit**
- `refactor(events): modularize participant event controller`

---

### Task 4: Split Organizer Event Controller

**Files:**
- Create: `backend/controllers/events/organizer/listAndDetailsController.js`
- Create: `backend/controllers/events/organizer/analyticsController.js`
- Create: `backend/controllers/events/organizer/participantsController.js`
- Create: `backend/controllers/events/organizer/lifecycleController.js`
- Create: `backend/controllers/events/organizer/index.js`
- Modify: `backend/controllers/events/organizerEventController.js`

**Step 1: Move organizer read handlers**
- `getOrganizerEvents`, `getOrganizerEventDetails`.

**Step 2: Move analytics and participant handlers**
- analytics, participants list, attendance patch, CSV export.

**Step 3: Move lifecycle handlers**
- create, update, delete draft, publish/start/close/complete.

**Step 4: Convert `organizerEventController.js` to barrel**
- Keep external exports unchanged.

**Step 5: Run organizer/admin event regressions**
Run:
- `cd backend && bash tests/organizer_section10_test.sh`
- `cd backend && bash tests/admin_section11_test.sh`
- `cd backend && bash tests/draft_and_file_access_test.sh`
Expected: PASS

**Step 6: Commit**
- `refactor(events): modularize organizer event controller`

---

### Task 5: Split User Controller

**Files:**
- Create: `backend/controllers/user/profileController.js`
- Create: `backend/controllers/user/eventsController.js`
- Create: `backend/controllers/user/preferencesController.js`
- Create: `backend/controllers/user/securityController.js`
- Create: `backend/controllers/user/index.js`
- Modify: `backend/controllers/userController.js`
- Modify: `backend/routes/userRoutes.js`

**Step 1: Move profile handlers**
- `getMe`, `updateProfile`.

**Step 2: Move participant dashboard handler**
- `getMyEvents`.

**Step 3: Move participant preference handlers**
- `updateInterests`, `updateFollowedClubs`.

**Step 4: Move password change handler**
- `changePassword`.

**Step 5: Keep legacy import compatibility**
- Either route imports from `controllers/user/index.js` directly, or keep `userController.js` as barrel.

**Step 6: Run auth/user regressions**
Run:
- `cd backend && bash tests/auth_test.sh`
- `cd backend && bash tests/event_test.sh`
Expected: PASS

**Step 7: Commit**
- `refactor(user): split user controller by concern`

---

### Task 6: Split Admin Controller

**Files:**
- Create: `backend/controllers/admin/categoriesController.js`
- Create: `backend/controllers/admin/organizersController.js`
- Create: `backend/controllers/admin/passwordResetController.js`
- Create: `backend/controllers/admin/index.js`
- Modify: `backend/controllers/adminController.js`
- Modify: `backend/routes/adminRoutes.js`

**Step 1: Move category and organizer status handlers**
- organizer listing, status update, permanent delete, categories read.

**Step 2: Move password-reset request handlers**
- create/list/review reset requests.

**Step 3: Keep route contracts unchanged**
- same endpoints, payloads, and access control.

**Step 4: Run admin regressions**
Run:
- `cd backend && bash tests/admin_section11_test.sh`
- `cd backend && bash tests/auth_test.sh`
Expected: PASS

**Step 5: Commit**
- `refactor(admin): modularize admin controller`

---

### Task 7: Final Wiring Cleanup + Enforce Size Cap

**Files:**
- Modify: `backend/controllers/eventController.js`
- Modify: `backend/routes/eventRoutes.js` (only if direct module imports are desired)
- Modify: any barrel files retained for compatibility

**Step 1: Ensure all large files are reduced below cap**
- Old large files should now be small barrels or removed.

**Step 2: Run strict size guard**
Run: `cd backend && npm run check:controller-size`
Expected: PASS

**Step 3: Full regression run**
Run:
- `cd backend && bash tests/auth_test.sh`
- `cd backend && bash tests/event_test.sh`
- `cd backend && bash tests/organizer_section10_test.sh`
- `cd backend && bash tests/admin_section11_test.sh`
- `cd backend && bash tests/event_email_failure_test.sh`
- `cd backend && bash tests/draft_and_file_access_test.sh`
Expected: PASS

**Step 4: Manual sanity checks**
- Organizer can delete DRAFT event.
- Participant/Organizer/Admin file-list and file-download flows still work.
- Participant browse/search/filter still returns same shape.

**Step 5: Commit**
- `refactor(controllers): enforce max-size and finalize modular structure`

---

## Proposed Target Layout

- `backend/controllers/events/shared/*`
- `backend/controllers/events/participant/*`
- `backend/controllers/events/organizer/*`
- `backend/controllers/user/*`
- `backend/controllers/admin/*`
- Existing top-level files (`eventController.js`, `userController.js`, `adminController.js`) become thin barrels or are removed after route imports are updated.

## Success Criteria

- No file in `backend/controllers/**/*.js` exceeds 240 lines.
- Existing API behavior is unchanged.
- All existing backend shell test suites pass.
- Refactor lands in small, reviewable commits with green checks at each phase.
