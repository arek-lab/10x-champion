# Database Schema and Supabase Configuration — Plan Brief

> Full plan: `context/changes/db-schema-supabase/plan.md`
> Roadmap entry: `context/foundation/roadmap.md` — F-01

## What & Why

Create the Postgres schema that every downstream slice (S-01 through S-04) depends on: 6 tables, RLS policies, pilot hotel seed data, and the TypeScript/middleware contract. Without this foundation, no guest or staff flow can be implemented. This is the first item in the must-have path to the north star (S-04).

## Starting Point

A cloud Supabase project exists with `SUPABASE_URL` and `SUPABASE_KEY` already in `.env`. Only Supabase Auth's built-in `auth.users` table is in use; no custom tables or migrations directory yet. Auth works for staff via email/password. Guests have no accounts — their access model is entirely custom and must be built here.

## Desired End State

`npx supabase db push` applies three migrations to the cloud project (schema, RLS, seed) cleanly. Six tables exist with RLS enabled. `src/types.ts` has generated TypeScript types. The middleware recognises a `guest_session` JWT cookie and populates `context.locals.guestToken`, giving S-02 the session contract it needs to build guest QR auth.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Guest DB access model | Service role + application-level filtering | Decouples guest auth entirely from Supabase JWT infrastructure; immune to future JWT algorithm changes. | Plan |
| Guest session security | `GUEST_SESSION_SECRET` (own HS256 secret) | Independent of Supabase; rotating Supabase JWT keys never breaks guest sessions. | Plan |
| Staff DB access model | Supabase Auth JWT + RLS (`authenticated` role) | Standard Supabase pattern; works with any current or future Supabase JWT algorithm. | Plan |
| Room QR codes | `room_qr_codes` table with unique `qr_token` per room | User overrode the static-URL default; unique tokens allow future rotation and unambiguous room identification. | Plan (user override) |
| Package–services link | Junction table `package_services` with `inclusion_type` | Normalized, supports multiple packages sharing services with different inclusion types without schema changes. | Plan |
| Token format | Opaque UUID in `guest_tokens.token_value` | Simple DB lookup on QR scan; token reveals nothing decodable about the guest. | Plan |
| Two-step auth intermediate state | Signed HttpOnly cookie (step-1), full JWT cookie (step-2) | Stateless server-side; no extra DB writes for intermediate state; works naturally with Astro SSR middleware. | Plan |
| Order status model | 3 statuses, forward-only (`pending → fulfilled\|cancelled`) | Matches PRD exactly; DB USING/WITH CHECK policies on orders enforce the guest-cancel-only rule. | Plan |
| Seed catalog | 3 packages × 8 services | Covers PRD secondary success criterion of 3+ service categories. | Plan |
| JWT library | `jose` | Only JWT library compatible with Cloudflare Workers V8 isolates; `jsonwebtoken` requires Node.js crypto. | Plan |
| TypeScript types | Supabase CLI generated (`supabase gen types`) | Always in sync with schema; zero manual maintenance. | Plan |
| Middleware scope | Extend now with `guestToken` locals | Defines the locals contract that S-01 and S-02 depend on; cleaner than retrofitting later. | Plan |

## Scope

**In scope:**
- 6 tables: `services`, `packages`, `package_services`, `room_qr_codes`, `guest_tokens`, `orders`
- RLS policies for all 6 tables (guest + staff roles)
- Seed data: 8 services, 3 packages, 19 junction rows, 10 room QR codes (rooms 101–110)
- `src/types.ts` generated from schema
- `SUPABASE_JWT_SECRET` env declaration
- `App.Locals.guestToken` type + middleware cookie detection

**Out of scope:**
- Staff user account creation (out-of-band, not seeded)
- `SUPABASE_SERVICE_ROLE_KEY` — deferred to S-01/S-02
- API routes for reading/writing tables — S-01 through S-04
- QR code image generation — S-01
- CRUD panel for services/packages — parked in roadmap

## Architecture / Approach

Staff API calls use the existing SSR Supabase client (Supabase Auth cookie session, RLS enforced). Guest API calls use a Supabase client initialised with `SUPABASE_SERVICE_ROLE_KEY` — RLS bypassed, isolation enforced by application code (`WHERE guest_token_id = $1`). The guest's identity comes from the `guest_session` HttpOnly cookie, verified in middleware using `GUEST_SESSION_SECRET` (independent of Supabase). No Supabase JWT logic for guests — zero dependency on Supabase's JWT key management.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Schema & RLS migrations | 6 tables + RLS policies in 2 migration files | Wrong `is_guest` claim check in policies → all guest queries fail or return wrong data |
| 2. Seed data | Pilot hotel catalog + 10 room QR codes in 3rd migration file | Migration is applied once by `db push`; ON CONFLICT DO NOTHING guards against accidental re-run |
| 3. TypeScript + env contract | Generated types, SUPABASE_JWT_SECRET env, guestToken middleware | `jose` version incompatibility with workerd; pin to a known-good version if needed |

**Prerequisites:** `npx supabase link --project-ref <ref>` run once before Phase 1. `SUPABASE_SERVICE_ROLE_KEY` (dashboard → Settings → API) and `GUEST_SESSION_SECRET` (self-generated) added to `.env` and `.dev.vars` before Phase 3.

**Estimated effort:** ~1 session across 3 phases (schema is mostly SQL authoring; no complex logic until Phase 3 middleware).

## Open Risks & Assumptions

- `SUPABASE_SERVICE_ROLE_KEY` bypasses all RLS — every guest API route MUST filter by `guest_token_id` from the verified cookie; missing a WHERE clause exposes all guest data.
- `GUEST_SESSION_SECRET` must be the same value across all instances (dev, prod). Rotating it invalidates all active guest sessions.
- The seed uses Polish service names matching the PRD. If the real pilot hotel uses different names before go-live, a new migration must be added to update the rows.

## Success Criteria (Summary)

- `npx supabase db push` applies all 3 migrations cleanly and produces the correct row counts (8 services, 3 packages, 10 rooms)
- All 6 tables show RLS enabled in the Supabase dashboard with correct policy counts
- A page request with a valid `guest_session` cookie populates `context.locals.guestToken`; an invalid cookie sets it to `null` without a 500 error
