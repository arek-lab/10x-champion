---
date: 2026-06-02T00:00:00+00:00
researcher: arek-lab
git_commit: ac3b768fdf45cd4e7b25a9b098d4369082a8bc45
branch: main
repository: room_pilot
topic: "Phase 1 test coverage: Runner + QR auth path — middleware JWT, 2-step QR auth, token expiry"
tags: [research, codebase, middleware, qr-auth, jwt, vitest, guest-session, pending-guest]
status: complete
last_updated: 2026-06-02
last_updated_by: arek-lab
---

# Research: Runner + QR Auth Path — Phase 1 Test Coverage

**Date**: 2026-06-02  
**Researcher**: arek-lab  
**Git Commit**: ac3b768fdf45cd4e7b25a9b098d4369082a8bc45  
**Branch**: main  
**Repository**: room_pilot

## Research Question

What code must the Phase 1 Vitest tests cover for Risks R1 (2-step QR auth), R2 (middleware JWT regression), and R3 (token expiry not enforced)? Ground the test design in the real flow — exact files, function signatures, cookie names, JWT claims, error paths — and assess what Vitest infrastructure needs to be added.

---

## Summary

The 2-step QR auth path is fully implemented across two Astro SSR pages (`src/pages/guest/verify.astro` and `src/pages/qr/room/[qr_token].astro`) plus the middleware (`src/middleware.ts`). All three use `jose` for HS256 JWT signing/verification with a shared `GUEST_SESSION_SECRET`. There is **zero Vitest infrastructure** today — the project needs full bootstrap. The `astro:env/server` import pattern requires mocking in tests. Token expiry is enforced **automatically** by `jose.jwtVerify` (no explicit code), which means an expired-token unit test will directly verify the jose behavior under middleware's try/catch.

---

## Detailed Findings

### R1 — 2-Step QR Auth: pending_guest → guest_session

#### Step 1: `pending_guest` cookie issuance

**File**: `src/pages/guest/verify.astro:20–50`

- Guest presents a `token_value` UUID (received out-of-band)
- Server validates against `guest_tokens.token_value` in Supabase
- Checks `check_out_date` is not in the past (pre-issue guard)
- Creates a short-lived JWT via `jose.SignJWT`:

```typescript
const pendingJwt = await new SignJWT({ tokenId: row.id, type: "pending_guest" })
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("10m")
  .sign(secret);  // secret = new TextEncoder().encode(GUEST_SESSION_SECRET)
```

- Sets cookie:

| Attribute  | Value              |
|------------|--------------------|
| Name       | `pending_guest`    |
| Path       | `/qr`              |
| HttpOnly   | true               |
| Secure     | true               |
| SameSite   | `lax`              |
| MaxAge     | 600 s              |

- **Type claim is critical**: `type: "pending_guest"` prevents JWT type confusion (both cookies share the same secret).
- Shows "Step 2 of 2 — Scan the QR code in your room" after success.

#### Step 2: QR scan → `guest_session` cookie issuance

**File**: `src/pages/qr/room/[qr_token].astro`

Full verification sequence (lines 7–93):

1. **Line 7–9**: If `guest_session` already valid → redirect `/guest/panel` immediately.
2. **Line 11–14**: If no `qr_token` route param → redirect `/guest/error?reason=invalid`.
3. **Line 16–32**: Read and verify `pending_guest` cookie:
   - `jwtVerify(cookie, secret, { algorithms: ["HS256"] })` — throws on expired/tampered
   - `if (pendingPayload.type !== "pending_guest")` → redirect `/guest/error?reason=invalid` (type guard, line 30–31)
4. **Line 39–43**: Look up `qr_token` in `room_qr_codes` table:
   ```typescript
   .from("room_qr_codes").select("room_number").eq("qr_token", qr_token).maybeSingle()
   ```
5. **Line 49–57**: Look up guest token record by `pendingPayload.tokenId`:
   ```typescript
   .from("guest_tokens").select("id, room_number, package_id, check_out_date").eq("id", pendingPayload.tokenId).maybeSingle()
   ```
6. **Line 59–61**: Room match check: `guestToken.room_number === room.room_number` — rejects cross-room attacks.
7. **Line 63–66**: Expiry pre-check: `check_out_date < today` → redirect `/guest/error?reason=expired`.
8. **Line 68–85**: Issue `guest_session`:

```typescript
const sessionExpiry = new Date(guestToken.check_out_date + "T23:59:59Z");
const sessionJwt = await new SignJWT({
  tokenId: guestToken.id,
  roomNumber: guestToken.room_number,
  packageId: guestToken.package_id,
  checkOutDate: guestToken.check_out_date,
})
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime(sessionExpiry)
  .sign(secret);
```

Cookie attributes:

| Attribute  | Value             |
|------------|-------------------|
| Name       | `guest_session`   |
| Path       | `/`               |
| HttpOnly   | true              |
| Secure     | true              |
| SameSite   | `lax`             |
| Expires    | `check_out_date T23:59:59Z` |

9. **Line 87–93**: Clears `pending_guest` (same path `/qr`, `maxAge: 0`).
10. **Line 95**: Redirects `302` to `/guest/panel`.

**Redirect target**: `/guest/panel`  
**Error target**: `/guest/error?reason=<invalid|expired>`

---

### R2 — Middleware JWT Logic

**File**: `src/middleware.ts`

Full middleware flow (lines 1–50):

#### Staff path (lines 8–24)

```typescript
const supabase = createClient(context.request.headers, context.cookies);
const { data: { user } } = await supabase.auth.getUser();
context.locals.user = user ?? null;
// PROTECTED_ROUTES = ["/dashboard"]
if (!context.locals.user) return context.redirect("/auth/signin");
```

- Uses Supabase session cookie (SDK-managed, not custom JWT)
- Redirects to `/auth/signin` when unauthenticated on protected routes

#### Guest path (lines 26–43)

```typescript
const guestCookie = context.cookies.get("guest_session")?.value;
if (guestCookie && GUEST_SESSION_SECRET) {
  try {
    const secret = new TextEncoder().encode(GUEST_SESSION_SECRET);
    const { payload } = await jwtVerify(guestCookie, secret, { algorithms: ["HS256"] });
    context.locals.guestToken = {
      tokenId: payload.tokenId as string,
      roomNumber: payload.roomNumber as string,
      packageId: payload.packageId as string,
      checkOutDate: payload.checkOutDate as string,
      exp: payload.exp ?? 0,
    };
  } catch {
    context.locals.guestToken = null;
  }
} else {
  context.locals.guestToken = null;
}
```

- Cookie name: **`guest_session`**
- Library: **`jose`**, import from `"jose"` (`src/middleware.ts:3`)
- Secret access: `import { GUEST_SESSION_SECRET } from "astro:env/server"` (`src/middleware.ts:4`)
- Secret encoding: `new TextEncoder().encode(GUEST_SESSION_SECRET)`
- **`exp` enforcement**: fully automatic via `jwtVerify` — expired token throws, caught silently, `guestToken = null`
- **No 500 on any error** — the catch block never rethrows

#### Locals type definition

**File**: `src/env.d.ts:1–14`

```typescript
interface GuestTokenLocals {
  tokenId: string;
  roomNumber: string;
  packageId: string;
  checkOutDate: string;
  exp: number;
}
declare namespace App {
  interface Locals {
    user: import("@supabase/supabase-js").User | null;
    guestToken: GuestTokenLocals | null;
  }
}
```

#### Per-API-route guard pattern

All guest API routes (`src/pages/api/guest/orders/index.ts:14–16`, `src/pages/api/guest/concierge.ts:22–24`, etc.):

```typescript
const guestToken = context.locals.guestToken;
if (!guestToken) {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
```

- No explicit re-check of `exp` in routes — they trust middleware's `null` result.
- No redirect from API routes; all return `401 JSON`.

---

### R3 — Token Expiry Not Enforced

Two distinct layers enforce expiry — tests must cover both:

1. **Pre-issuance guard in `[qr_token].astro:63–66`**: Checks `check_out_date < today` (DB date string comparison) before signing the JWT. A guest whose checkout was yesterday is rejected here and never receives a `guest_session` cookie.

2. **Post-issuance middleware guard in `middleware.ts:30`**: `jwtVerify` automatically validates the `exp` claim on every request. If the guest session JWT's `exp` is in the past, jose throws `JWTExpired`, which middleware catches → `guestToken = null` → routes return 401.

**Key distinction**: The `exp` claim is stored **only in the JWT** — there is no `expires_at` column in the database. `check_out_date` (a `date` type, `YYYY-MM-DD`) in the DB is used to compute `exp` at issuance time; thereafter, only the JWT `exp` is checked.

**Expiry computation**: `new Date(check_out_date + "T23:59:59Z")` — end-of-day UTC, not midnight. A guest checking out today still has access until 23:59:59 UTC.

---

### Test Infrastructure Status

**File**: `package.json` — no vitest dependency exists.

| Aspect | Current State | Action needed |
|--------|---------------|---------------|
| Vitest | not installed | `npm i -D vitest` |
| Test config | none | create `vitest.config.ts` |
| Test files | none | create `src/__tests__/` |
| npm test script | none | add `"test": "vitest run"` to package.json |
| Module system | ESM (`"type": "module"`) | compatible with Vitest defaults |
| TypeScript | 5.9.3, strict, `@/*` alias configured | compatible; no changes needed |
| Vite override | `^7.3.2` in `package.json:63` | must ensure vitest version is compatible |

**Critical Vitest challenge**: `src/middleware.ts` imports `GUEST_SESSION_SECRET` from `"astro:env/server"`. In Vitest (Node, no Astro runtime), this module does not exist. Tests must mock or shim it. Two options:
- **Option A** (preferred): Use `vi.mock("astro:env/server", () => ({ GUEST_SESSION_SECRET: "test-secret-32-bytes-hex-here" }))` at the top of each test file.
- **Option B**: Extract the JWT logic into a plain `src/lib/guest-jwt.ts` helper that accepts the secret as a parameter, making it testable without Astro env.

The `src/lib/supabase.ts` client also imports from `astro:env/server` — integration tests for the QR route will need Supabase mocked (or a real local Supabase instance).

---

## Code References

| File | Lines | Purpose |
|------|-------|---------|
| `src/pages/guest/verify.astro` | 20–52 | Step 1: pending_guest cookie issuance |
| `src/pages/qr/room/[qr_token].astro` | 1–96 | Step 2: full QR auth, guest_session issuance |
| `src/middleware.ts` | 1–50 | JWT verification, guestToken/user locals population |
| `src/env.d.ts` | 1–14 | Locals type: `GuestTokenLocals`, `user`, `guestToken` |
| `src/types.ts` | 42–92 | `guest_tokens` table shape |
| `src/types.ts` | 198–221 | `room_qr_codes` table shape |
| `src/lib/supabase.ts` | — | Supabase client factories; uses `astro:env/server` |
| `src/pages/api/guest/orders/index.ts` | 14–16 | Per-route 401 guard pattern |
| `src/pages/api/guest/concierge.ts` | 22–24 | Per-route 401 guard pattern |
| `astro.config.mjs` | 17–26 | Env schema: GUEST_SESSION_SECRET, SUPABASE_* |
| `package.json` | 1–73 | No vitest; ESM; TS 5.9.3; Vite 7.3.2 override |
| `tsconfig.json` | 1–13 | strict; `@/*` alias; extends astro/tsconfigs/strict |

---

## Architecture Insights

1. **Shared secret, two tokens**: Both `pending_guest` and `guest_session` use the same `GUEST_SESSION_SECRET`. The type claim `type: "pending_guest"` is the only guard against type confusion. Tests must verify this guard.

2. **Cookie path scoping as security**: `pending_guest` is scoped to `path: "/qr"`. The browser sends it only to `/qr/*` routes. `guest_session` is `path: "/"`. Tests that call the middleware directly must ensure they simulate the correct cookie.

3. **No Supabase RLS on guest data**: All guest API routes use the service role client and rely on `WHERE guest_token_id = tokenId` app-level guards. `guest_token_id` always comes from `context.locals.guestToken.tokenId` (JWT-sourced), never from request params — this is the IDOR prevention tested in Phase 2.

4. **`exp` is the sole expiry source**: No `expires_at` DB column. The JWT `exp` claim (set to `check_out_date + "T23:59:59Z"`) is all that stands between an expired guest and panel access. jose's automatic `exp` check in `jwtVerify` is the single line of defense for R3.

5. **Middleware is stateless and synchronous-looking**: The async `jwtVerify` is the only I/O in the guest path (no DB call). This makes the middleware unit-testable in isolation without Supabase.

---

## Historical Context (from prior changes)

- `context/archive/db-schema-supabase/plan.md` — Established JWT claims schema (`tokenId`, `roomNumber`, `packageId`, `checkOutDate`, `exp`); documented that `GUEST_SESSION_SECRET` is independent of Supabase and generated with `crypto.randomBytes(32)`. Confirmed: no `exp` column in `guest_tokens` — JWT `exp` is sole source of truth.
- `context/archive/guest-qr-auth-panel/plan.md` — Defined the two-JWT architecture; set expiry to end-of-day (`T23:59:59Z`, not midnight) to avoid cutting off guest access on checkout day; originally set `pending_guest` cookie to `path: "/"`.
- `context/archive/guest-qr-auth-panel/impl-review-phase-1.md` (F5) — Corrected `pending_guest` cookie path from `"/"` to `"/qr"` (least-privilege). This is now in the live code.
- `context/archive/guest-qr-auth-panel/impl-review-phase-2.md` (F2) — Mandated `type: "pending_guest"` claim and the explicit guard `if (pendingPayload.type !== "pending_guest")` to prevent type confusion between the two cookies.

---

## Related Research

No prior research.md files in other change folders at time of writing.

---

## Open Questions

1. **`astro:env/server` mock strategy**: Should tests mock at the module level via `vi.mock`, or should the JWT logic be extracted into a pure helper (`src/lib/guest-jwt.ts`) that accepts the secret as a parameter? The extraction approach is cleaner but is a code change; the mock approach requires no production code change. This is a plan-time decision.

2. **Integration test Supabase strategy**: For the QR route integration test (R1), does the team want to hit a real local Supabase instance (as Phase 2 requires for order tests) or mock the Supabase client? The test-plan says "mock only at network edge if needed" for Phase 1. Middleware itself makes no Supabase call — only the QR route does. Decision needed during planning.

3. **Vitest version compatibility with Vite 7.3.2 override**: `package.json` pins `vite` to `^7.3.2` via `overrides`. Vitest bundles its own Vite; the override may cause version conflicts. The plan should specify Vitest version and verify there is no conflict.

4. **`jose` import in Vitest**: `jose` is ESM-only. The project is `"type": "module"`, so this should work in Vitest out of the box, but needs verification with the specific vitest.config.ts setup.
