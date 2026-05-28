# Staff Login and Guest QR Token Generation — Plan Brief

> Full plan: `context/changes/staff-auth-qr-generation/plan.md`

## What & Why

Build S-01: give staff the ability to generate a guest access token from the reception panel. A staff member fills in guest name, room, stay dates, and package type; the system creates a `guest_tokens` DB row and renders a printable QR code. This is the prerequisite for S-02 (guest scanning the QR to get panel access) and therefore the first milestone on the critical path to the north star.

## Starting Point

Staff login is already functional (Supabase Auth email+password, `/auth/signin` → `/dashboard`). The `guest_tokens` table, RLS policies, and seed data (3 packages, 10 rooms 101–110) are in place from F-01. The `/dashboard` page is a placeholder. No QR generation library or Zod validation is installed yet.

## Desired End State

A logged-in staff member navigates to `/dashboard/generate-token`, fills in the form, and is shown a QR code inline. The QR encodes `<origin>/guest/verify?token=<uuid>` — the URL S-02 will implement. Staff clicks Print and gets a clean slip (QR + guest name + room + dates, no nav). A new row appears in `guest_tokens` with the UUID and staff's user ID.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
|---|---|---|
| QR generation | Client-side (`react-qr-code`) | Avoids Cloudflare Workers V8 incompatibility with canvas-based Node.js QR libs. |
| Download/print | Browser print dialog | Covers the print requirement with zero file-format complexity; `print:hidden` on nav handles layout. |
| Post-generation flow | Stay on page, show QR inline | Staff can print immediately without a page transition; "Generate Another" resets for the next guest. |
| Room selection | Dropdown from `room_qr_codes` DB | Prevents typos and ensures `room_number` in `guest_tokens` matches a real seeded room. |
| Dashboard nav | Shared `StaffLayout.astro` with nav header now | S-04 will add "Orders" to the same nav — doing it now avoids retrofitting two pages later. |
| Print layout | QR + guest name + room + dates | Enough for staff and guest to verify the slip; package name omitted to reduce guest confusion. |
| API validation | Zod (new dependency) | CLAUDE.md convention; cross-field date refine is the non-trivial rule that Zod handles cleanly. |
| Token value | `crypto.randomUUID()` | Native on Workers, opaque UUID in DB — matches the F-01 schema decision. |
| QR URL path | `/guest/verify?token=<uuid>` | Defines the contract S-02 depends on; path and param name must not change during implementation. |

## Scope

**In scope:**
- `StaffLayout.astro` with `print:hidden` nav header applied to `/dashboard` and `/dashboard/generate-token`
- `POST /api/staff/generate-token` — auth guard, Zod validation, UUID generation, Supabase insert, JSON response
- `/dashboard/generate-token` Astro SSR page — fetches packages + rooms, mounts React form
- `TokenGeneratorForm` React component — form state, API call, QR display, print, reset
- `npm install zod` + `npm install react-qr-code`

**Out of scope:**
- Guest session cookie issuance (S-02)
- Token listing / history view (S-04 or post-MVP)
- Staff account creation (out-of-band, not in MVP)
- Download as PNG/SVG file (post-MVP)
- Email delivery of QR tokens (no PMS integration)
- Package/service CRUD (parked in roadmap)

## Architecture / Approach

Staff DB access uses the existing SSR Supabase client (`SUPABASE_KEY` anon + Supabase Auth session cookie). When staff is authenticated, queries run under the `authenticated` RLS role, which has full INSERT/SELECT rights on `guest_tokens`, `packages`, and `room_qr_codes`. No `SUPABASE_SERVICE_ROLE_KEY` needed for this slice.

The QR value is assembled client-side using `window.location.origin` + the hardcoded path `/guest/verify?token=` + the UUID returned by the API — so the QR always links to the correct host regardless of environment (dev vs prod).

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Staff Layout | `StaffLayout.astro` with nav + `print:hidden`; applied to `/dashboard` | Layout regression on existing dashboard |
| 2. Token Generation API | `POST /api/staff/generate-token` with Zod + UUID + DB insert | Zod cross-field date validation wiring |
| 3. Generate Token Page + QR | Astro page + `TokenGeneratorForm` React component + QR display + print | `react-qr-code` SSR hydration; print layout |

**Prerequisites:** F-01 done (confirmed). Supabase running locally or cloud project linked. Staff user account exists (created out-of-band).

**Estimated effort:** ~1 session across 3 phases.

## Open Risks & Assumptions

- `react-qr-code` renders an SVG via React — it requires `client:load` (not SSR) to avoid hydration issues with `window.location.origin`; the plan accounts for this.
- The `/guest/verify` endpoint does not exist yet; scanning the QR will return a 404 until S-02 ships. This is expected and acceptable.
- If Supabase's anon key RLS on `packages`/`room_qr_codes` returns empty results (e.g. mismatched `active` flag), the dropdowns will be empty — verify seed data is applied before testing.

## Success Criteria (Summary)

- Staff can fill in the form and generate a QR that, when scanned, resolves to `<origin>/guest/verify?token=<uuid>`
- A `guest_tokens` row is created with the correct data and the staff user's `created_by` ID
- Browser Print Preview shows QR + guest summary; staff nav is hidden on print
