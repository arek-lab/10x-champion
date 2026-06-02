# Phase 1 Test Coverage: Runner + QR Auth Path — Plan Brief

> Full plan: `context/changes/testing-runner-qr-auth-path/plan.md`
> Research: `context/changes/testing-runner-qr-auth-path/research.md`

## What & Why

Bootstrap Vitest from zero and write Phase 1 test coverage for the three highest-priority risks: middleware JWT regression (R2), token expiry not enforced (R3), and 2-step QR auth broken (R1). The project has no test infrastructure at all today — this plan creates it and delivers the first meaningful test suites as the foundation for all future testing phases.

## Starting Point

No Vitest deps, no `vitest.config.ts`, no test files. The middleware (`src/middleware.ts`) uses `jose` for HS256 verification and imports secrets via `astro:env/server` (a module that doesn't exist in Node). The QR route business logic lives entirely in `.astro` frontmatter, which Vitest cannot import directly — requiring a small extraction before R1 can be tested.

## Desired End State

`npm test` passes with 7 tests across 3 files. The middleware is covered for all JWT paths including expiry enforcement. A new `src/lib/qr-auth.ts` module exists holding the extractd QR auth business logic, and both the happy path and expired-pending-guest scenario are verified by integration tests.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| `astro:env/server` in tests | `vi.mock` per test file | Zero production code change; Vitest hoists the mock before module resolution so the missing physical module is not an issue | Plan |
| Supabase in QR route tests | Mock Supabase client (`vi.mock`) | Self-contained, no infra needed for Phase 1; true integration deferred to Phase 2 | Plan |
| Test file location | `src/__tests__/` directory | Keeps test files separate from source; avoids Astro routing `.test.ts` files as pages | Plan |
| Phasing | 3 phases (bootstrap → middleware → QR) | Each phase is independently verifiable; confirms runner works before test logic is written | Plan |
| R1 test scope | Happy path + expired `pending_guest` | Minimum coverage to prove R1; other edge cases can be added in future passes | Plan |
| Vitest environment | `node` | All Phase 1 tests are server-side logic; no DOM needed | Plan |
| QR route testability | Extract logic to `src/lib/qr-auth.ts` | `.astro` frontmatter cannot be imported by Vitest; extraction is required and also improves code structure | Plan |
| R3 `exp` verification | Real `jose`, no mock | Mocking `jwtVerify` would test mock behavior, not actual expiry enforcement — real call proves R3's core challenge | Plan |

## Scope

**In scope:**
- Vitest install + `vitest.config.ts` + `npm test` scripts
- `src/__tests__/smoke.test.ts` — runner smoke test
- `src/__tests__/middleware.test.ts` — 5 unit tests (R2 + R3)
- `src/lib/qr-auth.ts` — extracted `processQrAuth()` function
- Updated `src/pages/qr/room/[qr_token].astro` — thin adapter calling `processQrAuth`
- `src/__tests__/qr-auth.test.ts` — 2 integration tests (R1)

**Out of scope:**
- Playwright / E2E (Phase 3 of test rollout)
- Order flow, IDOR, service authorization tests (Phase 2)
- React component tests
- Real Supabase instance
- Coverage reporting
- CI GitHub Actions wiring (Phase 4)
- Wrangler / Workers runtime tests

## Architecture / Approach

All tests run in Node (no browser, no Wrangler). `astro:env/server` imports are intercepted per test file via `vi.mock` hoisting. The Supabase client is mocked at the factory level using chained `vi.fn()` mocks matching Supabase's builder pattern. The key structural change is extracting `processQrAuth()` from `[qr_token].astro` frontmatter to `src/lib/qr-auth.ts` — a pure function that accepts `(qrToken, pendingCookieValue, secret, supabase, today)` and returns a discriminated union `{type: "success" | "error"}`. The `.astro` file handles cookies and redirects based on the result.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Vitest Bootstrap | `vitest.config.ts`, npm scripts, smoke test — runner confirmed working | `vite: "^7.3.2"` override may cause peer dep conflict with Vitest's bundled Vite |
| 2. Middleware Unit Tests | 5 tests covering R2 + R3, all JWT paths, no infra | `astro:env/server` + Supabase client mock wiring must work before any test logic runs |
| 3. QR Route Integration | `processQrAuth` extraction + 2 R1 tests | Refactor must not break the live QR flow — manual dev server verification required |

**Prerequisites:** Node 22.14.0; no local Supabase needed for Phase 1.  
**Estimated effort:** 1 session across 3 phases.

## Open Risks & Assumptions

- Vitest version compatible with `vite ^7.3.2` override must be verified at `npm install` — use the latest Vitest with explicit Vite 7 support if conflicts arise.
- `jose` (ESM-only) assumed to work out-of-the-box in Vitest with `"type": "module"` — confirmed in Phase 1 smoke test.
- `vi.mock("astro:env/server", ...)` hoisting assumed to intercept before Node module resolution — standard Vitest behavior, confirmed in Phase 2.

## Success Criteria (Summary)

- `npm test` exits 0 with all 7 tests passing
- R3 verified: a JWT with `exp` 1 second in the past sets `guestToken = null` in middleware with no thrown exception
- R1 verified: decoding `processQrAuth`'s returned `sessionJwt` shows all four claims (`tokenId`, `roomNumber`, `packageId`, `checkOutDate`) and `exp` equal to `check_out_date T23:59:59Z`
