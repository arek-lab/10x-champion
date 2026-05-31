<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Guest QR Auth and Service Panel

- **Plan**: context/changes/guest-qr-auth-panel/plan.md
- **Scope**: Phase 3 of 3
- **Date**: 2026-05-31
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical  3 warnings  3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Findings

### F1 — r.services accessed without null guard

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/guest/panel.astro:39-41
- **Detail**: Both filter lines called r.services.active without a null guard. The concern was that Supabase PostgREST types FK joins as T | null at the API level. On investigation, types.ts confirms package_services.service_id is `string` (NOT NULL), so the generated type is non-null; adding a null guard would have triggered the no-unnecessary-condition lint rule.
- **Decision**: DISMISSED — types confirm non-null; null guard would introduce lint error.

### F2 — Unplanned modifications to Phase 2 file

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/pages/qr/room/[qr_token].astro:30-57
- **Detail**: Three robustness improvements landed in commit 7a7a19d on a Phase 2 file: pendingPayload.type guard, roomError check, tokenError check. All correct and beneficial, matching the Phase 2 addendum convention.
- **Fix**: Add Phase 3 addendum to plan.md documenting these three changes.
- **Decision**: FIXED — Phase 3 addendum added to plan.md.

### F3 — services.active filtered in JS instead of SQL

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/pages/guest/panel.astro:33-41
- **Detail**: Plan step 4 specifies `AND services.active = true` in the query. Implementation fetched all services and filtered in JS instead.
- **Fix**: Added `.eq("services.active", true)` to the Supabase query and removed the redundant JS `.active` checks.
- **Decision**: FIXED via Fix — SQL-level filter applied; JS active checks removed.

### F4 — package_services DB error silently renders empty panel

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/guest/panel.astro:32-35
- **Detail**: package_services query omitted error destructuring. A DB failure silently rendered "No included services found." Inconsistent with the guest_tokens query above it.
- **Fix**: Added `error: pkgError` destructuring and `if (pkgError) return redirect`. TypeScript discriminated union made the `?? []` fallback unnecessary — changed to `const rows = packageServicesRows`.
- **Decision**: FIXED.

### F5 — npm run typecheck script doesn't exist

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/guest-qr-auth-panel/plan.md (all three phases' automated criteria)
- **Detail**: `npm run typecheck` listed in automated criteria for all three phases, but script doesn't exist in package.json. Type checking is done via `npx astro check` or implicitly via `npm run build`.
- **Fix**: Updated all three criteria lines in plan.md to `npx astro check`.
- **Decision**: FIXED.

### F6 — guestToken null case handled by inequality side-effect

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/qr/room/[qr_token].astro:55-59
- **Detail**: After the tokenError guard, a null guestToken (not found) was caught only by `guestToken?.room_number !== room.room_number` returning true via optional chaining — correct but implicit. The roomError check two lines up uses `roomError || !room` explicitly.
- **Fix**: Combined into `if (tokenError || !guestToken)` and removed `?.` from `guestToken.room_number` access.
- **Decision**: FIXED.
