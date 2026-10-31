# SDD ledger — plan: docs/superpowers/plans/2026-10-31-responsive-dashboard.md

Spec approved by user requesting implementation of 1–6.
Workspace: current checkout, feature branch codex/responsive-dashboard. No worktree necessary because checkout has no unrelated changes.
Pre-flight: Task 1 request signature must be carried through every API before Task 2; Tasks 3–5 consume one AuthProvider and shared query types, no duplicate session authorities.
Ruling: retain paths without route-group file moves; AppShell branches by pathname and uses one shared client gate — same user-visible separation with fewer stale import paths — cost if wrong: route-specific layouts may need extraction later.
Ruling: no automatic commits or push; leave changes reviewable in the authorized checkout — user asked implementation, not publication.

## Completed work

- Task 1: complete. Bearer-only authentication, deleted-user verification, private no-store responses, localStorage state, safe return paths, expiry handling and cross-tab synchronization. Both password and OTP return accessToken/expiresAt. Legacy Cookie-only sessions require a new login.
- Task 2: complete. Scoped exact statistics, page-based entries and independent stable-cursor map data, 500-point batches. Optional index migration 005 prepared; no live database mutation performed.
- Task 3: complete. Shared application shell, independent login presentation, desktop Dock, mobile menu with Escape/outside close and focus restoration. Microsoft YaHei/PingFang SC/Segoe UI/Arial/system sans-serif; all Google font loading and font-package dependencies removed.
- Task 4: complete. Two count cards, personal/shared URL scope, separate map type filter, progressive/resumable point feed, coincident/nearby grid clustering, selected-point preview, fit/locate controls and tile loading/failure states.
- Task 5: complete. New record list/search/pagination/nearby mode, account page, existing form/detail/recommend adaptation and source-aware return links. Data rereads after navigation and mutations rather than shared caches.

## Final review fixes

- P1 background authentication verification unloaded business pages and lost drafts: regression reproduced RED, changed background verification to preserve the signed-in subtree, GREEN. A network/500 background failure keeps the draft and shows a recoverable status.
- P2 normalized dot segments bypassed login-loop protection: RED for /entries/../login and encoded equivalents, normalized destination before forbidden-route checks, GREEN.
- P2 Escape while the mobile menu was closed moved form focus: RED, limited Escape handling to the open menu, GREEN; added first-link focus on menu open.
- Added expiry, stale-account success-response and stale-account 401 regression cases; old requests cannot publish data or clear a newer token.

## Verification evidence

- `npm test`: 34 files, 180 tests passed. The unchanged local-setup tests bind loopback HTTP servers, so the full run requires local-server permission in restricted sandboxes.
- `npm run lint`: exit 0; four pre-existing warnings remain (anonymous config exports and unused destructured association IDs). No new warnings.
- `npm run build`: exit 0, Next.js 15.5.28 production build. No build-time font network dependency.
- `git diff --check`: clean.
- Impeccable mechanical detector: `[]` findings for the modified page/layout surfaces.
- Browser checks use synthetic business API responses and a fake client token; no real Supabase writes or real AI calls. Real OSM tiles were requested; slow tiles remain an external-network limitation with visible loading/retry UI.
- Checked 360, 390, 768, 1280 and 1440px widths and 844×390 landscape: no horizontal overflow, two cards remain side by side; no Google font requests.
- Exercised list filtering/search, food save at 4.5 stars, locationless item save, owner delete and return, AI no-sample state, invalid-token cleanup, login destination restoration, offline/500 background draft preservation and cross-tab logout.
- Intentional mock 401/500 responses are recorded separately from application console/page errors by `scripts/smoke-dashboard.mjs`.

## Reproduce browser checks

Start a production preview with `npm start -- --hostname 127.0.0.1 --port 3188`. With Playwright available, run `node scripts/smoke-dashboard.mjs`. Optional environment variables: PLAYWRIGHT_MODULE (absolute module path), CHROME_EXECUTABLE, DASHBOARD_BASE_URL and DASHBOARD_QA_DIR. The default report/screenshot directory is the OS temp directory's food-notes-dashboard-qa folder. The script intercepts business APIs; its screenshots are illustrative, not real user data.

## Delivery boundaries

No deployment, commit, push, production database migration or live external-service integration was performed. Optional indexes can be applied later using supabase/migrations/005_dashboard_indexes.sql. Existing nearby/recommend candidate limits remain explicitly described in the UI. Working branch: codex/responsive-dashboard.

Task 6: complete. Final production browser run using the checked-in smoke script passed all five widths, landscape and workflow checks. Report: /tmp/dashboard-final-qa/report.json; zero application errors, zero external-font requests; exactly two deliberately injected HTTP failures (401/500). The production preview is available on http://127.0.0.1:3188.
