# Responsive Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Implement the approved six-part responsive dashboard redesign.
**Architecture:** Bearer-authenticated APIs, shared client authentication gate, server-filtered scoped queries and a dedicated progressive map feed. Shared application shell with independent login presentation.
**Tech Stack:** Existing Next.js 15, React 19, Supabase, jose, Leaflet, Vitest.
**Spec:** ../specs/2026-10-31-responsive-dashboard-redesign.md

## Global Constraints
- Default scope mine, explicit all; existing shared read and owner-only delete permissions.
- localStorage token, server verification, 30-day JWT; no token on external requests.
- Exact counts independent of list pagination; map batches 500, list pages 20.
- Preserve old foods APIs' data semantics, not Cookie-only authentication.
- No deployment, production data mutation or credential disclosure.

## Review Focus
- Authentication transitions and late requests must not retain another account's data.
- Reject external or encoded malicious next paths.
- Stable map pagination includes records beyond 100 and coincident points.
- Filters must not allow late responses to overwrite current scope.
- Failed network calls must not look like zero data or log users out.

### Task 1: Authentication and shell boundary
**Files:** lib/auth/{requestUser,token-store,redirect,context}.ts(x), lib/browser.ts, app/api/**/route.ts, app/login/page.tsx, components/layout/*.tsx.
**Interfaces:** requireUser(req: Request); requestJson<T>(url, init); useAuth() with user/status/error/login/logout/retry.
- [x] Write and run failing tests for Bearer validation, safe redirect paths, token attachment and error status handling.
- [x] Implement storage, client provider/gate, login response migration and every protected API caller.
- [x] Run focused authentication and permission tests; remove server Cookie page guard.

### Task 2: Scoped statistics and queries
**Files:** lib/entries.ts, lib/validations/entry-query.ts, app/api/dashboard/summary/route.ts, app/api/entries/map/route.ts, app/api/entries/route.ts, tests/entries/scoped.test.ts.
**Interfaces:** getEntrySummary(userId,scope), listEntryPage(userId,query), listMapPoints(userId,query); shared public types live in lib/entry-types.ts.
- [x] Write and run failing query tests for mine/all, exact counts, pagination, cursor validation and literal search.
- [x] Implement independent count/map/list queries and no-store responses.
- [x] Run API and query tests; add optional database indexes.

### Task 3: Navigation and visual system
**Files:** app/layout.tsx, app/globals.css, components/layout/{AppShell,AppDock,Icon,PageHeader}.tsx, PRODUCT.md, DESIGN.md.
**Interfaces:** root AppShell wraps existing routes and bypasses system UI on /login; all protected content gated.
- [x] Verify navigation behavior in component tests before implementation.
- [x] Build desktop Dock and accessible mobile expandable menu; neutral application palette and focused type hierarchy.
- [x] Verify active states, keyboard close/focus, no navigation on login.

### Task 4: Dashboard map and cards
**Files:** app/page.tsx, components/dashboard/*.tsx, components/map/DashboardMap.tsx, lib/geo/clusters.ts.
**Interfaces:** summary and map endpoints from Task 2; URL scope/kind; source-aware detail links.
- [x] Write failing tests for complete progressive loading, stale response cancellation and coincident clustering.
- [x] Implement scoped count cards, URL filters, progressive map, locate/fit controls and map preview.
- [x] Run targeted dashboard/map tests.

### Task 5: Remaining pages
**Files:** app/entries/page.tsx, app/account/page.tsx, app/entries/new/page.tsx, app/entries/[id]/page.tsx, app/recommend/page.tsx, components/{EntryCard,EntryForm}.tsx.
**Interfaces:** scoped list API, shared auth context, safe source return paths.
- [x] Add page interaction coverage for scope/category paging and source return.
- [x] Implement list/search/nearby mode, account, form/detail/recommend adaptation and save/delete invalidation.
- [x] Preserve existing behavior tests and update deliberate route/auth contract changes.

### Task 6: Verification and delivery
**Files:** README.md, docs/superpowers/plans/2026-10-31-responsive-dashboard-progress.md.
- [x] Run full tests, lint and production build; fix actual failures.
- [x] Browser check at 360/390/768/1280/1440 and landscape using mock business APIs; separately record external-service limitations.
- [x] Fresh final code review; address important findings with regression checks.
- [x] Update README and progress evidence, report changes and migration needs.
