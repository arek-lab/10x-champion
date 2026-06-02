# Services Image Field — Plan Brief

> Full plan: `context/changes/services-image-field/plan.md`

## What & Why

Add an `image_url` column to the `services` table and display a 48px thumbnail in the guest panel for every service — both included services and add-ons. When the URL is null, a category-keyed lucide-react icon fills the slot. The change makes the service catalog visually scannable on mobile without requiring a full image upload system.

## Starting Point

The `services` table has no image column. The guest panel renders service names and descriptions as plain text lists in two places: an inline Astro template (included services) and the `AddonList` React component (add-ons). No image-handling infrastructure exists in the codebase.

## Desired End State

Every service card in the guest panel shows a 48×48px rounded thumbnail left of the name. Real images appear when `image_url` is set; a category-appropriate lucide icon (Utensils, Waves, Wifi, Clock) appears when it is null. The 8 seed services carry picsum.photos URLs so local dev shows the full visual experience without manual DB edits.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Placeholder type | Lucide-react category icon | Zero new assets; consistent with the app's icon-only design language |
| Scope | Both included + add-ons | Visual consistency across the whole guest panel |
| Layout | 48px thumbnail left of name | Compact; fits existing card layout without restructuring |
| Seed data | Add picsum.photos URLs via new migration UPDATE | Lets devs preview the full image UX on first `db reset` |
| Error fallback | None (MVP) | Seed URLs are stable; runtime broken-image handling is out of scope |

## Scope

**In scope:**
- `ALTER TABLE services ADD COLUMN image_url text` migration
- UPDATE seed rows in the same migration
- `src/types.ts` services type update
- `ServiceImage.tsx` shared component (img or icon)
- `panel.astro` query + included-services render
- `AddonList.tsx` interface + render

**Out of scope:**
- Staff panel image upload UI
- Image optimisation (Cloudflare Images, Astro `<Image>`)
- Runtime `onError` fallback for broken URLs
- Changes to orders API or staff panel

## Architecture / Approach

Shared `ServiceImage.tsx` React component (no hooks) renders either an `<img>` or a category-keyed lucide-react icon. Used in the Astro template (SSR, no client directive) for included services, and imported directly inside `AddonList.tsx` (already client:load) for add-ons. Data flows from the DB column through the existing `package_services` join query by extending the select string to include `image_url` and `category`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Data Layer | Migration + types + query extended | Migration UPDATE must use fixed seed UUIDs; easy to verify |
| 2. UI Layer | ServiceImage component wired into both render paths | Astro template restructure must not break the ✓ badge layout |

**Prerequisites:** Local Supabase stack running (`npx supabase start`)
**Estimated effort:** ~1 session across 2 phases

## Open Risks & Assumptions

- picsum.photos requires internet access during local dev image loads — offline devs will see broken images (icon fallback not implemented).
- `category` values in the DB must match the map keys exactly (`food`, `wellness`, `facilities`, `convenience`); any new category introduced later will fall back to the generic `Package` icon.

## Success Criteria (Summary)

- Guest panel shows thumbnails for all 8 seeded services after `npx supabase db reset`.
- Setting `image_url = null` for any service in Studio immediately shows the category icon on next panel load.
- Mobile layout (375px) is intact; add-on order/cancel flow works without regression.
