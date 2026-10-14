# START — jak wrócić do pracy na nowym komputerze

Ostatnia aktualizacja: 2026-09-27. Autor notatek: Claude (sesja 21–22 września 2026).

## 1. Nowy komputer w 10 minut

1. Zainstaluj Git: https://git-scm.com/download/win (albo `winget install Git.Git`).
2. Sklonuj repo na Pulpit:
   ```
   cd %USERPROFILE%\Desktop
   git clone https://github.com/AdamKond/sztab-scanova.git "Sztab Scanova"
   ```
3. Otwórz folder `Sztab Scanova` w VS Code, uruchom Claude'a i napisz: **„czytaj docs/START.md i uruchom skrypt setup"**.
   Skrypt `scripts/setup-nowy-komputer.ps1` sam: instaluje GitHub CLI i Node, klonuje pozostałe repozytoria
   (strona, Serce Mamy, AI Recepcjonista), pobiera klucze z Vercela do `.env.local`, instaluje zależności
   i przywraca pamięć Claude'a z `docs/pamiec/`. Dwa kroki wymagają Twojego kliknięcia w przeglądarce:
   `gh auth login` i `vercel login` — skrypt pokaże kod/link.
4. Sprawdzenie: `npm run dev` → http://localhost:3000 → logujesz się jak na produkcji.

## 2. Co to jest i gdzie co leży

| Repo (GitHub: AdamKond) | Folder na Pulpicie | Co | Deploy |
|---|---|---|---|
| `sztab-scanova` | Sztab Scanova | CRM sprzedaży: 4 ekrany (Dziś / Rozmowy / Klienci / Baza) | https://sztab-scanova.vercel.app — `npx vercel --prod` z folderu (repo NIE jest połączone z Vercelem przez Git) |
| `scanova-tech` | Scanova Strona | strona scanova.tech + **kalkulator** (`kalkulator.html`) | Vercel, projekt `scanova-tech`; auto-deploy z `main` bywa niepewny → `npx vercel --prod` |
| `scanova-nfc-loyalty` | (nie sklonowane) | aplikacja Scanovy (panel, karty Wallet) — źródło mechaniki produktu | produkcja Scanovy |
| `SERCEMAMY` | Serce Mamy | strona stowarzyszenia | Vercel |
| `ai-recepcjonista` | AI Recepcjonista | telefoniczny recepcjonista (ElevenLabs) dla Serce Mamy | Vercel `ai-recepcjonista-backend` |

Vercel: zespół `absolusq-8712s-projects`. Supabase Sztabu: osobny projekt, migracje 001–005 uruchamia się
ręcznie w SQL Editorze (wszystkie są już uruchomione na produkcji). Klucze: `npx vercel env pull .env.local`.

## 3. Stan Sztabu (2026-09-27)

- Przebudowa 2026-09-21: 18 ekranów → 4. Teksty DM: `lib/crm/dm-copy.ts`. Kroki rozmowy: `lib/crm/steps.ts`.
  Kolejka DM i etapy lokalu: `lib/crm/blitz.ts`. Mutacje: `lib/crm/actions.ts`.
- **Baza: 732 lokale** (Lublin ~280, Rzeszów ~95, Kielce ~79, Radom ~66, Zamość, Biała Podlaska, Puławy,
  Chełm, Biłgoraj, mniejsze miasta), ~500 z własnym pierwszym zdaniem („HOOK:” w `dm_text`).
  Partia z 2026-10-05: `docs/research-2026-10/leady-2026-10-05.txt` (30 zaimportowanych, kampania `baza-2026-10`,
  + 20 potwierdzonych w sekcji REZERWA do następnej partii, 3 DO DECYZJI, + NIEPEWNE).
  Wysłane DM-y na 22.09: 2 (Rykowisko, Canotto). Reszta czeka.
- Kontakty e-mail/telefon: `docs/research-2026-09/kontakty.csv` (126 lokali; 51 e-maili i 74 telefony
  potwierdzone na stronach źródłowych — kolumny `*_status`). Szablony maili: `docs/mail-zimny.md`.
- ~120 lokali „NIEPEWNE” (nazwy bez potwierdzonego Instagrama): sekcje `### NIEPEWNE` w
  `docs/research-2026-09/*.txt` i `runda-2/`. Do domknięcia w sesji ze świeżym limitem WebSearch.
- Cennik (ze strony): Standard 250 zł, **Pro 339 zł** (opinie Google — to plan, który obiecują DM-y), Max 590 zł;
  /mies. za lokal, bez umowy, wdrożenie do 3 dni, stojak i karty w cenie. **Od 2026-10-13: pierwsze 14 dni za darmo**
  (decyzja Adama; DM-y, maile, tablica i Sztab już tak mówią; strona scanova.tech nadal ma „30 dni”, repo `scanova-tech`
  nie jest sklonowane na Macu, do poprawienia osobno).
- Kalkulator: https://scanova.tech/kalkulator (presety branżowe z raportów, `?film=1` do nagrania,
  `?b=pizzeria`, `?g=&r=&m=&plan=` z liczbami lokalu). Model: karta u 30% gości, wracają o 15/25/40% częściej,
  nagrody liczone dla wszystkich z kartą, ~3,3 opinii na 100 wizyt (sufit 200).
- Tablica do filmiku: `docs/tablica-scanovy.html` — od 2026-10-08 pod **minutowy filmik** (5 plansz do czerwonej
  kreski, niżej kalkulator na spotkanie; `F` = tryb filmowy, `?x=&y=&z=` = liczby z panelu do planszy „Dowód”).
  Tekst: `docs/filmik-1min.md` (stary 3-minutowy: `docs/filmik-tekst.md`). Plan dnia: `docs/plan-2026-09-21.md`.
- **Montaż rolki (HyperFrames, 2026-10-14):** `videos/README.md` — 3 wersje 9:16 z nagrania Adama, pipeline
  nagranie → kadry → transkrypcja → build → render. Nagrania i rendery poza gitem.
- **ManyChat (decyzja 2026-10-12: podłączamy)**: plan i instrukcja klik-po-kliku w `docs/manychat-plan.md`;
  webhook `POST /api/inbound/ig-reply` działa, token `INBOUND_WEBHOOK_SECRET` wygenerowany na nowo 2026-10-12
  (na Vercelu jako sensitive, kopia tylko w `.env.local` na Macu); test `sh scripts/test-ig-reply.sh <handle>`.
- Integracja Instagram przez API Mety (alternatywa bez abonamentu): kod gotowy (`app/api/meta/instagram`, `lib/meta/*`),
  webhook `POST /api/inbound/ig-reply` (token `INBOUND_WEBHOOK_SECRET`). Na Vercelu jest `META_VERIFY_TOKEN`;
  **brakuje**: `META_APP_SECRET`, `META_IG_ACCESS_TOKEN`, `META_IG_USER_ID`, `META_AUTO_REPLY=1`, `NEXT_PUBLIC_FILM_URL`.
  Wymaga aplikacji w developers.facebook.com (Instagram API with Instagram Login) i App Review. Odłożone.

## 4. Co jest do zrobienia (po stronie Adama)

1. **Nagrać filmik** (2–3 min wg `docs/filmik-scenariusz.md` / tablicy) → link jako `NEXT_PUBLIC_FILM_URL`
   na Vercelu (`npx vercel env add NEXT_PUBLIC_FILM_URL production`) → odpowiedź „Odpisał → filmik” i bot mają link.
2. Wysyłać DM-y: Sztab → Dziś → filtr miasta → „Wyślij DM” (kopiuje tekst, otwiera profil, odhacza). 30/dzień/konto.
3. Maile: 51 potwierdzonych adresów z `kontakty.csv`, wariant A z `mail-zimny.md`, z imiennego adresu.
4. Meta/bot — gdy będzie czas: konto IG firmowe → aplikacja Meta → 3 klucze → App Review.

## 5. Skrypty, które się przydają

| Komenda | Co robi |
|---|---|
| `npx tsx scripts/import-leady-baza.ts <plik-lub-katalog> --wykonaj` | import lokali do Bazy (format `@handle \| Nazwa \| Miasto \| nisza \| obs \| hook`; bez `--wykonaj` = dry-run) |
| `npx tsx scripts/popraw-hooki.ts <plik> --wykonaj` | nadpisuje nazwę/miasto/hook po handle (pomija wysłane) |
| `npx tsx scripts/create-user.ts <email> <hasło>` | nowe konto do Sztabu (+ dopisać do `STAFF_EMAILS`/`STAFF_USER_IDS` na Vercelu) |
| `/api/health` | stan bazy i migracji |
| `/api/export/{rozmowy,aktywnosci,historia,baza}` | eksport CSV (po zalogowaniu) |

## 6. Pułapki (żeby nie tracić czasu drugi raz)

- Subagenty dzielą limit **200 wyszukiwań WebSearch na sesję** — research dzielić na mniejsze agenty, a gdy limit padnie,
  agenci pracują przez WebFetch (restaurantguru.com, lublininfo sitemap, Glovo). Instagram, Pyszne, Wolt blokują fetch.
- **Instagram przekierowuje każde anonimowe wejście do logowania** (także nieistniejące profile) — istnienia
  handle'i nie da się sprawdzić fetchem. **Działa za to WebSearch `site:instagram.com <handle> <miasto>`** — tytuł
  wyniku „Nazwa (@handle) • Instagram” z liczbą obserwujących potwierdza profil (tak zweryfikowano partię 2026-10-05).
  Drugie źródło: `curl` strony własnej lokalu i grep `instagram.com/`. Bezpiecznik w Sztabie: „Wyślij DM” otwiera profil; nieistniejący → „Usuń”.
- Agenci Opus czasem piszą hooki **bez polskich znaków** — sprawdzać (`[ąćęłńóśźż]`) i poprawiać `popraw-hooki.ts`.
- Kopiowanie do schowka w Sztabie musi być synchroniczne PRZED `window.open` (nowa karta zabiera fokus).
- Cache Vercela dla strony: po pushu sprawdzić, czy nowa wersja jest na żywo; jeśli nie — `npx vercel --prod`.
- PowerShell w narzędziu: kasowanie plików ze skryptu `.ps1` (inline `Remove-Item` bywa blokowane);
  wieloliniowy commit → `git commit -F plik`; `Get-Content -Encoding utf8`; skrypty `tsx` uruchamiać z folderu projektu.
- W wysyłce DM: pierwsza wiadomość bez linku, maks. 30–40 dziennie z konta, follow-up po 3 dniach (Sztab robi to sam).
