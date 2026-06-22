---
title: Anti-Corruption Layer — przeciek `jose` (JWT sesji gościa) → port + adapter
created: 2026-06-22
type: refactor-plan
---

# Anti-Corruption Layer: izolacja zależności `jose`

> Produktem tego dokumentu jest **PLAN refaktoru**, nie kod. Przeciekająca zależność została
> **odkryta i wybrana** (KROK 0–2), nie założona z góry. Wszystkie cytaty `plik:linia`
> zweryfikowano odczytem źródeł 2026-06-22. Uzupełnia [`01-domain-distillation.md`](./01-domain-distillation.md)
> (mapa domeny + 9 rozjazdów) i [`02-invariant-aggregate-refactor.md`](./02-invariant-aggregate-refactor.md)
> (agregat `Order`). Tam: niezmienniki domeny. Tu: zależność biblioteki przeciekająca przez granice warstw.

---

## KROK 0 — Odkryty kontekst

- **Stack:** Astro 6 SSR + React 19 islands + Supabase (Postgres) + Cloudflare Workers (`CLAUDE.md`, `tech-stack.md:24`).
- **Zależności zewnętrzne (manifest `package.json:20-46`), kandydaci na przeciek:**
  `jose` (JWT), `openai` (AI SDK), `@supabase/supabase-js` + `@supabase/ssr` (backend),
  `zod` (walidacja), `react-qr-code` (render QR).
- **Brak wydzielonej warstwy domenowej / ACL** — biblioteki są wołane bezpośrednio z tras API,
  stron `.astro`, middleware i helperów `src/lib/` (potwierdza doc 01 KROK 0: logika rozsmarowana po warstwach).
- **Deklaracje wymienialności w dokumentach (sygnał intencja-vs-kod):**
  - Supabase wybrany **celowo jako load-bearing** („auth is required… Supabase ships auth out of the box",
    `tech-stack.md:24`) — czyli **nie** ma być wymieniany; to świadoma zależność rdzeniowa.
  - AI concierge: doc 01 odnotował rozjazd #1 (dok mówił Anthropic, kod używa OpenAI), ale dziś jest on
    **domknięty** — `tech-stack.md:24` i `roadmap.md:143` jawnie mówią „OpenAI SDK (`gpt-4o-mini`)".
    Intencja i kod się **zgadzają** → sygnał wymienialności tu **wygasł** (patrz KROK 2, dlaczego to nie #1).
  - **Guest auth nie jest oddany Supabase** — choć Supabase „daje auth z pudełka", dostęp gościa zbudowano
    **ręcznie na `jose`** (HS256, własny sekret). To rozjazd: rdzeniowy mechanizm (`GuestToken`) ma własną,
    nieabstrakcyjną implementację kryptografii rozsianą po warstwach.

---

## KROK 1 — Identyfikacja przeciekających zależności

Dla każdej zależności: wszystkie pliki produkcyjne, które ją dziś „znają" (`plik:linia`).

### A. `jose` — kodowanie/weryfikacja JWT sesji gościa  ⚠️ przeciek przez 4 warstwy
| Warstwa | Plik:linia | Co robi z `jose` |
|---|---|---|
| Serwis (`src/lib/`) | `qr-auth.ts:1`, `:24`, `:63-71` | `jwtVerify` pending + `SignJWT` sesji (issue) |
| Middleware | `middleware.ts:3`, `:29-37` | `jwtVerify` sesji (consume) + ręczna rekonstrukcja claimów |
| Strona SSR | `verify.astro:5`, `:38-44` | `SignJWT` tokenu `pending_guest` (issue) |
| Strona SSR | `qr/room/[qr_token].astro:3`, `:28`, `:37-51` | enkoduje sekret, ustawia cookie z `sessionJwt` |
| Deklaracja typu | `env.d.ts:1-7` | `GuestTokenLocals` — **ręcznie przepisany** kształt claimów JWT |

**Sygnały przecieku (wszystkie obecne):**
- **Ten sam pakiet w wielu warstwach:** middleware + serwis + 2 strony SSR (sign po jednej stronie granicy,
  verify po drugiej — klasyczny przeciek krawędzi klient/serwer w obrębie SSR).
- **Zduplikowana rekonstrukcja prymitywów biblioteki:**
  - `new TextEncoder().encode(GUEST_SESSION_SECRET)` ×3 — `middleware.ts:29`, `verify.astro:38`, `[qr_token].astro:28`.
  - Algorytm `HS256` ×4 — `qr-auth.ts:24` (`algorithms:["HS256"]`), `qr-auth.ts:69` (`alg:"HS256"`),
    `middleware.ts:30`, `verify.astro:40`.
- **Kształt biblioteki w kontraktach:** payload sesji konstruowany w `qr-auth.ts:63-68`, a potem **przepisywany
  ręcznie pole-po-polu** z rzutami `as string` w `middleware.ts:31-37`, i **trzeci raz** zadeklarowany jako
  interfejs TS w `env.d.ts:1-7`. Trzy miejsca znają kształt claimów — żadne nie jest źródłem prawdy.
- **Rozsiane nazwy/opcje cookies** (`guest_session`, `pending_guest`, `path`, `maxAge`):
  `verify.astro:44-50`, `[qr_token].astro:37-51`, `middleware.ts:26` — część tego samego kontraktu wire.

### B. `openai` — AI concierge  (zamknięty w 1 pliku)
| Warstwa | Plik:linia |
|---|---|
| Trasa API | `concierge.ts:4`, `:46`, `:49-50` (`import OpenAI`, `new OpenAI`, `chat.completions`, `model:"gpt-4o-mini"`) |

Jedna warstwa, jeden plik. **Brak** importu w innych warstwach, **brak** duplikacji rekonstrukcji,
**brak** typu OpenAI w sygnaturach domenowych. Nie przecieka przez granice.

### C. `@supabase/supabase-js` / `@supabase/ssr` — backend (świadomie load-bearing)
| Warstwa | Plik:linia |
|---|---|
| Fabryka klienta (już quasi-ACL) | `supabase.ts:1`, `:6-19`, `:21-40` |
| **Typ biblioteki w sygnaturze serwisu** | `qr-auth.ts:2`, `:13` (`supabase: SupabaseClient<Database>`) |
| Typ biblioteki w deklaracji locals | `env.d.ts:11` (`User`) |
| Surowe zapytania `.from().select()` | 13 plików, 30 wystąpień (grep: trasy API, strony SSR, `qr-auth.ts`) |

Przeciek realny (typ `SupabaseClient` w sygnaturze, zapytania rozsiane wszędzie), **ale**: backend wybrany
celowo jako niewymienialny (`tech-stack.md:24`), a persystencję `Order` adresuje już doc 02
(repozytorium + `transition_order`). Pełny ACL na Supabase = ogromny, niskowartościowy dla 3-tyg. MVP.

### D. `zod` (`concierge.ts:2`, `generate-token.ts:2`, `orders/[id].ts:2`, `orders/index.ts:2`) i `react-qr-code` (`RoomQrGrid.tsx:1`, `TokenGeneratorForm.tsx:2`)
`zod` — walidacja na krawędzi API (konwencjonalnie poprawne, `CLAUDE.md`: „validate with zod"); nie przecieka
do domeny. `react-qr-code` — dwa komponenty UI w tej samej warstwie. Oba pomijamy.

---

## KROK 2 — Klasyfikacja i wybór #1

| Zależność | (a) Warstwy/pliki dotknięte | (b) Ryzyko/koszt wymiany dziś | (c) Dok. deklaruje wymienialność? | Wynik |
|---|---|---|---|---|
| **`jose`** | **Najwyższe** — 4 warstwy, 5 plików prod. + typ + 2 testy; potrójna duplikacja | **Wysokie** — rotacja algorytmu / claimów / przejście na sesje Supabase dotyka 5 plików; krypto rdzenia rozsiane | Pośrednio: dok mówi „Supabase daje auth", a guest-auth zbudowano ręcznie na `jose` → **rozjazd** | **#1** |
| `openai` | Najniższe — 1 plik, 1 warstwa | Niskie — wymiana = 1 plik | **Wygasł** — `tech-stack.md:24`/`roadmap.md:143` zgadzają się z kodem (OpenAI) | #2 |
| `@supabase/*` | Wysokie (30 zapytań) ale typ w 1 sygnaturze | Bardzo wysokie, ale **świadomie** niechciane | Dok mówi **NIE wymieniać** (load-bearing) | pomijamy (doc 02 adresuje persystencję) |
| `zod` / `react-qr-code` | Krawędź / UI | Trywialne | — | pomijamy |

### Wybór #1 (uzasadnienie)

**Najgorszy przeciek = `jose` (kodek JWT sesji gościa).** To **jedyna** zależność spełniająca *wszystkie* sygnały
z KROK 1 naraz: ten sam pakiet w wielu warstwach, zduplikowana rekonstrukcja prymitywów (sekret ×3, algorytm ×4),
kształt biblioteki przepisany w trzech miejscach (`qr-auth.ts:63-68` → `middleware.ts:31-37` → `env.d.ts:1-7`),
oraz wołanie SDK po **obu** stronach granicy (sign w stronach/serwisie, verify w middleware/serwisie). Co więcej,
strzeże **rdzenia produktu** — `GuestToken` / „dwuetapowy dostęp QR" to połowa rdzenia (doc 01 KROK 2,
`prd.md:134`). Dziś nie istnieje *żadna* abstrakcja: każda warstwa zna sekret, algorytm i kształt claimów.

**Dlaczego nie `openai` (mimo że doc 01 wskazywał na niego rozjazdem #1):** rozjazd intencja-vs-kod **wygasł** —
dokumenty zaktualizowano do OpenAI (`tech-stack.md:24`, `roadmap.md:143`), więc nie ma już zadeklarowanej
wymienialności do egzekwowania. Przede wszystkim jednak `openai` **nie przecieka przez granice** — jest zamknięty
w jednym pliku jednej warstwy (`concierge.ts`), w subdomenie *wspierającej* (doc 01 KROK 2). ACL tu jest tani i
wart krótkiej notki na przyszłość (dostawcy LLM się zmieniają), ale to **nie** najgorszy przeciek — patrz Aneks.

**Dlaczego nie Supabase:** to świadomie niewymienialny backend (`tech-stack.md:24`); ACL na całość = ogromny koszt
przy niskiej wartości. Jedyny ostry przeciek typu (`SupabaseClient` w `qr-auth.ts:13`) zniknie *przy okazji* tego
refaktoru — patrz KROK 5.4 (relacja z doc 02).

---

## KROK 3 — Diagnoza przecieku `jose`

### 3.1 Duplikacja — cytaty `plik:linia`

**Sekret enkodowany niezależnie w 3 miejscach (każde zna `TextEncoder` + `GUEST_SESSION_SECRET`):**
```
middleware.ts:29        const secret = new TextEncoder().encode(GUEST_SESSION_SECRET);
verify.astro:38         const secret = new TextEncoder().encode(GUEST_SESSION_SECRET);
[qr_token].astro:28     secret: new TextEncoder().encode(GUEST_SESSION_SECRET),
```

**Algorytm HS256 zaszyty w 4 miejscach (zmiana = 4 edycje, ryzyko rozjazdu sign≠verify):**
```
qr-auth.ts:24           await jwtVerify(pendingCookieValue, secret, { algorithms: ["HS256"] });
qr-auth.ts:69           .setProtectedHeader({ alg: "HS256" })
middleware.ts:30        await jwtVerify(guestCookie, secret, { algorithms: ["HS256"] });
verify.astro:40         .setProtectedHeader({ alg: "HS256" })
```

**Kształt claimów sesji znany w 3 miejscach — brak źródła prawdy:**
```
qr-auth.ts:63-68        new SignJWT({ tokenId, roomNumber, packageId, checkOutDate })   // produkcja
middleware.ts:31-37     tokenId: payload.tokenId as string, roomNumber: ... as string  // ręczna rekonstrukcja + rzuty
env.d.ts:1-7            interface GuestTokenLocals { tokenId; roomNumber; packageId; checkOutDate; exp }  // trzecia kopia
```

**Kształt `pending_guest` znany po obu stronach granicy:**
```
verify.astro:39         new SignJWT({ tokenId: row.id, type: "pending_guest" })          // sign
qr-auth.ts:22-30        pendingPayload.type !== "pending_guest" → invalid               // verify
```

### 3.2 Przeciek przez granice — najgroźniejsze

- **Sign vs verify po dwóch stronach krawędzi SSR:** token emitują strony/serwis (`verify.astro:39`,
  `qr-auth.ts:63`), a konsumuje middleware (`middleware.ts:30`). Kontrakt wire (claimy + algorytm) nie jest nigdzie
  zadeklarowany jako jeden typ — żyje w zgodności ręcznych literałów. Jedna pomyłka (np. dodanie claimu w sign bez
  aktualizacji `middleware.ts:31-37` lub `env.d.ts`) cicho gubi pole.
- **Krypto rdzenia bez strażnika:** `GuestToken` to rdzeń bezpieczeństwa (`prd.md:46`, doc 01 KROK 3.A). Dziś
  rotacja algorytmu, zmiana TTL czy migracja na natywne sesje Supabase wymaga zsynchronizowanej edycji 5 plików
  w 4 warstwach — duża powierzchnia błędu w najwrażliwszym miejscu.
- **Rzuty `as string` zamiast walidacji:** `middleware.ts:31-37` ufa kształtowi payloadu bez sprawdzenia —
  biblioteka zwraca `JWTPayload` (luźny rekord), a kod udaje, że to `GuestTokenLocals`. Brak jednego miejsca,
  które by ten kontrakt egzekwowało.

### 3.3 Rozjazd deklaracja-vs-kod

`tech-stack.md:24` deklaruje Supabase jako warstwę auth („Supabase ships auth out of the box"), a mimo to **dostęp
gościa** zbudowano poza nią — ręcznie na `jose`. To nie znaczy, że trzeba przejść na Supabase; znaczy, że skoro
guest-auth jest świadomie odseparowanym, własnym mechanizmem, **tym bardziej** zasługuje na jeden punkt wiedzy o
swoim kształcie (ACL), zamiast rozsianej kryptografii.

---

## KROK 4 — Projekt ACL

Zasada: **`jose` zna wyłącznie adapter.** Reszta kodu zna domenowy value object (zweryfikowane claimy) i wąski port.

### 4.1 Domenowe value objecty (czysty TS, bez `jose`) — `src/lib/domain/guest-session.ts`

Jedyne miejsce, które definiuje *kształt* claimów (zastępuje `qr-auth` inline + `middleware` rekonstrukcję + `env.d.ts`).

```ts
// Claimy sesji — JEDNO źródło prawdy o kształcie (dziś rozbite na 3 pliki)
export interface GuestSessionClaims {
  tokenId: string;
  roomNumber: string;
  packageId: string;
  checkOutDate: string; // YYYY-MM-DD
}

// Zweryfikowana sesja jako VO: gotowe dane domenowe + operacja domenowa.
// UI/middleware dostają TO, nigdy surowy JWTPayload biblioteki.
export class GuestSession {
  constructor(
    readonly claims: GuestSessionClaims,
    readonly expiresAt: Date, // z claimu `exp`, zmapowanego w adapterze
  ) {}
  isActive(now: Date): boolean { return now < this.expiresAt; } // domykasz I-tokenu w jednym miejscu
}

// Pending = intencja przejścia do skanu #2; `type` to szczegół kodeka, nie domeny.
export interface PendingGuest { tokenId: string; }
```

### 4.2 Wąski port (interfejs domenowy) — `src/lib/auth/guest-session-codec.ts`

Reszta kodu zna **tylko ten interfejs**. Zero typów `jose`, zero `HS256`, zero `TextEncoder`, zero rzutów.

```ts
import type { GuestSession, GuestSessionClaims, PendingGuest } from "@/lib/domain/guest-session";

export interface GuestSessionCodec {
  /** issue sesji po skanie #2 (dziś: qr-auth.ts:63-71) */
  issueSession(claims: GuestSessionClaims, expiresAt: Date): Promise<string>;
  /** consume sesji (dziś: middleware.ts:30-37) → VO albo null, nigdy rzut */
  verifySession(token: string): Promise<GuestSession | null>;
  /** issue pending po skanie #1 (dziś: verify.astro:39-42) */
  issuePending(tokenId: string): Promise<string>;
  /** consume pending (dziś: qr-auth.ts:24-31) */
  verifyPending(token: string): Promise<PendingGuest | null>;
}
```

### 4.3 Adapter — JEDYNY plik importujący `jose` — `src/lib/auth/jose-guest-session-codec.ts`

```ts
import { SignJWT, jwtVerify } from "jose"; // ← jedyny import jose w całym repo (po refaktorze)
import type { GuestSessionCodec } from "./guest-session-codec";
import { GuestSession, type GuestSessionClaims, type PendingGuest } from "@/lib/domain/guest-session";

const ALG = "HS256";              // ← dziś rozsiane ×4 (3.1) — tu raz
const PENDING_TTL = "10m";        // ← dziś literał w verify.astro:41

export function createGuestSessionCodec(rawSecret: string): GuestSessionCodec {
  const secret = new TextEncoder().encode(rawSecret); // ← dziś ×3 (3.1) — tu raz

  return {
    async issueSession(claims, expiresAt) {
      return new SignJWT({ ...claims })
        .setProtectedHeader({ alg: ALG })
        .setExpirationTime(expiresAt)
        .sign(secret);
    },
    async verifySession(token) {
      try {
        const { payload } = await jwtVerify(token, secret, { algorithms: [ALG] });
        const claims: GuestSessionClaims = {        // mapowanie payload→claimy w JEDNYM miejscu
          tokenId: String(payload.tokenId),
          roomNumber: String(payload.roomNumber),
          packageId: String(payload.packageId),
          checkOutDate: String(payload.checkOutDate),
        };
        return new GuestSession(claims, new Date((payload.exp ?? 0) * 1000));
      } catch { return null; }                      // expiry/podpis: jose rzuca → null (fail-safe na krawędzi auth)
    },
    async issuePending(tokenId) {
      return new SignJWT({ tokenId, type: "pending_guest" }) // `type` — detal kodeka, ukryty przed domeną
        .setProtectedHeader({ alg: ALG })
        .setExpirationTime(PENDING_TTL)
        .sign(secret);
    },
    async verifyPending(token): Promise<PendingGuest | null> {
      try {
        const { payload } = await jwtVerify(token, secret, { algorithms: [ALG] });
        if (payload.type !== "pending_guest") return null;
        return { tokenId: String(payload.tokenId) };
      } catch { return null; }
    },
  };
}
```

### 4.4 Cookies — domknięcie kontraktu wire — `src/lib/auth/guest-cookies.ts`

Nazwy + opcje cookies (dziś rozsiane: `verify.astro:44-50`, `[qr_token].astro:37-51`, `middleware.ts:26`) jako stałe.

```ts
export const PENDING_COOKIE = "pending_guest";
export const SESSION_COOKIE = "guest_session";
export const pendingCookieOptions = { httpOnly: true, secure: true, sameSite: "lax", path: "/qr", maxAge: 600 } as const;
export function sessionCookieOptions(expires: Date) {
  return { httpOnly: true, secure: true, sameSite: "lax", path: "/", expires } as const;
}
```

**Rozstrzygnięcia z kontraktu `jose` (zakodowane w ACL, nie w trasach):**
- `jwtVerify` **sam** sprawdza `exp` i rzuca po wygaśnięciu → osobne trzymanie `exp` w locals (`middleware.ts:36`)
  jest zbędne; `GuestSession.expiresAt` pochodzi z `payload.exp`. Decyzja żyje w adapterze 4.3, nie w middleware.
- `setExpirationTime` przyjmuje `Date` lub string → sesja używa `Date` (z `check_out_date`), pending stałej
  `PENDING_TTL`. Obie konwencje w adapterze, nie w stronach.

---

## KROK 5 — Dowód izolacji + before/after

### 5.1 Dowód izolacji (kryterium sukcesu)

**Po refaktorze `grep -r "from \"jose\"" src/` zwraca wyłącznie `src/lib/auth/jose-guest-session-codec.ts`**
(+ pliki testów). Wymiana biblioteki dotyka **tylko adaptera**:

| Scenariusz wymiany | Co się zmienia | Czego NIE dotyka |
|---|---|---|
| Rotacja HS256 → RS256 / EdDSA | `ALG` + typ klucza w adapterze 4.3 | tabele, trasy, strony, middleware, UI |
| Migracja na natywne sesje Supabase | nowa implementacja portu `GuestSessionCodec` | port, VO, wszyscy konsumenci portu |
| Wymiana `jose` → `@tsndr/cloudflare-worker-jwt` | tylko adapter | reszta kodu (zna port) |
| Dodanie/zmiana claimu | `GuestSessionClaims` + mapowanie w adapterze | brak ręcznych rzutów do poprawienia (znikły) |

**Dziś znają `jose`:** `qr-auth.ts`, `middleware.ts`, `verify.astro`, `[qr_token].astro` (+ kształt w `env.d.ts`).
**Po refaktorze znają `jose`:** tylko `jose-guest-session-codec.ts`.

### 5.2 Before / after (każde dzisiejsze miejsce wiedzy o `jose`)

| Miejsce dziś | Before | After |
|---|---|---|
| `qr-auth.ts:1,24,63-71` | importuje `jose`; sign/verify inline; sekret w sygnaturze | wstrzyknięty `codec: GuestSessionCodec`; woła `codec.verifyPending` / `codec.issueSession`; **bez** `jose` |
| `middleware.ts:3,29-37` | `TextEncoder`+`jwtVerify`+ rzuty `as string` | `codec.verifySession(cookie)` → `GuestSession \| null`; `locals.guestToken` z VO |
| `verify.astro:5,38-44` | `TextEncoder`+`SignJWT` pending | `codec.issuePending(row.id)` + stałe cookies z 4.4 |
| `[qr_token].astro:3,28,37-51` | enkoduje sekret, literały cookies | przekazuje `codec`; cookies z `guest-cookies.ts` |
| `env.d.ts:1-7` | ręcznie przepisany `GuestTokenLocals` | `guestToken: GuestSession \| null` — typ z domeny, koniec trzeciej kopii |

UI/middleware dostają **gotowy `GuestSession`** (dane domenowe + `isActive`), nie surowy `JWTPayload` biblioteki.

### 5.3 Relacja z doc 02 (Supabase znika z `qr-auth.ts` przy okazji)

`qr-auth.ts` miesza dziś **dwie** zależności: `jose` (kodek) **i** `SupabaseClient` (persystencja, `:2`,`:13`,`:34-52`).
- Ten ACL wyciąga z niego `jose` → port `GuestSessionCodec`.
- Doc 02 (repozytorium `GuestToken`/`Order`) wyciąga odczyty `room_qr_codes`/`guest_tokens` → repozytorium.
- Po **obu** refaktorach `qr-auth.ts` staje się cienką orkiestracją: `repo.findRoom/findToken` → reguła obecności
  → `codec.issueSession`. Typ `SupabaseClient` znika z jego sygnatury (rozwiązuje ostry przeciek C z KROK 1).

### 5.4 Plan faz (konwencja projektu: `context/changes/<id>/`; test-first — Vitest istnieje)

Infrastruktura testów pokrywa już tę powierzchnię: `__tests__/qr-auth.test.ts`, `__tests__/middleware.test.ts`
(wzorzec `TEST_SECRET`) — fazy 1–2 idą **test-first** (RED→GREEN).

- **Faza 1 — VO + port + adapter (test-first).** `domain/guest-session.ts`, `auth/guest-session-codec.ts`,
  `auth/jose-guest-session-codec.ts`. Testy: round-trip issue→verify, zły podpis→null, wygasły→null,
  pending bez `type`→null, `isActive`. Przeniesienie istniejącego `TEST_SECRET` na fabrykę kodeka.
- **Faza 2 — `qr-auth.ts` na port.** Wstrzyknięcie `codec`; usunięcie importu `jose`; testy `qr-auth.test.ts`
  przepięte na kodek (lub jego stub). `jose` znika z serwisu.
- **Faza 3 — middleware na port.** `codec.verifySession`; usunięcie `TextEncoder` + rzutów; `locals.guestToken`
  z `GuestSession`. Aktualizacja `middleware.test.ts`.
- **Faza 4 — strony SSR + cookies.** `verify.astro` (`issuePending`), `[qr_token].astro` (przekazanie kodeka),
  centralizacja cookies w `guest-cookies.ts`.
- **Faza 5 — typy + sprzątanie.** `env.d.ts`: `guestToken: GuestSession | null`; usunięcie `GuestTokenLocals`.
  **Weryfikacja:** `grep "from \"jose\"" src/` → tylko adapter (+ testy).

### 5.5 Nowe nazwy „load-bearing" do rejestru kontraktów
- Domena: `GuestSession`, `GuestSessionClaims`, `PendingGuest`.
- Port/adapter: `GuestSessionCodec`, `createGuestSessionCodec`.
- Cookies: `SESSION_COOKIE`, `PENDING_COOKIE`, `sessionCookieOptions`, `pendingCookieOptions`.
- Stałe kodeka (ukryte w adapterze): `ALG="HS256"`, `PENDING_TTL`.

---

## Aneks — `openai` jako #2 (tani ACL na przyszłość, nie najgorszy przeciek)

Choć contained do `concierge.ts`, dostawcy LLM się zmieniają, a concierge to subdomena *wspierająca*. Lekki port
wystarczy, gdyby kiedyś wracać do Anthropic (doc 01 #1): interfejs `ConciergeClient { reply(system, messages): Promise<string> }`
+ adapter `openai`. Nie wymaga DB ani zmian kontraktu wire — dlatego rankuje **niżej** niż `jose` mimo historii rozjazdu.

---

## Podsumowanie

Spośród zależności zewnętrznych RoomPilot najgorszym przeciekiem jest **`jose`** — kodek JWT sesji gościa — bo jako
jedyna spełnia wszystkie sygnały przecieku naraz: ten sam pakiet importowany w czterech warstwach (serwis
`qr-auth.ts`, `middleware.ts`, dwie strony SSR), potrójnie zduplikowana rekonstrukcja prymitywów (sekret ×3 przez
`TextEncoder`, algorytm `HS256` ×4) oraz kształt claimów przepisany w trzech miejscach
(`qr-auth.ts:63-68` → `middleware.ts:31-37` z rzutami `as string` → `env.d.ts:1-7`), przy wołaniu SDK po obu stronach
granicy sign/verify. Dotyczy to rdzenia produktu (`GuestToken`, „dwuetapowy dostęp QR"), a mimo to nie istnieje żadna
abstrakcja. `openai` odrzucono jako #1, bo jego rozjazd intencja-vs-kod z doc 01 jest już domknięty
(`tech-stack.md:24` i `roadmap.md:143` mówią OpenAI), a sama zależność jest zamknięta w jednym pliku i nie przecieka
przez granice; Supabase to świadomie niewymienialny backend. Projekt ACL wprowadza domenowy value object `GuestSession`
(jedyne źródło kształtu claimów), wąski port `GuestSessionCodec` i adapter `jose-guest-session-codec.ts` będący jedynym
plikiem znającym `jose`; sekret, algorytm i mapowanie payloadu schodzą do adaptera, a konsumenci dostają gotowy obiekt
domenowy zamiast surowego `JWTPayload`. Dowód izolacji: po refaktorze `grep "from \"jose\""` zwraca wyłącznie adapter,
więc wymiana biblioteki (rotacja algorytmu, natywne sesje Supabase, inny pakiet JWT) dotyka tylko jego — nie tabel, tras,
stron ani UI. Plan pięciu faz jest test-first (Vitest + istniejące `qr-auth.test.ts`/`middleware.test.ts`), a refaktor
domyka się z doc 02: po obu `qr-auth.ts` traci zarówno `jose`, jak i typ `SupabaseClient` ze swojej sygnatury.
