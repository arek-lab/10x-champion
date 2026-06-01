# Reception Order Panel — Plan Brief

> Full plan: `context/changes/reception-order-panel/plan.md`

## What & Why

Add a live order management panel to the staff dashboard so reception can see, confirm, and close every guest add-on order without refreshing the page. This is the north-star slice for RoomPilot — it closes the full self-service loop (guest orders → reception acts → status propagates back to guest) and is the primary success criterion for the MVP pilot.

## Starting Point

`dashboard.astro` is a placeholder showing a static pending-count number. No staff orders API exists. The nav badge is server-rendered once per page load. S-03 (`guest-order-addon`) delivered the guest ordering flow and the badge shell; S-04 fills it with live data.

## Desired End State

Staff opens `/dashboard` and sees every pending guest order — guest name, room, service, elapsed wait time — refreshed automatically every 10 s. Clicking Fulfill or Cancel opens a confirmation dialog; confirming removes the row and decrements the nav badge in real time. When the queue is empty the panel reads "All clear. All guests are happy!" Status changes reach the guest panel within 20 s via the existing polling from S-03.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
|---|---|---|
| Order display scope | Pending only | Focused action list — matches "active orders" language in PRD FR-012; history is out of MVP scope. |
| Status transitions | Fulfill or cancel pending only | Simplest guard; no undo needed per PRD; DB constraint already enforces valid statuses. |
| Page location | Replace `dashboard.astro` content | "Orders" nav link already targets `/dashboard`; zero routing change. |
| Badge live update | CustomEvent from OrderList | Idiomatic Astro islands pattern; syncs badge with each poll without a second polling timer. |
| Card fields | Guest name + room + service + elapsed time | Covers the full reception workflow; requires a 3-table JOIN. |
| Action UX | Confirmation dialog (AlertDialog) | Staff requested this explicitly; prevents misclicks on a shared reception terminal. |
| Sort order | Oldest-first / FIFO | Natural queue behaviour — longest-waiting guest served first. |
| Empty state message | "All clear. All guests are happy!" | User-specified; positive reinforcement that polling is working, not broken. |

## Scope

**In scope:**
- `GET /api/staff/orders` — pending orders with guest + service join, oldest-first
- `PATCH /api/staff/orders/[id]` — fulfill or cancel, pending-only guard
- `src/components/staff/OrderList.tsx` — 10 s polling, AlertDialog confirm, CustomEvent badge sync
- Install `shadcn alert-dialog` component
- Replace `dashboard.astro` placeholder with `OrderList` island
- `StaffLayout.astro` badge: always-render + `id="pending-badge"` + CustomEvent listener script

**Out of scope:**
- Fulfilled/cancelled order history view
- Undo / reopen of closed orders
- Pagination
- WebSocket / SSE (polling is the PRD-accepted approach)
- Badge live update on pages other than `/dashboard`
- Any DB migrations (schema is complete from F-01)

## Architecture / Approach

Staff API endpoints use `createClient()` (Supabase Auth JWT) so existing RLS policies grant access automatically. The GET endpoint runs a 3-table join and flattens the result into a plain DTO array. `OrderList.tsx` is a React island mounted with `client:load`; it receives the server-fetched initial orders as a prop (no loading flash) and replaces them via polling. Each poll fires a `CustomEvent("pending-count-update")` that a script in `StaffLayout.astro` uses to update the badge span in-place. The confirmation flow uses shadcn `AlertDialog` — one instance shared across all orders, driven by a `confirmTarget` state object.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Staff Orders API | GET + PATCH endpoints, auth-guarded, with 3-table join and pending guard | Supabase join syntax / TypeScript inference from `select()` string |
| 2. AlertDialog + OrderList | Polling React island, confirmation UX, CustomEvent badge sync | alertDialog install + React state complexity for loading/confirm/orders |
| 3. Dashboard + Nav Badge | Replaces placeholder page, wires live badge | Always-render badge change must not break existing styling |

**Prerequisites:** S-03 complete (guest order API + badge shell in nav); F-01 done (schema, RLS).
**Estimated effort:** ~1-2 sessions across 3 phases.

## Open Risks & Assumptions

- Supabase JS client type inference for multi-table `.select()` strings can be imprecise; implementer may need an explicit `as` cast for the flattened DTO.
- The `pending-count-update` CustomEvent badge sync only updates the badge when the staff member is on the `/dashboard` page. On other pages (e.g., `/dashboard/generate-token`) the badge stays at the server-rendered count until next navigation — acceptable for MVP.

## Success Criteria (Summary)

- A guest order placed in the guest panel appears in the reception panel within 10 s, without a manual refresh.
- Staff can fulfill or cancel a pending order through a confirmation dialog; the row disappears and the badge decrements immediately.
- When the queue is empty the panel shows the "All clear" message and the nav badge is hidden.
