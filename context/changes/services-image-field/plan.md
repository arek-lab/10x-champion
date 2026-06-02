# Services Image Field Implementation Plan

## Overview

Add an `image_url text` (nullable) column to the `services` table and surface it in the guest panel as a 48px thumbnail to the left of each service's name. When `image_url` is null, a category-keyed lucide-react icon renders in place. Both the included-services section and the add-ons section receive the same treatment. Seed data gains picsum.photos URLs for local dev previews.

## Current State Analysis

The `services` table (`supabase/migrations/20260528000001_schema.sql:2-10`) has no image column. The guest panel renders two sections:
- **Included services** — inline Astro template in `src/pages/guest/panel.astro:66-80`, no image slot.
- **Add-ons** — React component `src/components/guest/AddonList.tsx`, `Addon` interface at `:3-8` has `id`, `name`, `description`, `price_pln` only.

The codebase has no image-handling infrastructure: no `<img>` tags, no placeholder assets beyond `favicon.png`, no onError patterns. All visual icons are lucide-react SVG components.

`src/types.ts:222-251` holds the hand-maintained Supabase `services` type with no `image_url` field. The query at `panel.astro:36` selects `services(id, name, description, active, price_pln)` — `category` is not fetched yet, but it is required for the icon fallback.

## Desired End State

Every service card in the guest panel (both included and add-on sections) shows a 48×48px rounded thumbnail immediately left of the service name. If the DB row has a valid `image_url`, the thumbnail is an `<img>` tag. If `image_url` is null, a lucide-react icon matched to the service category fills the same slot (food → Utensils, wellness → Waves, facilities → Wifi, convenience → Clock, unknown → Package). The 8 seed services all have picsum.photos URLs set so local dev shows real images without manual DB edits.

### Key Discoveries:

- `panel.astro:36` — select string must be extended; `category` is not currently fetched.
- `AddonList.tsx:3-8` — `Addon` interface must gain `image_url: string | null` and `category: string`.
- No `client:*` directive is needed for the new `ServiceImage` component on the included-services side (SSR renders the img/icon; no interactivity required).
- Seed rows use `ON CONFLICT (id) DO NOTHING`, so image URLs cannot be added by modifying the existing INSERT. A new migration must UPDATE the rows.

## What We're NOT Doing

- No `onError` fallback for broken URLs at runtime (picsum.photos URLs in seed are stable; production images are an operational concern outside MVP scope).
- No image upload UI or staff panel for managing images.
- No image optimisation pipeline (Cloudflare Images, Astro's `<Image>` component, etc.).
- No changes to staff panel or orders API — images are display-only on the guest side.

## Implementation Approach

Two-phase propagation: data layer first (migration → types → query), then UI layer (shared component → wire into both render paths). The `ServiceImage` component is a pure render function (no hooks), so it works in Astro SSR without a `client:*` directive.

## Phase 1: Data Layer

### Overview

Add the column, update the seed rows, propagate the type change, and extend the fetch query.

### Changes Required:

#### 1. New migration: add column + seed image URLs

**File**: `supabase/migrations/20260602000001_services_add_image_url.sql`

**Intent**: Add `image_url text` (nullable) to `services` and populate the 8 existing seed rows with deterministic picsum.photos URLs so local dev shows images immediately.

**Contract**: Single `ALTER TABLE … ADD COLUMN IF NOT EXISTS` followed by 8 `UPDATE` statements keyed on the fixed seed UUIDs from `20260528000003_seed.sql`.

#### 2. Update Supabase type definition

**File**: `src/types.ts`

**Intent**: Add `image_url` to the `services` Row, Insert, and Update shapes so the TypeScript compiler enforces the new column everywhere.

**Contract**: In `services.Row` (`:223`) add `image_url: string | null`. In `services.Insert` (`:232`) add `image_url?: string | null`. In `services.Update` (`:241`) add `image_url?: string | null`. All three blocks are alphabetically ordered — insert between `id` and `name`.

#### 3. Extend the package_services select query

**File**: `src/pages/guest/panel.astro`

**Intent**: Pull `image_url` and `category` from the services join so both template sections have the data they need.

**Contract**: At `:36`, change the select string from `services(id, name, description, active, price_pln)` to `services(id, name, description, category, active, price_pln, image_url)`.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly against a local Supabase reset: `npx supabase db reset`
- TypeScript compiles without errors: `npm run build` (or `npx tsc --noEmit`)
- Linting passes: `npm run lint`

#### Manual Verification:

- After `db reset`, `SELECT id, name, image_url FROM public.services;` returns all 8 rows with non-null URLs.
- No TypeScript errors in `src/types.ts` or files importing the `services` type.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: UI Layer

### Overview

Create a shared `ServiceImage` component, update the included-services Astro template, and extend `AddonList` to render thumbnails.

### Changes Required:

#### 1. New component: ServiceImage

**File**: `src/components/guest/ServiceImage.tsx`

**Intent**: Encapsulate the "image or category icon" logic in one place so both the Astro template and AddonList can share it.

**Contract**: Accept props `{ imageUrl: string | null; category: string; name: string }`. When `imageUrl` is set, render `<img src={imageUrl} alt={name} className="h-12 w-12 rounded-lg object-cover shrink-0" />`. When null, render a `<div>` of the same dimensions with `bg-muted flex items-center justify-center rounded-lg shrink-0` containing a lucide-react icon sized 24px. Category-to-icon map: `food → Utensils`, `wellness → Waves`, `facilities → Wifi`, `convenience → Clock`, fallback → `Package`. No hooks; no client-side state.

#### 2. Wire ServiceImage into included services (Astro template)

**File**: `src/pages/guest/panel.astro`

**Intent**: Show the thumbnail to the left of each included service's name, consistent with the add-ons layout.

**Contract**: Import `ServiceImage` (no client directive needed). In the `included.map()` render block (`:68`), restructure the `<li>` inner content to: `[✓ badge] [ServiceImage] [name + description]` in a flex row. Pass `imageUrl={service.image_url ?? null}`, `category={service.category}`, `name={service.name}`. The existing `gap-3 flex items-start` container handles spacing.

#### 3. Extend AddonList: Addon interface + thumbnail render

**File**: `src/components/guest/AddonList.tsx`

**Intent**: Pass `image_url` and `category` through to each add-on card and render the thumbnail.

**Contract**: Add `image_url: string | null` and `category: string` to the `Addon` interface (`:3-8`). Import `ServiceImage`. In the `addons.map()` return block (`:120`), add `<ServiceImage imageUrl={addon.image_url} category={addon.category} name={addon.name} />` as the first child of the `flex items-start justify-between` container, before the name/description `<div>`. Adjust the flex layout if needed so the thumbnail + text block sits on the left and the price/button block stays on the right.

### Success Criteria:

#### Automated Verification:

- TypeScript compiles without errors: `npm run build`
- Linting passes: `npm run lint`

#### Manual Verification:

- Guest panel loads and shows thumbnails for both included services and add-ons.
- Services with seed URLs display a picsum.photos image.
- If `image_url` is manually set to `null` in DB, the corresponding service shows a category icon (not a broken image).
- Layout is not broken on mobile viewport (375px wide).
- Add-on order/cancel flow still works after AddonList changes.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for final manual confirmation.

---

## Testing Strategy

### Manual Testing Steps:

1. Run `npx supabase db reset` to apply migration and seed.
2. Start dev server: `npm run dev`.
3. Create a guest token (any package), scan through to the guest panel.
4. Confirm thumbnails appear in both "Included in your package" and "Available add-ons".
5. Open Supabase Studio → update one service's `image_url` to `null` → refresh guest panel → confirm category icon renders.
6. Place and cancel an add-on order to confirm AddonList interactivity is unaffected.

## References

- Schema migration: `supabase/migrations/20260528000001_schema.sql`
- Seed migration: `supabase/migrations/20260528000003_seed.sql`
- Guest panel: `src/pages/guest/panel.astro`
- AddonList: `src/components/guest/AddonList.tsx`
- Types: `src/types.ts:222-251`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data Layer

#### Automated

- [x] 1.1 Migration applies cleanly: `npx supabase db reset` — adac198
- [x] 1.2 TypeScript compiles without errors: `npm run build` — adac198
- [x] 1.3 Linting passes: `npm run lint` — adac198

#### Manual

- [x] 1.4 All 8 seed services have non-null image_url after db reset — adac198
- [x] 1.5 No TypeScript errors in files importing the services type — adac198

### Phase 2: UI Layer

#### Automated

- [x] 2.1 TypeScript compiles without errors: `npm run build`
- [x] 2.2 Linting passes: `npm run lint`

#### Manual

- [ ] 2.3 Thumbnails visible in both included-services and add-ons sections
- [ ] 2.4 Null image_url shows category icon, not broken image
- [ ] 2.5 Layout intact on 375px mobile viewport
- [ ] 2.6 Add-on order/cancel flow works after AddonList changes
