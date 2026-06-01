# Guest Order Add-On — Plan Brief

> Full plan: `context/changes/guest-order-addon/plan.md`

## What & Why

Enable guests to place and cancel add-on orders inline from the panel, closing the self-service loop for the S-03 slice. Reception staff sees a live pending-order count badge on their dashboard instead of email notifications — a lighter, zero-dependency alternative that fits the MVP timeline.

## Starting Point

S-02 is complete: the guest panel at `/guest/panel.astro` renders add-ons as a static SSR list with read-only status badges. No Order or Cancel buttons exist yet. The `orders` table is fully schema-ready (status CHECK, updated_at trigger). Guest API auth via `context.locals.guestToken` is already wired in middleware.

## Desired End State

Guests tap "Order" on any add-on → optimistic pending badge + Cancel button appear inline. Tap "Cancel" → cancelled badge + Order button reappear (re-orderable). Fulfilled orders show a final badge with no action. Staff opens the dashboard → nav bar shows `Orders (N)` badge; dashboard page shows a pending count card.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Reception notification | Badge on staff dashboard (no email) | Dropped external dependency; badge in nav/dashboard is sufficient for a single-hotel MVP | Plan |
| Duplicate pending orders | Block at API + hide Order button in UI | Prevents cluttered orders table and confusing UX | Plan |
| Panel update after action | React state update (no page reload) | Smooth mobile UX; consistent with Astro+React island pattern in CLAUDE.md | Plan |
| Cancel UX | ⏳ Pending badge + inline Cancel button | Explicit affordance — no hidden click target | Plan |
| Re-order after cancel | Yes — new order row inserted | Guest-friendly; cancellation recoverable | Plan |
| Error display | Inline text under button | Consistent with existing `ServerError` pattern; no new dialog component needed | Plan |

## Scope

**In scope:**
- `POST /api/guest/orders` — place a pending order
- `PATCH /api/guest/orders/[id]` — cancel a pending order
- `AddonList.tsx` React island replacing the static add-ons section
- Pending count badge in `StaffLayout.astro` nav
- Pending count card on `/dashboard`

**Out of scope:**
- Email notifications (permanently dropped for this slice)
- Re-ordering a `fulfilled` service
- Reception order list UI (S-04)
- Schema migrations (none needed)

## Architecture / Approach

Two SSR API endpoints authenticate via `context.locals.guestToken` (middleware-injected) and query using `createServiceRoleClient()` with explicit WHERE guards. The guest panel becomes a hybrid: included services remain static SSR; the add-ons section becomes a `client:load` React island receiving initial order state as serialized props. Staff badge uses the authenticated `createClient()` and the existing `staff_read_orders` RLS policy — one COUNT query per staff page load.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Guest Order API | POST + PATCH endpoints; order placement and cancellation with full validation | Service-package membership check logic must guard correctly against non-addon services |
| 2. Guest Panel Island | Interactive Order/Cancel buttons; optimistic React state; inline errors | Multiple-orders-per-service state resolution (recency sort) must be correct |
| 3. Staff Badge | Pending count in nav + dashboard card | StaffLayout DB query on every page load — fine for MVP, worth noting for future |

**Prerequisites:** S-02 complete (it is); F-01 complete (it is)
**Estimated effort:** ~1-2 sessions across 3 phases

## Open Risks & Assumptions

- The staff badge is a count only — clicking it goes to `/dashboard` for now. Staff will have no way to view order details until S-04 ships. This is acceptable for the pilot but means the pilot launch depends on S-04 for full reception workflow.
- Orders query in `StaffLayout.astro` runs on every staff page. Negligible for one pilot hotel; flag if load grows.

## Success Criteria (Summary)

- Guest can place and cancel add-on orders inline without page reload
- Staff sees live pending order count in nav and on dashboard after any order state change
- No regressions in QR auth flow, guest panel, or staff token generation
