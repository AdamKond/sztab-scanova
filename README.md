# SZTAB — kolejka sprzedaży SCANOVY

Wewnętrzne narzędzie dla dwóch osób (Adam, Oliwier). Odpowiada na jedno
pytanie: **co dziś zrobić, żeby zdobyć klientów**. Osobny projekt Supabase
i osobny projekt Vercel, niezależne od aplikacji lojalnościowej.

## Cztery ekrany

| Ekran | Po co |
|---|---|
| **Dziś** | Trzy listy w kolejności ważności: rozmowy do ruszenia, follow-upy po 3 dniach ciszy, nowe DM-y (limit 30/dzień/konto). Każdy lokal ma jeden przycisk: kopiuje tekst, otwiera Instagram, odhacza. |
| **Rozmowy** | Tylko lokale, które odpisały. Sześć kroków: Odpisał → Rozmawia → Wizyta → Po demo → Pilot → Płaci (plus Później / Nie). Gotowe odpowiedzi do skopiowania. |
| **Klienci** | Piloty (miesiąc za darmo), płacący, MRR, ci którzy odeszli. |
| **Baza** | Wszystkie lokale do zaczepienia, dodawanie pojedynczo lub wklejoną listą. Stąd bierze się kolejka na Dziś. |

## Jak to działa (lejek)

1. **DM #1** — człowiek wysyła ręcznie ze swojego konta (bot = blokada konta IG).
   Tekst per nisza w `lib/crm/dm-copy.ts`: krótki, bez linku, kończy się pytaniem.
2. **3 dni ciszy** → lokal sam wskakuje do sekcji Follow-upy na Dziś.
3. **Odpowiedź** → przycisk „Odpowiedział” tworzy rozmowę z krokiem „Odpisał”
   i gotową odpowiedzią „Odpisał → filmik”.
4. **Rozmowa** → wizyta 5 minut → demo → pilot 30 dni → płatny klient.

System niczego nie wysyła sam. Wysyła człowiek.

## Stack

Next.js 16 (App Router) · TypeScript strict · Tailwind v4 · Supabase
(Postgres + Auth, service role za twardą allowlistą) · Geist · vitest.

## Szybki start

```bash
npm install
cp .env.example .env.local        # albo: npx vercel env pull .env.local
npm run dev
```

Konfiguracja Supabase, migracje (001–005), konta i allowlista: `supabase/README.md`.

## Komendy

| Komenda | Co robi |
|---|---|
| `npm run dev` | serwer deweloperski |
| `npm run build` | build produkcyjny |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | testy jednostkowe (czysta logika, bez bazy) |
| `npx tsx scripts/create-user.ts <email> <hasło>` | tworzy konto z potwierdzonym e-mailem |
| `curl localhost:3000/api/health` | stan połączenia i tabel |
| `/api/export/{rozmowy,aktywnosci,historia,baza}` | eksport CSV (po zalogowaniu) |

## Model bezpieczeństwa

- RLS włączone na wszystkich tabelach, **zero polityk** + `revoke all` —
  jedyna droga do danych to service role w zweryfikowanym kodzie serwerowym.
- Twarda allowlista: `STAFF_EMAILS` + opcjonalnie `STAFF_USER_IDS`
  + wymagane `email_confirmed_at`.
- Obcy (także zalogowany spoza allowlisty) dostaje **404**.
- Każda server action zaczyna się od `guardStaffAction()`. Autor wpisów
  pochodzi z sesji, nigdy z formularza.

## Struktura

```
app/(staff)/        Dziś (/), rozmowy, rozmowy/[id], klienci, baza
app/login, logout   logowanie e-mail+hasło (bez rejestracji)
app/api/            health, eksport CSV, inbound webhook z landingu (tokenowany)
lib/auth.ts         allowlista, requireStaff (404), guardStaffAction
lib/crm/dm-copy.ts  TEKSTY: pierwszy DM per nisza, follow-up, gotowe odpowiedzi
lib/crm/steps.ts    6 kroków rozmowy ↔ statusy bazy
lib/crm/blitz.ts    Baza: etap lokalu (z timestampów), kolejka na dziś, follow-upy
lib/crm/actions.ts  wszystkie mutacje (server actions)
lib/crm/queries.ts  odczyty
components/         shell (jasny sidebar / dolne zakładki), ui, baza (DmRow), rozmowy
supabase/           migracje 001–005 + instrukcja
tests/              vitest — blitz, steps, metryki, walidacja, daty, allowlista
```

## Zasady, których pilnuje kod

- Historia etapów (`crm_stage_history`) powstaje triggerem w bazie.
- Pilot wymaga dat, płatny klient wymaga daty + planu + MRR, „nie” wymaga powodu.
- **Pilot nie jest płatnym klientem.** MRR nie obejmuje churnu.
- Etap lokalu w Bazie liczy się z timestampów (`sent_at`, `followup_sent_at`,
  `lead_id`), nie z kolumny statusu — cofnięcie odhaczenia cofa etap.
- Błąd bazy nigdy nie zamienia się w „0” — rdzeń failuje głośno.

## Wydajność

Funkcje serwerowe działają we Frankfurcie (`vercel.json` → `regions: ["fra1"]`),
tam gdzie baza. `app/(staff)/loading.tsx` daje natychmiastowe przejścia.
