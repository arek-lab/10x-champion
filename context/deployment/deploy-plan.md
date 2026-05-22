---
project: room-pilot
planned_at: 2026-05-22
platform: Cloudflare Workers
status: ready-to-deploy
---

# Pierwsze wdrożenie room-pilot → Cloudflare Workers

## Zmiany konfiguracyjne (wykonane)

| Plik | Zmiana |
|------|--------|
| `wrangler.jsonc` | `name`: `10x-astro-starter` → `room-pilot` |
| `wrangler.jsonc` | `assets.directory`: `./dist` → `./dist/client` |
| `astro.config.mjs` | `adapter: cloudflare({ imageService: "compile" })` — zapobiega błędowi `cloudflare-binding` w v13 |
| `package.json` | `name`: `10x-astro-starter` → `room-pilot` |
| `.github/workflows/ci.yml` | Dodany krok `wrangler deploy` po build, tylko dla push do mastera |

---

## Krok 1 — Cloudflare setup (ręcznie)

```
! npx wrangler login
```

Następnie w Cloudflare Dashboard → My Profile → API Tokens → Create Token → szablon **"Edit Cloudflare Workers"** — skopiuj token (potrzebny do GitHub Secrets).

> **Free tier jest OK na start.** Workers mierzą CPU time (nie wall-clock) — sieć (Supabase fetch) nie wlicza się w 10ms. Typowy SSR+Supabase to 2–5ms CPU. Upgrade do Paid ($5/mies.) dopiero gdy `wrangler tail` pokazuje realne przekroczenia.

---

## Krok 2 — GitHub repo setup (ręcznie)

```
! git init
! git add .
! git commit -m "Initial commit: room-pilot bootstrapped from 10x-astro-starter"
```

Na GitHub.com: New repository → `room-pilot`, puste (bez init).

```
! git remote add origin https://github.com/<username>/room-pilot.git
! git push -u origin master
```

**GitHub Secrets** (Settings → Secrets and variables → Actions):

| Secret | Wartość |
|--------|---------|
| `SUPABASE_URL` | URL z projektu Supabase |
| `SUPABASE_KEY` | anon key z projektu Supabase |
| `CLOUDFLARE_API_TOKEN` | token z kroku 1 |

---

## Krok 3 — Wrangler secrets (ręcznie)

```
! npx wrangler secret put SUPABASE_URL
! npx wrangler secret put SUPABASE_KEY
```

---

## Krok 4 — Pierwsze wdrożenie (ręcznie)

```
! npm run build
! npx wrangler deploy
```

Po deploy terminal wyświetla URL: `room-pilot.<subdomain>.workers.dev`

---

## Weryfikacja

```
! npx wrangler deployments list
! npx wrangler tail room-pilot --format json
```

Checklist:
- [ ] Strona główna ładuje się bez 500
- [ ] `/auth/signin` renderuje formularz (Supabase połączony)
- [ ] Brak `"outcome":"exception"` w `wrangler tail`
- [ ] GitHub Actions: deploy step pojawia się tylko dla push (nie PR)

---

## Ryzyki

| Ryzyko | Akcja |
|--------|-------|
| `dist/client/` nie istnieje po build | Sprawdź strukturę `dist/` po `npm run build`; jeśli adapter buduje do `dist/`, zmień `assets.directory` z powrotem na `"./dist"` |
| `nodejs_compat` shim gap | `compatibility_date = 2026-05-08` (w normie); 500 na auth stronach → sprawdź shim coverage |
