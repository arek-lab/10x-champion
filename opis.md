## HotelGuest - MVP

### Główny problem
Goście hotelowi mają ograniczony wgląd w dostępne usługi i zasoby, a personalizacja pobytu wymaga każdorazowego kontaktu z recepcją, co frustruje gości i obciąża personel.

### Najmniejszy zestaw funkcjonalności

**Panel gościa**
- Dwuetapowy mechanizm dostępu: QR kod z recepcji (token publiczny) + skan QR kodu w pokoju (weryfikacja pobytu)
- Przeglądanie usług hotelowych: pakiet bezpłatny (included) i płatny (add-ons)
- Zamówienie usług płatnych z potwierdzeniem do recepcji (płatność offline przy wymeldowaniu)
- Zarządzanie zamówieniami gościa: podgląd aktywnych usług, edycja i anulowanie zamówień
- Dashboard wykorzystania zasobów: przeliczenie ile z dostępnego pakietu gość już wykorzystał (np. śniadania, minuty SPA, bagaż, parking)
- Czat z AI concierge (rekomendacje, odpowiedzi na pytania o hotel i okolicę)

**Panel recepcji** (osobne logowanie e-mail + hasło, rola `staff`)
- Generowanie tokenów QR dla gości: formularz (imię gościa, numer pokoju, daty pobytu) → QR do druku lub pobrania
- Podgląd aktywnych zamówień gości z automatycznym odświeżaniem (polling co 10 sekund)
- Ręczne oznaczanie zamówień jako zrealizowane lub anulowane
- Powiadomienie e-mail do recepcji przy każdym nowym zamówieniu (Resend, <60 sekund)

### Co NIE wchodzi w zakres MVP
- Płatności online (karta, BLIK) — tylko potwierdzenie do rozliczenia przy wymeldowaniu
- Pełny panel zarządzania hotelem (CRUD usług, zarządzanie pokojami) — usługi konfigurowane przez plik konfiguracyjny
- Integracja z zewnętrznymi systemami PMS (Opera, Protel itp.)
- Wielojęzyczność (na start tylko polski lub angielski)
- Historia poprzednich pobytów i program lojalnościowy
- Powiadomienia push i przypomnienia
- Aplikacje mobilne (na początek tylko web)

### Kryteria sukcesu
- Gość przechodzi przez dwuetapową weryfikację QR (recepcja → pokój) bez pomocy personelu
- Recepcja generuje token QR dla gościa w czasie poniżej 2 minut
- Dashboard zasobów poprawnie wyświetla procent wykorzystania pakietu dla co najmniej 3 kategorii (np. śniadania, SPA, parking)
- Gość składa zamówienie na usługę płatną, a recepcja otrzymuje potwierdzenie (e-mail + widok w panelu) w ciągu 60 sekund
- AI concierge odpowiada na pytanie domenowe (np. „Co polecasz na kolację?") z konkretną propozycją, nie odpowiedzią generyczną