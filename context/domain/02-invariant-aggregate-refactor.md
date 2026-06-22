---
title: Niezmiennik #1 → agregat-strażnik — refaktor cyklu życia zamówienia (Order)
created: 2026-06-22
type: refactor-plan
---

# Niezmiennik #1 → agregat-strażnik: cykl życia `Order`

> Produktem tego dokumentu jest **PLAN refaktoru**, nie kod. Niezmiennik #1 został
> **odkryty i wybrany** (KROK 0–2), nie założony z góry. Wszystkie cytaty `plik:linia`
> zweryfikowano odczytem źródeł 2026-06-22. Uzupełnia [`01-domain-distillation.md`](./01-domain-distillation.md);
> tam ranking wg ryzyka bezpieczeństwa — tu wybór wg dopasowania „niezmiennik → agregat-strażnik".

---

## KROK 0 — Odkryty kontekst

- **Źródła wymagań:** `context/foundation/prd.md` (PRD v1, greenfield), `context/foundation/shape-notes.md`,
  `context/foundation/roadmap.md`, `context/domain/01-domain-distillation.md` (mapa domeny + 9 rozjazdów model–kod).
- **Stack:** Astro 6 SSR + React 19 islands + Supabase (Postgres) + Cloudflare Workers (`CLAUDE.md`).
- **Gdzie żyje logika biznesowa (zweryfikowane):** **brak wydzielonej warstwy domenowej**. Reguły
  zamówienia są rozsmarowane po czterech warstwach:
  1. **Persystencja:** CHECK + indeksy + trigger (`supabase/migrations/20260528000001_schema.sql:54-83`),
     RLS (`20260528000002_rls.sql:24-31`).
  2. **Trasy API:** `src/pages/api/guest/orders/{index,[id]}.ts`, `src/pages/api/staff/orders/{index,[id]}.ts`.
  3. **Strony SSR:** `src/pages/dashboard.astro`.
  4. **UI (klient):** `src/components/staff/OrderList.tsx`.
- **Infrastruktura testów istnieje:** Vitest + test integracyjny na klient service-role
  (`src/__tests__/orders.integration.test.ts`) pokrywa już Risk #4/#5/#6 — fazy refaktoru mogą iść **test-first**.

---

## KROK 1 — Zidentyfikowane niezmienniki biznesowe

Reguły, które w tej domenie MUSZĄ być zawsze prawdziwe (źródło + cytat):

| # | Niezmiennik | Źródło |
|---|---|---|
| I-1 | Status zamówienia ∈ {pending, fulfilled, cancelled} | `prd.md:47`; `schema.sql:58` |
| I-2 | Cykl życia jest **jednokierunkowy**: `pending → {fulfilled \| cancelled}`; stan terminalny nie wraca do pending | `prd.md:136` (przepływ), US-03 `prd.md:73-81` |
| I-3 | Gość anuluje **tylko własne** zamówienie i **tylko dopóki `pending`** | `prd.md:71`, `prd.md:102` (FR-009) |
| I-4 | Staff realizuje/anuluje **tylko z `pending`** (idempotencja realizacji) | `prd.md:108` (US-03), `prd.md:118` (FR-013) |
| I-5 | **Każda zmiana statusu pozostawia trwały ślad** — zamówienie nigdy nie znika ani nie jest ukrywane bez śladu | `prd.md:47`, `prd.md:70` (guardrail) |
| I-6 | **Da się ustalić, KTO** oznaczył zamówienie (audyt wykonawcy) | `prd.md:150`, `shape-notes.md:48` |
| I-7 | Zamawialna jest tylko usługa o `inclusion_type='addon'` w pakiecie gościa | `prd.md:135` (FR-007/008) |
| I-8 | Brak duplikatu **aktywnego** (`pending`) zamówienia tej samej usługi | dorozumiane z „licznika nowych" `prd.md:120` |
| I-9 | Izolacja gościa: gość czyta/zmienia wyłącznie własne zamówienia | `prd.md:46`, `prd.md:153` |
| I-10| Tylko rola `staff` zarządza zamówieniami wszystkich gości | `prd.md:154` |

**Obserwacja kluczowa:** I-2…I-6 to nie luźne reguły — to **jeden spójny niezmiennik cyklu życia jednego
bytu (`Order`)**. Tym bytem jest naturalny **agregat**: ma tożsamość, stan i jawne przejścia z preconditions.

---

## KROK 2 — Klasyfikacja i wybór #1

Trzy osie (a) rdzeniowość, (b) rozsmarowanie, (c) realna egzekucja:

| Niezmiennik | (a) Rdzeniowy? | (b) Rozsmarowany? | (c) Egzekwowany? |
|---|---|---|---|
| **Cykl życia `Order` (I-2…I-6 razem)** | **Rdzeń** — to połowa „dwóch mechanizmów rdzenia" (`prd.md:134-136`), North star pętli self-service | **Maksymalnie** — DB CHECK + 2 trasy gościa + 2 trasy staff + filtr `dashboard.astro` + `OrderList.tsx` | **Niespójnie** — przejście „pending-only" tak; **ślad (I-5) złamany**, **audyt (I-6) nieobecny** |
| Izolacja gościa (I-9) | Guardrail bezp. (`prd.md:46`) | Średnio | Słabo (tylko ręczny `.eq`) → **wchłonięta** jako kontrakt ładowania repozytorium `Order` |
| Granica roli `staff` (I-10) | Wspiera rdzeń | Średnio | Słabo (RLS `USING(true)`) → **wchłonięta** jako strażnik na krawędzi tras staff |
| Wygasanie/obecność `GuestToken` (I-1 tokenu) | Rdzeń | Defense-in-depth | **Mocno** — pomijamy |
| Klasyfikacja included/addon (I-7) | Rdzeń | Niski | **Mocno** (DB + UI) — pomijamy |

### Wybór #1 (uzasadnienie)

**Niezmiennik #1 = integralność cyklu życia zamówienia (`Order`):**

> *Zamówienie przechodzi wyłącznie `pending → {fulfilled | cancelled}`, przejścia dokonuje autoryzowany
> aktor właściwego rodzaju (gość tylko swoje i tylko anulowanie; staff realizuje/anuluje), a każde przejście
> jest trwale zapisane z aktorem i czasem; zamówienie nigdy nie jest kasowane ani ukrywane — pełny ślad jest
> zawsze odczytywalny.*

To jednocześnie **najbardziej rdzeniowy** (jawnie połowa rdzenia produktu, `prd.md:134-136`; spina guardrail
`prd.md:47`) **i — jako całość — najsłabiej egzekwowany** rdzeniowy niezmiennik: happy-path przejścia działają,
ale dwa wymiary TEGO SAMEGO niezmiennika są naruszone — **ślad (I-5) jest aktywnie łamany** (panel ukrywa
zrealizowane) i **audyt (I-6) jest zadeklarowany, lecz nieobecny w schemacie**. Dodatkowo reguła „kto i kiedy"
nie istnieje jako kod — żyje wyłącznie w *rozmieszczeniu* tras (że jest osobna trasa gościa i osobna staff).

**Dlaczego nie sama izolacja gościa (ranking #1 w dok. 01):** izolacja to przekrojowa *autoryzacja*, nie
niezmiennik agregatu — nie ma naturalnego korzenia ani przejść stanu. Mieści się natomiast idealnie jako
**kontrakt ładowania** repozytorium `Order` (ładujesz zamówienie *dla danego aktora*). Wybierając `Order` jako
agregat-strażnik, rozwiązujemy I-9 i I-10 *w tej samej granicy* (przy load/save), zamiast jako osobny refaktor.

---

## KROK 3 — Diagnoza niezmiennika #1 (gdzie dziś żyje reguła)

### 3.1 Przejścia stanu — rozproszone, brak pojedynczego strażnika

| Reguła | Gdzie egzekwowana dziś | Problem |
|---|---|---|
| Enum statusu (I-1) | `schema.sql:58` (`CHECK status IN (...)`) | OK, ale CHECK **nie** pilnuje kierunku |
| Kierunek `pending→…` (I-2, I-4) | tylko aplikacyjnie: `.eq("status","pending")` w `staff/orders/[id].ts:46` i `guest/orders/[id].ts:45` | **DB nie broni** `fulfilled→pending` ani `cancelled→fulfilled`; jedyna bariera to filtr w UPDATE w dwóch różnych plikach |
| Gość: own + pending (I-3) | `guest/orders/[id].ts:26-39` (read `.eq("guest_token_id")` + `status!=="pending"→409`) | read-then-write (TOCTOU) — łagodzone dopiero przez `.eq("status","pending")` w `:45` |
| Staff: pending→… (I-4) | `staff/orders/[id].ts:42-55` (`update().eq("status","pending")` + `PGRST116→409`) | logika identyczna co u gościa, **zduplikowana** w innym pliku |

**Konkluzja:** ta sama reguła przejścia jest zaimplementowana **dwa razy** (gość/staff), każda ręcznie, bez
wspólnego źródła prawdy. Rodzaj aktora („gość vs staff") nie jest reprezentowany w danych — wynika wyłącznie
z tego, *przez którą trasę* przyszło żądanie.

### 3.2 Ślad (I-5) — guardrail aktywnie łamany

- Panel recepcji i dashboard pokazują **wyłącznie `pending`**:
  `src/pages/api/staff/orders/index.ts:20` (`.eq("status","pending")`),
  `src/pages/dashboard.astro:14` (`.eq("status","pending")`).
- Po realizacji karta **znika z widoku**: `src/components/staff/OrderList.tsx:78`
  (`setOrders((prev) => prev.filter((o) => o.id !== orderId))`).
- **Brak widoku historii** po stronie staff. Rekord nie jest kasowany (UPDATE), ale dla recepcji jest
  nieodróżnialny od skasowanego → guardrail `prd.md:47` („każda zmiana statusu jest widoczna w panelu") złamany.

### 3.3 Audyt (I-6) — zadeklarowany, nieobecny

- `orders` nie ma kolumny wykonawcy: kolumny to `id, guest_token_id, service_id, status, notes, created_at, updated_at`
  (`schema.sql:54-62`; potwierdzenie w typach `src/types.ts:93-120`).
- Staff UPDATE nie zapisuje, kto zmienił: `src/pages/api/staff/orders/[id].ts:42-48`.
- `updated_at` jest bumpowane triggerem (`schema.sql:81-83`), ale bez aktora → `prd.md:150` niewykonalne.

### 3.4 Klient/krawędź jako jedyny strażnik + połknięte błędy (łamanie fail-fast)

- **Granica roli (I-10) nie istnieje na trasach zamówień:** `staff/orders/index.ts:7-9` i
  `staff/orders/[id].ts:13-16` sprawdzają tylko `context.locals.user` (zalogowany), **nie rolę**.
  RLS też nie zawęża: `staff_read_orders`/`staff_update_orders` to `TO authenticated USING (true)`
  (`20260528000002_rls.sql:27-31`). `/dashboard` chroniony tylko „czy zalogowany" (`middleware.ts:20-24`).
  → każdy zalogowany użytkownik czyta i zmienia zamówienia **wszystkich** gości.
- **Izolacja gościa (I-9) trzymana wyłącznie ręcznym filtrem** na kliencie service-role omijającym RLS:
  `lib/supabase.ts:6-19` (service-role) + `.eq("guest_token_id", tokenId)` w `guest/orders/index.ts:28` i `[id].ts:30`.
- **Błędy DB połknięte (fail-fast złamany):**
  - `guest/orders/index.ts:64` — `const { data: addonRow } = ...` (błąd zapytania zignorowany) → przy awarii DB zwraca mylące `403 "Service not available"`.
  - `guest/orders/index.ts:76` — sprawdzenie duplikatu ignoruje błąd → przy awarii „udaje", że duplikatu nie ma.
  - `guest/orders/[id].ts:26` — read ignoruje błąd → zamienia awarię na `404`.
  - `OrderList.tsx:49-51` i `:80-81` — błędy sieci „cicho ignorowane".
- **Wyścig na duplikat (I-8):** brak unikalnego indeksu częściowego; sprawdzenie „czy istnieje pending"
  (`guest/orders/index.ts:76-86`) i insert (`:88-92`) są nieatomowe → równoległe żądania tworzą dwa `pending`.

---

## KROK 4 — Projekt agregatu-strażnika `Order`

Zasada: **JEDNO miejsce** egzekwuje I-2…I-6. Reguła schodzi z klienta/tras do (1) czystego agregatu domenowego
i (2) atomowej funkcji Postgres będącej ostatecznym strażnikiem przejścia + zapisu śladu w jednej transakcji.

### 4.1 Agregat domenowy (czysty TS, bez Supabase) — `src/lib/domain/order.ts`

```ts
export type OrderStatus = "pending" | "fulfilled" | "cancelled";
export type ActorKind   = "guest" | "staff";

export interface Actor { kind: ActorKind; id: string; } // guest.id = guest_token_id; staff.id = auth user id

export interface OrderTransition {
  from: OrderStatus; to: OrderStatus;
  actorKind: ActorKind; actorId: string; at: string;
}

// --- nazwane błędy domenowe (fail-fast; nigdy „loguj i jedź dalej") ---
export class OrderError extends Error {}
export class OrderNotPending     extends OrderError {} // I-2/I-4: stan terminalny
export class OrderNotOwnedByGuest extends OrderError {} // I-3/I-9: cudze zamówienie
export class ForbiddenActor      extends OrderError {} // I-3/I-4: zły rodzaj aktora
export class ServiceNotOrderable extends OrderError {} // I-7
export class DuplicatePendingOrder extends OrderError {} // I-8

export class Order {
  private constructor(
    readonly id: string,
    readonly guestTokenId: string,
    readonly serviceId: string,
    private _status: OrderStatus,
  ) {}

  static rehydrate(row: { id; guest_token_id; service_id; status }): Order { /* z repo */ }

  get status() { return this._status; }

  /** I-3: tylko właściciel, tylko z pending → produkuje przejście do zapisania */
  cancelByGuest(actor: Actor): OrderTransition {
    if (actor.kind !== "guest") throw new ForbiddenActor();
    if (actor.id !== this.guestTokenId) throw new OrderNotOwnedByGuest();
    return this.#transitionFromPending("cancelled", actor);
  }

  /** I-4: staff realizuje, tylko z pending */
  fulfillByStaff(actor: Actor): OrderTransition {
    if (actor.kind !== "staff") throw new ForbiddenActor();
    return this.#transitionFromPending("fulfilled", actor);
  }

  /** I-4: staff anuluje, tylko z pending */
  cancelByStaff(actor: Actor): OrderTransition {
    if (actor.kind !== "staff") throw new ForbiddenActor();
    return this.#transitionFromPending("cancelled", actor);
  }

  #transitionFromPending(to: OrderStatus, actor: Actor): OrderTransition {
    if (this._status !== "pending") throw new OrderNotPending(); // I-2: jednokierunkowość
    const at = new Date().toISOString();
    const t: OrderTransition = { from: this._status, to, actorKind: actor.kind, actorId: actor.id, at };
    this._status = to;
    return t;
  }
}
```

Precondicje są **jedynym** wejściem do zmiany stanu — nielegalna operacja **rzuca**, nie aktualizuje cicho.

### 4.2 Ślad + atomowość — append-only log w JEDNEJ transakcji

Niezmiennik I-5 (nic nie znika) + I-6 (kto) → **dziennik niezmienny** zapisywany **atomowo** z przejściem.
Ponieważ supabase-js nie robi wielostatementowej transakcji po stronie klienta, ostatecznym strażnikiem jest
**funkcja Postgres** — przejście i wpis śladu albo razem się commitują, albo wcale.

```sql
-- migracja: 2026MMDDHHmmss_order_transition_guard.sql
CREATE TABLE public.order_status_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid NOT NULL REFERENCES public.orders(id),
  from_status text NOT NULL,
  to_status   text NOT NULL CHECK (to_status IN ('fulfilled','cancelled')),
  actor_kind  text NOT NULL CHECK (actor_kind IN ('guest','staff')),
  actor_id    uuid NOT NULL,             -- guest_token_id albo auth.users.id
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- I-8: duplikat aktywnego pending niemożliwy ATOMOWO (zastępuje racy read-check)
CREATE UNIQUE INDEX orders_one_pending_per_service
  ON public.orders (guest_token_id, service_id) WHERE status = 'pending';

-- Jedyny strażnik przejścia: guarded UPDATE + INSERT śladu w jednej transakcji.
-- p_guest_scope: gdy aktor=guest, wymusza własność (I-3/I-9) w tym samym WHERE.
CREATE OR REPLACE FUNCTION public.transition_order(
  p_order_id uuid, p_to text, p_actor_kind text, p_actor_id uuid, p_guest_scope uuid DEFAULT NULL
) RETURNS public.orders LANGUAGE plpgsql AS $$
DECLARE v_from text; v_row public.orders;
BEGIN
  SELECT status INTO v_from FROM public.orders
    WHERE id = p_order_id
      AND (p_guest_scope IS NULL OR guest_token_id = p_guest_scope)  -- I-9
    FOR UPDATE;                                                       -- blokada → brak TOCTOU
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;        -- → 404
  IF v_from <> 'pending' THEN RAISE EXCEPTION 'ORDER_NOT_PENDING'; END IF; -- I-2/I-4 → 409

  UPDATE public.orders SET status = p_to WHERE id = p_order_id RETURNING * INTO v_row;
  INSERT INTO public.order_status_events(order_id, from_status, to_status, actor_kind, actor_id)
    VALUES (p_order_id, v_from, p_to, p_actor_kind, p_actor_id);       -- I-5 + I-6
  RETURN v_row;
END $$;
```

> Wariant minimalny (jeśli log to za dużo na MVP): kolumny `orders.updated_by uuid` + `updated_by_kind text`
> ustawiane w tej samej funkcji. Rekomendacja: **append-only log** — realizuje I-5 *i* I-6, i jest nieusuwalny.

### 4.3 Repozytorium — `src/lib/repositories/order-repository.ts`

Jedno miejsce ładowania/zapisu agregatu; **kontrakt ładowania wchłania izolację (I-9)**.

```ts
export interface OrderRepository {
  findForGuest(orderId: string, guestTokenId: string): Promise<Order | null>; // scoped (I-9)
  listForGuest(guestTokenId: string): Promise<OrderView[]>;
  findForStaff(orderId: string): Promise<Order | null>;
  listAllForStaff(): Promise<StaffOrderView[]>;     // I-5: ZWRACA wszystkie statusy (z filtrem opcjonalnym)
  transition(orderId: string, t: OrderTransition, guestScope?: string): Promise<void>; // → fn transition_order
  placeAddon(guestTokenId: string, serviceId: string): Promise<string>; // I-7 + I-8 (insert łapie unikalny indeks)
}
```

`transition()` wywołuje `rpc("transition_order", …)` i **mapuje** `ORDER_NOT_FOUND`/`ORDER_NOT_PENDING`
oraz naruszenie `orders_one_pending_per_service` na nazwane błędy domenowe — żaden błąd nie jest połykany.

### 4.4 Cienkie trasy API + strażnik roli

```ts
// src/lib/auth/staff-guard.ts  — JEDNO źródło prawdy o roli (I-10)
export function isStaff(user): boolean { return user?.app_metadata?.role === "staff"; }
export function requireStaff(ctx): Response | null { /* 401 / 403 */ }

// src/lib/api/order-error.ts — mapowanie błędu domenowego na HTTP
export function orderErrorToResponse(e: unknown): Response { /* OrderNotPending→409, *NotOwned→404, Forbidden→403, *NotOrderable→403, DuplicatePending→409 */ }
```

```ts
// api/staff/orders/[id].ts (po refaktorze, szkic):
const guard = requireStaff(context); if (guard) return guard;          // I-10 na krawędzi
const { status } = bodySchema.parse(...);                              // parse wejścia
try {
  const order = await repo.findForStaff(id); if (!order) return notFound();
  const t = status === "fulfilled" ? order.fulfillByStaff(staffActor) : order.cancelByStaff(staffActor);
  await repo.transition(order.id, t);                                  // atomowo: przejście + ślad
  return Response.json({ id: order.id, status: order.status });
} catch (e) { return orderErrorToResponse(e); }                        // fail-fast, brak połykania
```

Egzekucja przenosi się **z rozproszonych tras na agregat + funkcję DB**; trasy stają się: parse → metoda → mapowanie.

---

## KROK 5 — Before/after, plan, testy

### 5.1 Before / after (każde dzisiejsze miejsce reguły)

| Miejsce dziś | Before | After |
|---|---|---|
| `guest/orders/[id].ts:26-45` | read + `status!==pending` + guarded UPDATE, błąd połknięty | `repo.findForGuest()` → `order.cancelByGuest(actor)` → `repo.transition(scope)`; błędy mapowane |
| `staff/orders/[id].ts:42-55` | zduplikowany guarded UPDATE + PGRST116 | `requireStaff` → `order.fulfill/cancelByStaff` → `repo.transition` |
| `staff/orders/index.ts:7-9,20` | brak roli; `.eq(pending)` ukrywa resztę | `requireStaff`; `repo.listAllForStaff()` zwraca też terminalne (I-5) |
| `dashboard.astro:10-14` | brak roli; tylko pending | `requireStaff`; widok z historią |
| `OrderList.tsx:78` | usuwa kartę po realizacji | przenosi do sekcji „zrealizowane/anulowane" (ślad widoczny) |
| `guest/orders/index.ts:64,76-92` | błędy połknięte; racy duplikat | `repo.placeAddon()`; I-8 przez unikalny indeks; błędy mapowane |
| `orders` schema | brak wykonawcy | `order_status_events` (I-5+I-6) + indeks I-8 |
| RLS `orders` `USING(true)` | dowolny zalogowany R/W wszystkich | zawężenie do `is_staff(auth.uid())` (lub: dostęp wyłącznie przez `transition_order`) |

### 5.2 Plan faz (test-first tam, gdzie się da — runner Vitest istnieje)

- **Faza 1 — Domena (test-first).** `src/lib/domain/order.ts` + testy jednostkowe agregatu (czyste, bez DB).
  Wszystkie przejścia legalne/nielegalne (lista 5.3). Najszybsza pętla RED→GREEN.
- **Faza 2 — Migracja DB (test-first integracyjnie).** `order_status_events`, indeks `orders_one_pending_per_service`,
  funkcja `transition_order`. Testy integracyjne rozszerzają istniejący `orders.integration.test.ts`
  (atomowość, ślad, idempotencja, wyścig duplikatu).
- **Faza 3 — Repozytorium + mapowanie błędów.** `order-repository.ts`, `order-error.ts`.
- **Faza 4 — Cienkie trasy + `staff-guard`.** Przepięcie 4 tras; usunięcie zduplikowanej logiki przejść.
  Dodanie testów roli (non-staff → 403).
- **Faza 5 — Ślad w UI.** `OrderList`/`dashboard` pokazują stany terminalne; zawężenie RLS `orders`.
- **Faza 6 — Sprzątanie.** Usunięcie ręcznych `.eq("status","pending")` z tras (reguła już w funkcji DB).

### 5.3 Przypadki testowe niezmiennika #1

**Legalne (muszą przejść + zostawić ślad):**
- place addon, brak istniejącego pending → `pending`.
- gość anuluje własne `pending` → `cancelled` + event(actor_kind=guest).
- staff realizuje `pending` → `fulfilled` + event(actor_kind=staff, actor_id).
- staff anuluje `pending` → `cancelled` + event(actor_kind=staff).
- po realizacji: order **i** event nadal odczytywalne przez `listAllForStaff()` (I-5).

**Nielegalne (muszą rzucić nazwany błąd → właściwy HTTP, fail-fast):**
- gość anuluje `fulfilled`/`cancelled` → `OrderNotPending` (409).
- staff realizuje już `fulfilled` → `OrderNotPending` (409).
- gość anuluje cudze zamówienie → `OrderNotOwnedByGuest` (404).
- place usługi `included`/spoza pakietu → `ServiceNotOrderable` (403).
- równoległe place tej samej usługi → drugie `DuplicatePendingOrder` (409).
- non-staff (np. konto z self-signup) realizuje → 403 (`requireStaff`).
- `fulfilled→pending` — brak metody w agregacie **i** `transition_order` odrzuca (podwójna bariera I-2).

### 5.4 Nowe nazwy „load-bearing" do rejestru kontraktów

- Agregat/typy: `Order`, `OrderStatus`, `ActorKind`, `Actor`, `OrderTransition`.
- Błędy domenowe: `OrderNotPending`, `OrderNotOwnedByGuest`, `ForbiddenActor`, `ServiceNotOrderable`, `DuplicatePendingOrder`.
- Repozytorium: `OrderRepository` (`findForGuest`, `listForGuest`, `findForStaff`, `listAllForStaff`, `transition`, `placeAddon`).
- DB: tabela `public.order_status_events`; funkcja `public.transition_order`; indeks `orders_one_pending_per_service`.
- Autoryzacja: `isStaff(user)` / `requireStaff(ctx)` — centralizuje klucz `app_metadata.role`
  (uwaga: `generate-token.ts:26` czyta dziś `staff_role`, a backfill ustawia `role` —
  `20260529000001_staff_role_defaults.sql:7-9`; ujednolicić w jednym helperze).
- Mapowanie: `orderErrorToResponse`.

---

## Podsumowanie

Niezmiennikiem #1 jest **integralność cyklu życia zamówienia `Order`** — odkryta jako jeden spójny niezmiennik
(jednokierunkowe `pending→{fulfilled|cancelled}`, właściwy aktor, trwały ślad z wykonawcą), a nie luźny zbiór
reguł. Wybrano go, bo jest jednocześnie najbardziej rdzeniowy (połowa „dwóch mechanizmów rdzenia", `prd.md:134-136`,
spina guardrail `prd.md:47`) i — jako całość — najsłabiej egzekwowany: przejścia są zduplikowane ręcznie w dwóch
trasach, ślad jest **aktywnie łamany** (panel ukrywa zrealizowane: `staff/orders/index.ts:20`, `dashboard.astro:14`,
`OrderList.tsx:78`), audyt „kto" jest **nieobecny w schemacie** (`schema.sql:54-62`), a błędy DB bywają **połykane**,
łamiąc fail-fast. Dodatkowo granica roli nie istnieje na trasach zamówień (`staff/orders/*` sprawdza tylko
zalogowanie; RLS `USING(true)` w `rls.sql:27-31`), a duplikat `pending` jest możliwy przez wyścig. Projekt
wprowadza **agregat-strażnik `Order`** z metodami-przejściami i preconditions rzucającymi nazwane błędy, repozytorium,
którego kontrakt ładowania wchłania izolację gościa (I-9), oraz **atomową funkcję Postgres `transition_order`**, która
w jednej transakcji wykonuje strzeżone przejście i zapis niezmiennego dziennika `order_status_events` (I-5+I-6) — z
unikalnym indeksem częściowym domykającym I-8. Egzekucja przenosi się z rozproszonych tras/klienta do jednego miejsca,
a istniejący runner Vitest pozwala poprowadzić fazy 1–2 test-first.
