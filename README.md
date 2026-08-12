# SZTAB — CRM sprzedaży i marketingu SCANOVY

Wewnętrzny system operacyjny sprzedaży dla dwóch osób (Adam, Oliwier).
Niezależny od produkcyjnej aplikacji lojalnościowej: **osobny projekt Supabase**
i **osobny projekt Vercel**.

Odpowiada codziennie na pytania: z kim się dziś skontaktować, które firmy
pasują do ICP, gdzie tracimy leady, ile demo zamienia się w piloty, ile pilotów
w abonamenty, ile mamy MRR i z jakiego kanału.

## Stack

Next.js 16 (App Router) · TypeScript strict · Tailwind v4 · Supabase
(Postgres + Auth, service role za twardą allowlistą) · Geist · papaparse ·
vitest. Bez biblioteki wykresów (SVG/CSS), bez UI frameworka.

## Szybki start

```bash
npm install
cp .env.example .env.local        # uzupełnij wg supabase/README.md
npm run dev
```

Pełna instrukcja konfiguracji (projekt Supabase w eu-central-1, migracja,
wyłączenie signupów, konta, allowlista, Vercel): **`supabase/README.md`**.

## Komendy

| Komenda | Co robi |
|---|---|
| `npm run dev` | serwer deweloperski |
| `npm run build` | build produkcyjny |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | testy jednostkowe (czysta logika, bez bazy) |
| `npx tsx scripts/create-user.ts <email> <hasło>` | tworzy konto z potwierdzonym e-mailem |
| `npx tsx scripts/test-db.ts` | testy domenowe na żywej bazie (pomija się bez konfiguracji) |
| `npx tsx scripts/import-stary-sztab.ts <plik.json>` | dry-run importu ze starego Sztabu (`--wykonaj` zapisuje) |
| `curl localhost:3000/api/health` | stan połączenia i tabel rdzenia |

## Model bezpieczeństwa (skrót)

- RLS włączone na wszystkich tabelach, **zero polityk** + `revoke all` —
  jedyna droga do danych to service role w zweryfikowanym kodzie serwerowym.
- Twarda allowlista: `STAFF_EMAILS` + opcjonalnie `STAFF_USER_IDS`
  + wymagane `email_confirmed_at`. Bez wyjątków i obejść.
- Obcy (także poprawnie zalogowany spoza allowlisty) dostaje **404** —
  sekcja ma nie istnieć.
- Każda server action zaczyna się od `guardStaffAction()` (weryfikacja
  + rate-limit). Autor wpisów pochodzi z sesji, nigdy z formularza.

## Struktura

```
app/(staff)/        ekrany: Dziś, leady, outbound, followup, odprawa AI, pipeline, piloty,
                    cele, content, ads, partnerzy, import, ustawienia
app/login, logout   logowanie e-mail+hasło (bez rejestracji), wylogowanie
app/api/            health, eksport CSV (8 zbiorów), inbound webhook z landingu (tokenowany)
lib/auth.ts         allowlista, requireStaff (404), guardStaffAction
lib/supabase/       klient auth (anon+cookies) ↔ klient danych (service role, server-only)
lib/crm/            typy, stałe PL, normalizacja, walidacja przejść, metryki (czyste),
                    marketing (ads + kolejka outboundu), queries, actions
lib/ai/             odprawa dnia + generator hooków (opcjonalne, Anthropic SDK, claude-opus-5)
components/         shell (ciemny sidebar + jasny canvas), ui, crm
supabase/           migration-001-core.sql, migration-002-etapy-2-4.sql + instrukcja
scripts/            create-user, test-db, import ze starego Sztabu
tests/              vitest — metryki, marketing, normalizacja, walidacja, daty, allowlista
```

## Zasady domenowe, których pilnuje kod

- Historia etapów (`crm_stage_history`) powstaje triggerem w bazie — konwersje
  i czas w etapie liczone są z historii, nie z bieżącego statusu.
- Przejścia wymagają danych: pilot → daty, płatny klient → data + plan + MRR,
  utrata/rezygnacja/dyskwalifikacja → powód.
- **Pilot nie jest płatnym klientem.** MRR nie obejmuje churnu.
- Cele są edytowalne w UI (`sales_goals`) — żadnych zakodowanych „6 wizyt
  dziennie". Progi (stygnięcie, zaleganie, check-iny pilota) w Ustawieniach.
- Błąd bazy nigdy nie zamienia się w „0" w KPI — rdzeń failuje głośno.

## Etapy — wszystkie zbudowane

- **Etap 0–1:** rdzeń CRM (auth, leady, lejek z historią, aktywności, zadania,
  piloty/MRR, KPI, import CSV, cele).
- **Etap 2:** kolejka outboundu (sekwencja DM→follow-up→telefon→wizyta, szablony
  bez automatycznej wysyłki), partnerzy z poleceniami, tokenowany inbound
  z landingu (dedupe + UTM), eksport CSV.
- **Etap 3:** pipeline contentu (pomysł→archiwum, wyniki ręczne) i dziennik
  reklam (CPL ≠ CAC, alert drogiego CPL po 3 kolejnych dniach).
- **Etap 4:** odprawa AI (3 priorytety, follow-upy, ryzyko lejka, eksperyment)
  i generator hooków — opcjonalne, wymaga `ANTHROPIC_API_KEY`; do modelu trafiają
  wyłącznie agregaty i nazwy firm.
