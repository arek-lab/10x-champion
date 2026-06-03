# Dashboard AI Concierge — Plan Brief

> Full plan: `context/changes/dashboard-ai-concierge/plan.md`

## What & Why

Dodajemy sekcję "AI Concierge" w dashboardzie personelu — link w nawigacji (desktop + mobile) prowadzący do strony z dwoma tabami: formularzem danych hotelowych i pustym placeholderem alertów. Cel to zaoferowanie personelowi widoku danych, na których opiera się AI concierge gościa, z fake-door przyciskiem "Zapisz" sygnalizującym przyszłą możliwość edycji.

## Starting Point

AI concierge dla gościa (`S-05`) działa — odpowiada na pytania na podstawie `src/lib/hotel-context.ts`. Dashboard personelu (`D-04`) ma mobile nav z hamburger menu. Brakuje linku i strony dla AI Concierge w panelu staff.

## Desired End State

Personel widzi "AI Concierge" w nawigacji (desktop i mobile). Po wejściu na `/dashboard/ai-concierge` widzi dwa taby: formularz z aktualną konfiguracją hotelu (pre-wypełniony z `hotelContext`) z fake-door przyciskiem "Zapisz" oraz pusty placeholder alertów gotowy na przyszłe dane.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Fake door feedback | Inline "✓ Zapisano" (lokalny React state, auto-clear 2s) | Brak biblioteki toast/sonner w projekcie | Plan |
| System prompt preview | Pominięty | Zbyt szeroki zakres dla fake-door etapu | Plan |
| Pola "Addony/Ceny" | Pominięte | LLM czyta usługi z bazy, nie z formularza | User |
| Pola formularza | 8 pól z hotelContext (FormField + ręczne textareas) | Bezpośrednie mapowanie na istniejący obiekt | Plan |

## Scope

**In scope:**
- `npx shadcn@latest add tabs` — instalacja komponentu
- `src/pages/dashboard/ai-concierge.astro` — nowa strona chroniona middleware
- `src/layouts/StaffLayout.astro` — link desktop nav
- `src/components/staff/MobileNav.tsx` — link mobile nav
- `src/components/staff/AiConciergePanel.tsx` — Tabs island
- `src/components/staff/HotelDataForm.tsx` — formularz fake-door
- `src/components/staff/AlertsPanel.tsx` — placeholder

**Out of scope:**
- Zapis do backendu / Supabase
- localStorage
- Podgląd system prompt
- Edycja `hotel-context.ts`

## Architecture / Approach

Strona Astro (`ai-concierge.astro`) ładuje jeden React island (`AiConciergePanel`) z `client:load` — bez props, bez danych serwera (dane hotelowe importowane po stronie klienta z `hotel-context.ts`). Island renderuje shadcn Tabs z dwoma tabami.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. shadcn Tabs + strona + nawigacja | Routing działa, link widoczny w obu menu | shadcn CLI może wymagać interakcji |
| 2. Komponenty panelu | Formularz pre-wypełniony, fake door, placeholder alertów | FormField dark variant — dopasowanie stylów textareas |

**Prerequisites:** D-04 (mobile nav) — done ✓; S-05 (AI concierge) — done ✓  
**Estimated effort:** ~1 sesja, 2 fazy

## Open Risks & Assumptions

- shadcn `tabs` install generuje `src/components/ui/tabs.tsx` — jeśli CLI wymaga interakcji, implementator musi zatwierdzić ręcznie
- `FormField` wymaga prop `icon: ReactNode` — dla każdego pola tekstowego potrzebny import ikony Lucide

## Success Criteria (Summary)

- Nawigacja (desktop + mobile) zawiera "AI Concierge" z poprawnym routingiem
- Formularz wyświetla dane z `hotel-context.ts`, fake-door Save działa bez requestów sieciowych
- Obie taby renderują się bez błędów TypeScript i konsoli
