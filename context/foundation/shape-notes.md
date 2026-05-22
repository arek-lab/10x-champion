---
project: HotelGuest
context_type: greenfield
created: 2026-05-22
updated: 2026-05-22
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6]
  quality_check_status: accepted
  gray_areas_resolved:
    - topic: "pain category"
      decision: "oba jednocześnie — brakuje informacji (pakiet, usługi) i brakuje ścieżki działania (samoobsługa)"
    - topic: "primary persona"
      decision: "gość hotelowy; panel recepcji to narzędzie operacyjne (secondary)"
    - topic: "insight"
      decision: "hotele nie widzą ROI w digitalizacji gościa — PMS-y są staff-facing, warstwa guest-facing nie istnieje lub jest modułem dużego dostawcy"
    - topic: "token expiry"
      decision: "token QR wygasa z końcem pobytu (check-out date z formularza recepcji)"
    - topic: "staff accounts"
      decision: "wiele kont staff; każdy pracownik ma swój e-mail + hasło — audyt działań możliwy"
  frs_drafted: 15
  quality_check_status: pending
---

## Vision & Problem Statement

Goście hotelowi mają dwa problemy jednocześnie: nie wiedzą, co mają w pakiecie i ile już wykorzystali, oraz każda interakcja z usługą wymaga kontaktu z człowiekiem w recepcji. Połączenie braku informacji z brakiem samoobsługi frustruje gości i przeciąża personel prostymi, powtarzalnymi zapytaniami.

Insight: małe i średnie hotele nie inwestują w warstwę guest-facing, bo nie widzą zwrotu z inwestycji — istniejące PMS-y (Opera, Protel) są narzędziami dla personelu, nie dla gości. HotelGuest wchodzi w tę lukę jako lekka, niezależna warstwa dostępu dla gości, która nie wymaga integracji z PMS.

## User & Persona

**Primary persona — Gość hotelowy**
Osoba przebywająca w hotelu (biznesowa lub turystyczna), która chce wiedzieć, co jest w jej pakiecie i zamówić usługę bez wychodzenia z pokoju lub dzwonienia na recepcję. Moment sięgnięcia po produkt: sprawdzenie ile śniadań zostało, zamówienie dodatkowej usługi SPA, zapytanie AI concierge o restaurację.

**Secondary persona — Personel recepcji (rola: staff)**
Pracownik recepcji, który generuje tokeny dostępowe dla gości i monitoruje oraz realizuje zamówienia. Panel recepcji jest narzędziem operacyjnym — bez niego system nie działa, ale wartość produktu dostarcza gość.

## Access Control

**Gość hotelowy (bezstanowy, bez konta):**
Dostęp dwuetapowy:
1. Token QR generowany przez recepcję (formularz: imię gościa, numer pokoju, daty pobytu) — token publiczny, ważny od check-in do check-out.
2. Skan QR kodu fizycznie umieszczonego w pokoju — weryfikacja, że gość jest faktycznie w pokoju.
Token wygasa automatycznie z upływem daty check-out zapisanej w formularzu. Gość nie tworzy konta, nie ustawia hasła.

**Personel recepcji (rola: `staff`):**
Logowanie e-mail + hasło. Każdy pracownik ma własne konto — możliwy audyt kto oznaczył zamówienie jako zrealizowane. Brak self-registration — konta staff tworzone poza MVP (np. seed/config).

**Role summary:**
- `guest` — dostęp przez token QR, read/write tylko własnych zamówień i pakietu
- `staff` — dostęp do panelu recepcji: generowanie tokenów, podgląd i zarządzanie zamówieniami wszystkich gości

## Success Criteria

### Primary
- Gość przechodzi przez dwuetapową weryfikację QR (token z recepcji → skan QR w pokoju) bez pomocy personelu i uzyskuje dostęp do panelu.
- Gość składa zamówienie na usługę płatną, a recepcja otrzymuje potwierdzenie (e-mail + wpis w panelu) w ciągu 60 sekund.
- Recepcja generuje token QR dla gościa w czasie poniżej 2 minut.

### Secondary
- Dashboard zasobów poprawnie wyświetla procent wykorzystania pakietu dla co najmniej 3 kategorii (śniadania, SPA, parking).
- AI concierge odpowiada na pytanie domenowe (np. „Co polecasz na kolację?") z konkretną propozycją, nie odpowiedzią generyczną.

### Guardrails
- Token gościa wygasa automatycznie z datą check-out — brak dostępu do danych innych gości.
- Zamówienie nigdy nie znika bez śladu — każda zmiana statusu (złożone → zrealizowane / anulowane) jest widoczna w panelu.
- Panel recepcji odświeża zamówienia nie rzadziej niż co 10 sekund (polling).

**MVP flow:**
1. Recepcja generuje token QR (imię gościa, numer pokoju, daty pobytu) → QR do druku / pobrania
2. Gość skanuje QR z recepcji → trafia do panelu gościa
3. Gość skanuje QR fizyczny w pokoju → weryfikacja pobytu, dostęp odblokowany
4. Gość przegląda usługi (included + add-ons) i dashboard pakietu
5. Gość zamawia usługę płatną → recepcja dostaje e-mail (Resend) + wpis w panelu
6. Recepcja oznacza zamówienie jako zrealizowane lub anulowane
7. Gość pyta AI concierge o rekomendację → konkretna odpowiedź domenowa

**Timeline:** praca w ramach dnia pracy (after_hours_only: false), szacowane mvp_weeks: 3

## User Stories

### US-01: Gość uzyskuje dostęp do panelu przez dwuetapowy QR

- **Given** gość otrzymał od recepcji wydrukowany QR token i jest fizycznie w pokoju
- **When** skanuje QR z recepcji, a następnie skanuje QR kod umieszczony w pokoju
- **Then** widzi panel gościa ze swoim pakietem (included) i dostępnymi add-onami

#### Acceptance Criteria
- Po pierwszym skanie (token z recepcji) gość widzi ekran weryfikacji, nie pełny panel
- Po drugim skanie (QR w pokoju) gość uzyskuje pełny dostęp bez żadnej dodatkowej akcji
- Jeśli token wygasł (po check-out), gość widzi komunikat o braku dostępu, nie blank screen

### US-02: Gość zamawia usługę add-on

- **Given** gość ma pełny dostęp do panelu i widzi listę dostępnych add-onów
- **When** wybiera add-on (np. masaż) i potwierdza zamówienie
- **Then** zamówienie pojawia się w panelu recepcji w ciągu 60 sekund, a gość widzi status "oczekuje" z wizualnym badge'em

#### Acceptance Criteria
- Zamówienie nie może zniknąć bez śladu — każda zmiana statusu jest widoczna
- Gość może anulować zamówienie inline, ale tylko dopóki recepcja nie oznaczyła go jako zrealizowane

### US-03: Recepcjonista obsługuje zamówienie gościa

- **Given** recepcjonista jest zalogowany do panelu recepcji i widzi badge z liczbą nowych zamówień
- **When** otwiera listę zamówień (odświeżaną co 10s) i oznacza zamówienie jako zrealizowane
- **Then** status zmienia się w panelu gościa na "zrealizowane" i badge w panelu recepcji się aktualizuje

#### Acceptance Criteria
- Panel odświeża zamówienia automatycznie — recepcjonista nie musi ręcznie odświeżać strony
- Badge pokazuje tylko nieobsłużone zamówienia, nie wszystkie

## Functional Requirements

### Authentication & Access
- FR-001: Recepcjonista może wygenerować token QR dla gościa (imię, pokój, daty pobytu, typ pakietu). Priority: must-have
  > Socrates: Kontrargument rozważony: "token mógłby być wysyłany automatycznie z e-maila rezerwacyjnego". Utrzymany — automatyzacja wymaga integracji z systemem rezerwacji, poza MVP.
- FR-002: Gość może zeskanować token QR z recepcji, aby wejść do panelu gościa. Priority: must-have
- FR-003: Gość może zeskanować QR kod w pokoju, aby potwierdzić pobyt i odblokować pełny dostęp. Priority: must-have
  > Socrates: Kontrargument rozważony: "dwa skany QR to za dużo tarcia — jeden mógłby wystarczyć". Utrzymany — drugi skan weryfikuje fizyczną obecność w pokoju, co jest kluczowym zabezpieczeniem.
- FR-004: Token gościa wygasa automatycznie z datą check-out. Priority: must-have
- FR-005: Recepcjonista może zalogować się do panelu recepcji swoim e-mailem i hasłem. Priority: must-have

### Guest panel — services
- FR-006: Gość może przeglądać listę usług w pakiecie bezpłatnym (included). Priority: must-have
- FR-007: Gość może przeglądać listę usług płatnych (add-ons). Priority: must-have
  > Socrates: Kontrargument rozważony: "hotel bez technicznego staff nie będzie edytował pliku config — bariera adopcji". Utrzymany — MVP celuje w jeden hotel pilotażowy; panel CRUD to zakres post-MVP.
- FR-008: Gość może złożyć zamówienie na usługę płatną. Priority: must-have
- FR-009: Gość może anulować aktywne zamówienie bezpośrednio z widoku usług (inline, bez osobnego panelu zamówień). Priority: must-have
  > Socrates: Kontrargument rozważony: "anulowanie po realizacji powinno wymagać kontaktu z recepcją". Utrzymany — anulowanie samodzielne możliwe tylko przed oznaczeniem zamówienia jako zrealizowane przez staff.

### Guest panel — resource dashboard
- FR-010: Gość może zobaczyć dashboard pakietu: co jest included (np. basen, sauna) i jakie add-ony są dostępne, wraz ze statusem zamówionych add-onów (np. kolor/badge: oczekuje / zrealizowane). Priority: must-have
  > Socrates: Kontrargument rozważony: "bez liczników zasobów dashboard to tylko lista — czy warto go wyróżniać?". Utrzymany — wizualizacja statusu add-onów z kolorem/badge tworzy wartość nawet bez liczników; gość widzi co ma i co zamówił.

### AI concierge
- FR-011: Gość może zadać pytanie AI concierge i otrzymać konkretną rekomendację domenową. Priority: must-have
  > Socrates: Kontrargument rozważony: "bez danych o hotelu i okolicy concierge odpowiada generycznie, jak ChatGPT". Utrzymany — jakość odpowiedzi zależy od danych wejściowych (prompt z kontekstem hotelowym); sposób dostarczenia tych danych to kwestia implementacji.

### Reception panel
- FR-012: Recepcjonista może przeglądać listę aktywnych zamówień gości (auto-odświeżanie co 10s). Priority: must-have
  > Socrates: Kontrargument rozważony: "polling co 10s przy wielu sesjach generuje niepotrzebny ruch — WebSocket byłby lepszy". Utrzymany — dla MVP z jednym hotelem polling jest wystarczający; WebSocket/SSE to optymalizacja post-MVP.
- FR-013: Recepcjonista może oznaczyć zamówienie jako zrealizowane lub anulowane. Priority: must-have
- FR-014: Recepcjonista może pobrać lub wydrukować wygenerowany QR token gościa. Priority: must-have
- FR-015: Panel recepcji wyświetla badge z liczbą nowych (nieobsłużonych) zamówień, aktualizowany przy każdym pollingu. Priority: must-have

## Business Logic

System przypisuje gościowi pakiet usług (included) na podstawie wyboru recepcji przy generowaniu tokenu i umożliwia samodzielne dokupienie add-onów — z natychmiastową wizualizacją statusu dla gościa oraz przekazaniem zamówienia do realizacji przez personel, bez konieczności interakcji face-to-face.

Dwa współdziałające mechanizmy tworzą rdzeń produktu:
1. **Przypisanie pakietu**: recepcja wybiera typ pakietu przy generowaniu tokenu QR (formularz). Pakiet definiuje, które usługi są included (widoczne jako aktywne, bez akcji) i które są dostępne jako add-ony (można zamówić).
2. **Ścieżka zamówienia add-on**: gość składa zamówienie → system rejestruje je ze statusem "oczekuje" → recepcja widzi zamówienie w panelu i oznacza je jako zrealizowane lub anulowane → status wraca do gościa jako wizualna zmiana (kolor/badge). Płatność odroczona do check-out (offline).

AI concierge jest warstwą uzupełniającą: odpowiada na pytania domenowe (hotel, okolica, rekomendacje) z kontekstem hotelowym dostarczonym w prompcie — nie jest częścią ścieżki zamówienia.

## Non-Functional Requirements

- Zamówienie gościa pojawia się w panelu recepcji w ciągu 60 sekund od złożenia.
- Panel recepcji odświeża listę zamówień co najwyżej co 10 sekund (polling).
- Token gościa przestaje działać najpóźniej z upływem daty check-out — brak dostępu do danych innego gościa jest mierzalny.
- AI concierge daje odpowiedź specyficzną dla hotelu (imię, adres, atrakcje, restauracje) — odpowiedź generyczna ("polecam pobliskie restauracje") bez konkretów jest niedopuszczalna.
- Interfejs gościa działa na smartfonie bez instalowania aplikacji (web, przeglądarka mobilna).

## Product Framing

- product_type: web-app
- target_scale: { users: small, qps: low, data_volume: small } — jeden hotel pilotażowy, kilka sesji jednocześnie
- timeline_budget: { mvp_weeks: 3, hard_deadline: 2026-06-30, after_hours_only: false }

## Non-Goals

- Brak płatności online (karta, BLIK) — rozliczenie tylko przy wymeldowaniu, offline. Rationale: upraszcza MVP, eliminuje integrację z bramką płatniczą.
- Brak panelu CRUD usług dla hotelu — usługi konfigurowane przez plik konfiguracyjny. Rationale: MVP celuje w jeden hotel pilotażowy ze stałym zestawem usług.
- Brak integracji z PMS (Opera, Protel itp.) — system działa niezależnie. Rationale: integracja wymagałaby dostępu do API PMS, poza zakresem MVP.
- Brak wielojęzyczności — jeden język na start (polski lub angielski). Rationale: upraszcza i-18n, wystarczające dla jednego hotelu pilotażowego.
- Brak historii poprzednich pobytów i programu lojalnościowego — każdy pobyt izolowany. Rationale: wymaga trwałej tożsamości gościa, poza MVP.
- Brak powiadomień push i przypomnień — gość nie dostaje powiadomień poza aplikacją. Rationale: wymaga serwisu push (FCM/APNs) lub e-mail do gościa, poza MVP.
- Brak natywnych aplikacji mobilnych — tylko web. Rationale: PWA/web na smartfonie wystarczy dla MVP bez kosztów dystrybucji przez sklepy.

## Open Questions

1. **Źródło danych do dashboardu add-onów** — system śledzi add-ony zamówione przez aplikację. Jeśli hotel ma usługi (basen, sauna) używane poza aplikacją — ich status nie będzie widoczny. Właściciel: user. Blokada: nie (dashboard wyświetla tylko zamówienia złożone przez app).
2. **Dostarczanie kontekstu hotelowego do AI concierge** — dane (menu, atrakcje, restauracje) muszą skądś pochodzić. Opcje: config JSON, prompt systemowy, baza. Właściciel: user. Blokada: nie dla MVP (można zacząć od hardcoded promptu), ale jakość odpowiedzi od tego zależy.






