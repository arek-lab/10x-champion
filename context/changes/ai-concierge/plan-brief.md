# AI Concierge — Plan Brief

> Full plan: `context/changes/ai-concierge/plan.md`

## What & Why

Build S-05: give guests a floating AI chat widget on the guest panel where they can ask hotel-specific questions and receive contextual answers. The concierge answers based on hardcoded pilot hotel data (amenities, local area, house rules) and the guest's own room number and check-out date — making answers feel specific rather than generic, which is the NFR the PRD explicitly guards against.

## Starting Point

S-02 and S-03 are complete: the guest panel (`/guest/panel.astro`) renders included services and add-ons with an interactive React island (`AddonList.tsx`). The `context.locals.guestToken` JWT carries room number, package ID, and check-out date. No AI SDK is installed; `OPENAI_API_KEY` is absent from the env schema.

## Desired End State

The guest panel has a floating "Ask the concierge" button at the bottom-right. Tapping it opens a chat modal. The guest asks a question, sees a skeleton loader, and receives a hotel-specific reply from GPT-4o mini. Follow-up questions work (last 6 messages sent as context). An inline error message appears if the API fails; the app never crashes. Closing and re-opening the modal preserves the session conversation.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| AI provider / model | OpenAI GPT-4o mini | User chose OpenAI; gpt-4o-mini is cheap and fast enough for hotel FAQ Q&A | Plan |
| Conversation model | Multi-turn, last 6 messages | Follow-up questions ("and the sauna?") are common concierge patterns; 6-message cap avoids token cost growth | Plan |
| UI placement | Floating button → modal (fixed bottom-right) | Overlay pattern keeps the service panel layout untouched; discoverable without extra navigation | Plan |
| Response mode | Full response + skeleton loader | SSE through Workers adds meaningful complexity; skeleton loader covers 1–2 s wait acceptably | Plan |
| Hotel context delivery | `src/lib/hotel-context.ts` (TypeScript config) | Type-safe, bundled at build time, easy to edit before pilot; JSON file gives no runtime benefit on Workers | Plan |
| Context content | All four: basics + amenities + local area + FAQ/rules | Covers all common concierge question categories; avoids generic answers for any of them | Plan |
| Guest personalisation | Inject room number + check-out date from JWT | Data already in the JWT cookie — zero extra DB queries; makes answers feel genuinely personal | Plan |

## Scope

**In scope:**
- `npm install openai` + `OPENAI_API_KEY` in env schema and `.env.example`
- `src/lib/hotel-context.ts` — typed pilot hotel data + `buildSystemPrompt(guest)` function
- `src/pages/api/guest/concierge.ts` — POST endpoint with auth, Zod validation, OpenAI call
- `src/components/guest/ConciergeWidget.tsx` — floating button, chat modal, skeleton loader, 6-message history
- `src/pages/guest/panel.astro` — add `<ConciergeWidget client:load />`

**Out of scope:**
- Streaming / SSE responses
- Conversation persistence in DB
- Rate limiting or per-session quotas
- Access to guest order history
- Package name lookup (room + check-out date suffice)
- Moderation layer

## Architecture / Approach

Stateless API endpoint — no new DB tables. The `POST /api/guest/concierge` route authenticates via the existing `guest_session` cookie (same pattern as `/api/guest/orders`), builds the system prompt client-invisibly, and proxies to OpenAI. The client is a React island that manages conversation state locally. The floating button uses `fixed bottom-6 right-6 z-50` and escapes the layout flow regardless of DOM position.

```
Guest types question
  → ConciergeWidget.tsx (React, client:load)
      manages messages[] in useState (cap 6)
      POST /api/guest/concierge  { messages: [...] }
          ↓ auth via guest_session cookie
          ↓ buildSystemPrompt({ roomNumber, checkOutDate })
          ↓ OpenAI gpt-4o-mini
      ← { content: string }
  → Append assistant reply to messages[]
  → Hide skeleton loader
```

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. SDK + Hotel Context | openai installed, OPENAI_API_KEY in schema, hotel-context.ts with pilot data | Cloudflare Workers compat — openai SDK is fetch-based and nodejs_compat covers it; low risk |
| 2. Concierge API | `POST /api/guest/concierge` with auth, Zod validation, GPT-4o mini call | Missing/invalid OPENAI_API_KEY must return graceful 503, not crash |
| 3. ConciergeWidget + wiring | Floating button, chat modal, skeleton, 6-msg cap, panel.astro wired | Fixed-position z-index must not cover staff nav or other modal layers |

**Prerequisites:** S-02 complete ✓, S-03 implementing (guest panel + guestToken cookie required); real `OPENAI_API_KEY` added to `.dev.vars` before Phase 2 manual testing.

**Estimated effort:** ~1 session across 3 phases.

## Open Risks & Assumptions

- `hotel-context.ts` is populated with placeholder data — real pilot hotel details must be filled in before deployment or responses will reference fake hotel info.
- OpenAI GPT-4o mini latency is 0.5–2 s; on a slow mobile connection the skeleton loader may show for 3–4 s — acceptable for MVP, revisit if pilot feedback flags it.
- Workers CPU time is not affected by OpenAI round-trip (network wait ≠ CPU time), so the free-tier concern does not apply here.

## Success Criteria (Summary)

- Guest asks "What time is check-out?" and receives an answer that cites the hotel's actual check-out time, not a generic response
- Multi-turn follow-up questions work correctly up to the 6-message cap
- API failure (bad key, OpenAI outage) shows a friendly inline error — the panel never crashes or goes blank
