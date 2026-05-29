<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Guest QR Auth and Service Panel

- **Plan**: context/changes/guest-qr-auth-panel/plan.md
- **Scope**: Phase 2 of 3 (Room QR Verification and Session Issuance)
- **Date**: 2026-05-29
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical  3 warnings  1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Automated Verification

- `npx astro check` → 0 errors in 36 files ✅
- `npm run lint` → 0 errors in Phase 2 files ✅ (134 pre-existing errors in other files, not Phase 2 regressions)

## Findings

### F1 — verify.astro modified in Phase 2 commit without plan update

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence / Scope Discipline
- **Location**: src/pages/guest/verify.astro:48
- **Detail**: Phase 2 plan specifies one changed file: `[qr_token].astro`. Commit 3e30cf3 also patches `verify.astro` with three unplanned changes: (1) `pending_guest` cookie path `"/"` → `"/qr"` — Phase 1 plan still said `"/"`, plan was stale; (2) `service_error` view added; (3) DB error handling added. Plan was updated to reflect the cookie path change as documented decision.
- **Fix Applied**: Updated plan.md Phase 1 contract to `path: "/qr"` with rationale note. Added Phase 2 addendum documenting the unplanned verify.astro improvements.
- **Decision**: FIXED via Fix A

### F2 — pending_guest JWT type claim not verified

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/qr/room/[qr_token].astro:26
- **Detail**: `jwtVerify` checks signature/expiry but not payload shape. Same secret signs both `pending_guest` and `guest_session` tokens; `type: "pending_guest"` claim was never asserted in the consumer. A `guest_session` JWT presented as `pending_guest` cookie would pass verification.
- **Fix Applied**: Added `if (pendingPayload.type !== "pending_guest") { return Astro.redirect("/guest/error?reason=invalid", 302); }` after the JWT parse block.
- **Decision**: FIXED

### F3 — DB errors silently swallowed in [qr_token].astro

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality / Pattern Consistency
- **Location**: src/pages/qr/room/[qr_token].astro:36-50
- **Detail**: Both DB calls destructured only `{ data }`, dropping `error`. Transient DB errors mapped to "invalid" indistinguishably from "not found". `verify.astro` (updated in same commit) checks `dbError` — pattern inconsistency.
- **Fix Applied**: Destructured `{ data: room, error: roomError }` and `{ data: guestToken, error: tokenError }` from both queries; added redirect on truthy error.
- **Decision**: FIXED

### F4 — Implicit null guard on guestToken is non-obvious

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/qr/room/[qr_token].astro:52-57
- **Detail**: Null check for `guestToken` was embedded in `guestToken?.room_number !== room.room_number` optional-chain comparison. TypeScript narrowed correctly (astro check: 0 errors) but pattern differed from the explicit `if (!room)` guard for the room query.
- **Fix Applied**: Changed to `if (!guestToken || guestToken.room_number !== room.room_number)` — explicit null check combined with value comparison.
- **Decision**: FIXED
