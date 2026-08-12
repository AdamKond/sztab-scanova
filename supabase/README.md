# SZTAB — konfiguracja Supabase (krok po kroku)

SZTAB używa **nowego, osobnego projektu Supabase** — nie łącz go z produkcyjną
bazą aplikacji lojalnościowej SCANOVY.

## 1. Utwórz projekt

1. [supabase.com](https://supabase.com) → **New project**.
2. Organizacja: dowolna należąca do SCANOVY, nazwa np. `scanova-sztab`.
3. Region: **`eu-central-1` (Frankfurt)**.
4. Zapisz hasło do bazy w menedżerze haseł (nie będzie potrzebne w aplikacji).

## 2. Uruchom migracje (w kolejności)

1. W dashboardzie: **SQL Editor → New query**.
2. Wklej całą zawartość `supabase/migration-001-core.sql` → **Run**.
3. Następnie wklej `supabase/migration-002-etapy-2-4.sql` → **Run**
   (partnerzy, szablony, content, dziennik reklam, odprawy AI).
4. Każdą migrację uruchamiaj raz. Są idempotentne (`if not exists`), więc
   ponowne uruchomienie nie zepsuje danych, ale nie jest potrzebne.

## 3. Wyłącz publiczną rejestrację

1. **Authentication → Sign In / Up → wyłącz „Allow new users to sign up"**.
2. Providers: zostaw tylko **Email**. Wyłącz „Confirm email" NIE trzeba —
   konta tworzone skryptem są od razu potwierdzone.

## 4. Utwórz dwa konta

W katalogu projektu, z uzupełnionym `.env.local` (patrz krok 5 — potrzebne
`SUPABASE_URL` i `SUPABASE_SERVICE_KEY`):

```bash
npx tsx scripts/create-user.ts adam@twojadomena.pl  'silne-haslo-1'
npx tsx scripts/create-user.ts oliwier@twojadomena.pl 'silne-haslo-2'
```

Skrypt tworzy konto z potwierdzonym e-mailem i wypisuje UUID użytkownika —
skopiuj oba UUID do allowlisty.

## 5. Zmienne środowiskowe

Skopiuj `.env.example` do `.env.local` i uzupełnij:

| Zmienna | Skąd wziąć |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API → anon public |
| `SUPABASE_URL` | to samo co wyżej (Project URL) |
| `SUPABASE_SERVICE_KEY` | Project Settings → API → service_role (**sekret — nigdy do repo ani `NEXT_PUBLIC_*`**) |
| `STAFF_EMAILS` | dwa e-maile po przecinku, np. `adam@x.pl,oliwier@x.pl` |
| `STAFF_USER_IDS` | dwa UUID z kroku 4, po przecinku |

Opcjonalne (system działa bez nich):

| Zmienna | Po co |
|---|---|
| `ANTHROPIC_API_KEY` | włącza odprawę AI i generator hooków (ekran „Odprawa AI") |
| `SZTAB_AI_MODEL` | nadpisuje model AI (domyślnie `claude-opus-5`) |
| `INBOUND_WEBHOOK_SECRET` | włącza endpoint `POST /api/inbound/lead` dla formularza landingu |

Przykład zgłoszenia z landingu (dedupe wbudowane — duplikat dopisuje aktywność
zamiast tworzyć drugą firmę):

```bash
curl -X POST https://twoj-sztab.vercel.app/api/inbound/lead \
  -H "x-inbound-token: $INBOUND_WEBHOOK_SECRET" \
  -H "content-type: application/json" \
  -d '{"name":"Kawiarnia X","phone":"512 345 678","city":"Lublin",
       "message":"Proszę o kontakt","utm_source":"meta","utm_campaign":"sierpien"}'
```

## 6. Weryfikacja

```bash
npm run dev
curl http://localhost:3000/api/health   # oczekiwane: {"ok":true,...}
npx tsx scripts/test-db.ts              # testy domenowe na żywej bazie
```

Zaloguj się na jedno z kont. Konto spoza allowlisty (albo niezalogowany
użytkownik) na każdej prywatnej stronie dostaje **404** — celowo, sekcja ma
nie istnieć dla obcych.

## 7. Vercel

1. Osobny projekt w istniejącym zespole **Vercel Pro** SCANOVY (nie Hobby —
   system służy działalności komercyjnej).
2. Import repo albo `vercel` z CLI (`npm i -g vercel`).
3. Wgraj te same zmienne środowiskowe do Production (Settings → Environment
   Variables albo `vercel env add`).
