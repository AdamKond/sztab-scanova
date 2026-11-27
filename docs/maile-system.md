# Maile — automatyczna zimna wysyłka (od 2026-11-17)

Cel: ~150 maili dziennie do restauracji i kawiarni, bez klikania. Cron wysyła,
czyta odpowiedzi i odbicia, a odpowiedź ląduje jako rozmowa w Rozmowach.
Ekran w Sztabie: **Maile** (`/maile`).

## 1. Jak to działa (w jednym akapicie)

Adresy siedzą w kolejce (`crm_mail_queue`, jeden wiersz = jeden adres). Co 15 min
w dni robocze 8–16 (czas Warszawy) cron woła `GET /api/cron/maile`: najpierw czyta
skrzynki przez IMAP (odpowiedzi → rozmowa w CRM, „nie” → wypisany, odbicia → odbił),
potem wysyła partię przez SMTP skrzynek z `MAIL_ACCOUNTS`. Partia = reszta
dziennego limitu podzielona na uruchomienia, które zostały do 16:00, więc maile
rozkładają się równo na cały dzień. Sekwencja na adres: mail #1 → po 3 dniach
ciszy follow-up (Re:, ten sam wątek) → po 7 dniach ostatni mail z linkiem → koniec.
Odpowiedź, odbicie albo wypisanie zatrzymuje sekwencję natychmiast.

## 2. Strategia (najlepsze praktyki cold email, zastosowane w treściach)

| Zasada | Jak u nas |
|---|---|
| Osobna domena/skrzynki do zimnych maili, nie główna | skrzynki z `MAIL_ACCOUNTS`, zalecana osobna domena (np. `scanova.pl`, `scanovatech.pl`) z SPF/DKIM/DMARC |
| 30–50 maili dziennie ze skrzynki, więcej skrzynek zamiast więcej maili | `dailyCap` per skrzynka (domyślnie 40); 150/dzień = 4 skrzynki |
| Rozgrzewka nowej domeny 2–3 tygodnie | ustawienie „Rozgrzewka od dnia”: start 20/dzień, +10 dziennie do pełnego limitu |
| Czysty tekst, bez HTML, obrazków, pikseli, bez linków w #1 | `lib/crm/mail/copy.ts`, wariant „pytanie” (domyślny) nie ma żadnego linku poza wypisaniem |
| Krótko (<100 słów), jedna myśl, pytanie o zainteresowanie zamiast prośby o spotkanie | „Czy mogę podesłać minutowy film? Wystarczy odpisać „KARTA”” |
| Temat jak od człowieka, z nazwą lokalu | rotacja 3 tematów: „pytanie o Rykowisko”, „Rykowisko i opinie w Google”, „krótkie pytanie, Rykowisko” |
| Sekwencja 3 kroków w jednym wątku, potem koniec | In-Reply-To/References z Message-ID maila #1; dzień 0 / +3 / +7 |
| Dowód społeczny i lokalność | MusiSushi, Kago Sushi; „piszę z Lublina” tylko dla lokali z okolicy |
| Jasne wyjście w każdym mailu + nagłówek List-Unsubscribe | stopka „odpiszcie „nie” albo kliknijcie: link”, One-Click (RFC 8058), `/api/mail/wypisz` |
| Jeden mail dziennie na domenę odbiorcy | plan pilnuje `domain` (sieć z 5 adresami nie dostanie 5 maili) |
| Odbicia < 3 % | adresy tylko ze stron lokali / Google Maps; filtr adresów technicznych i portali; kafelek „Odbicia” czerwienieje powyżej 3 % |
| Mierzyć odpowiedzi, nie otwarcia | kafelki: wysłane dziś, odpowiedzi i % z zaczepionych, odbicia |

**Prawo (PKE / RODO):** zimny mail z ofertą do firmy wymaga formalnie zgody. Wariant
„pytanie” jest najbezpieczniejszą praktyką rynkową (pytamy, czy możemy podesłać
materiał, nie wysyłamy oferty), piszemy wyłącznie na firmowe adresy opublikowane
przez lokal, każdy mail ma wypisanie jednym kliknięciem, a „nie” jest respektowane
na stałe. Wariant „oferta” (pełny tekst z linkiem) jest do włączenia w ustawieniach
na własną odpowiedzialność.

**Decyzja Adama 2026-11-22:** mailem #1 jest jego mail ofertowy HTML (szablon w `lib/crm/mail/templates/oferta.html`,
wysłany 2026-11-21 z Gmaila; system podmienia podpis i mailto na skrzynkę nadawczą, dokleja stopkę wypisania; tekst =
wersja alternatywna). Follow-upy (krok 2 i 3) są tekstowe, w formie „Państwo”. Wariant „pytanie” (krótki tekst) zostaje
do włączenia w ustawieniach. Szablon zmienia się edycją `.html`/`.txt` + `python3 scripts/generuj-szablon-oferty.py`.
**2026-11-25:** szablon przepisany na czysty HTML (tabele, style inline, 560 px, ok. 35 kB zamiast 190 kB z eksportu Gmaila)
i skrócone teksty wg recenzji: nagłówek „Więcej powracających klientów. Więcej opinii w Google.”, 4 wskaźniki (1 291 kart, +632 opinii,
41% powrotów, ocena 4,7→4,9), słupki z dynamiką (+174% kart, +146% opinii), adnotacja o źródle danych. Podgląd: `npx tsx` skryptem
z `renderMail(1,"oferta",…)` → plik HTML (wysyłka była wstrzymana, nic nie poszło).
**Karta w mailu wg branży (2026-11-25):** `offerCard(niche)` w `lib/crm/mail/offer.ts` podmienia obrazek, alt i podpis pod kartą.
7 kart (pizzeria, burgery, kebab, kawiarnia, cukiernia, sushi, restauracja = domyślna) leży na https://scanova.tech/assets/cards/mail/,
generator to `nowe-sekcje/karty-mail.html` w repo strony (Chrome headless 450×531, skala 2). Nowa branża = nowy wpis w `offerCard` + nowy PNG.
Karty wyglądają jak prawdziwy pass w Apple Wallet (wzór: zrzut karty CartMax od Adama, 2026-11-25): ciemna karta w kolorze branży,
nagłówek (nazwa-logo kursywą + „PIECZĄTKI x/10”), pasek z GRAFIKĄ W TLE (zabarwione, przyciemnione zdjęcie + wzór) i pieczątkami w obwódkach
(ostatnia = prezent), pole NAGRODA, duży QR. 900×1200 px. Zdjęcia w tle: `assets/strip-*.jpg` (palarnia/nami/sol nasze; pizza/burger/kebab/deser
CC0 z Openverse, źródła w `assets/strip-zrodla.json`). Powitanie „Dzień dobry” jest na górze maila, pod granatowym nagłówkiem.

## 3. Konfiguracja (jednorazowo)

1. **Migracja:** Supabase → SQL Editor → `supabase/migration-006-maile.sql` → Run.
2. **Skrzynki.** Najlepiej Google Workspace na osobnej domenie (np. 2–4 adresy
   `adam@…`, `a.kondracki@…`), każda z włączoną weryfikacją dwuetapową i
   **hasłem aplikacji** (Google: Konto → Bezpieczeństwo → Weryfikacja dwuetapowa →
   Hasła aplikacji). Na start działa też zwykły Gmail (`scanova.support@gmail.com`),
   ale z gmail.com odpowiada mniej osób i limit to ~40/dzień.
3. **DNS domeny nadawczej:** SPF (`v=spf1 include:_spf.google.com ~all`), DKIM
   (Google Admin → Gmail → Uwierzytelnianie e-mail → generuj rekord), DMARC
   (`_dmarc` TXT `v=DMARC1; p=quarantine; rua=mailto:…`). Domeny Scanovy są na DNS
   Vercela, więc rekordy dodaje się w panelu Vercela (albo `npx vercel dns add`).
4. **Zmienne na Vercelu** (`npx vercel env add <NAZWA> production`, potem redeploy):

   | Zmienna | Co |
   |---|---|
   | `MAIL_ACCOUNTS` | JSON ze skrzynkami: `[{"email":"adam@x.pl","pass":"haslo-aplikacji","name":"Adam Kondracki","dailyCap":40}]` (bez `smtp`/`imap` = Gmail/Workspace). `"onlyFollowups": true` = skrzynka tylko kończy rozpoczęte wątki, nowych maili z niej nie ma (tak jest ustawiona prywatna absolusq@gmail.com po 20 mailach z 2026-11-23) |
   | `MAIL_SECRET` | losowy ciąg ≥16 znaków (podpis linków wypisania) |
   | `CRON_SECRET` | Vercel ustawia sam przy pierwszym deployu z `crons`; jeśli nie ma, dodać losowy |
   | `MAIL_PHONE` | telefon do podpisu (opcjonalnie) |
   | `MAIL_DRY_RUN` | `1` = próba na sucho (nic nie wychodzi, dziennik jak przy wysyłce) |
   | `NEXT_PUBLIC_SZTAB_URL` | publiczny adres Sztabu (domyślnie sztab-scanova.vercel.app) |

5. **Deploy** (`git push` na `main`). Cron z `vercel.json` (`*/15 6-16 * * 1-5` UTC)
   rejestruje się sam; sprawdzić w Vercel → Settings → Cron Jobs.
6. **Test:** Maile → „Sprawdź skrzynki” (SMTP + IMAP), „Wyślij test” na własny adres,
   potem `MAIL_DRY_RUN=1` + „Uruchom teraz” i dziennik. Dopiero potem „Włącz wysyłkę”.

## 4. Skąd brać adresy (150/dzień = ~750 tygodniowo)

| Źródło | Komenda | Ile / uwagi |
|---|---|---|
| **OpenStreetMap** (darmowe, bez konta) — lokale z nazwą, stroną, czasem e-mailem | `npx tsx scripts/osm-leady.ts "Rzeszów"` | Lublin: 534 lokale, 29 z e-mailem, 76 ze stroną; serwery Overpass bywają zapchane, skrypt próbuje 3 lustra × 3 rundy |
| Strony lokali (z OSM, Restaurant Guru, Bazy) → e-mail | `npx tsx scripts/znajdz-maile.ts docs/research-2026-11/osm-rzeszow-bez-maila.csv` | ~60 % stron ma adres |
| Restaurant Guru (listing miasta → strony lokali) | `npx tsx scripts/restaurantguru-leady.ts Rzeszow --strony=30` | ~17 lokali/stronę, ale po ~10 szybkich stronach blokuje IP na kilkanaście minut (503); skrypt czeka i ponawia — uruchamiać na noc, max 1 miasto naraz |
| Google Maps przez Apify (najlepsza jakość, płatne) | `npx tsx scripts/apify-gmaps-leady.ts "Rzeszów" --max=120` | plan FREE = 5 USD/mies. (≈800 lokali), **w listopadzie 2026 kredyt wyczerpany** — od grudnia albo po przejściu na Starter 49 USD |
| Research z września | `docs/research-2026-11/kontakty-2026-09-maile.csv` | 50 adresów gotowych |
| Ręcznie | Maile → „+ Adres” / „Wklej listę” | — |

Import do kolejki: `npx tsx scripts/import-maile.ts <plik.csv> --zrodlo=gmaps --wykonaj`
(bez `--wykonaj` = podgląd). Duplikaty i adresy z czarnej listy (odbite, wypisane)
nigdy nie wchodzą drugi raz.

Kolejność miast: Lublin i okolice (tam „mogę wpaść”), potem Rzeszów, Kielce, Radom,
Warszawa, Kraków — e-mail nie wymaga dojazdu, więc cała Polska jest w zasięgu.

## 5. Codzienna obsługa (5 minut)

- **Rozmowy**: każda odpowiedź ma już rozmowę z krokiem „Odpisać i wysłać filmik”
  (gotowe odpowiedzi jak przy DM). Odpisywać z TEJ skrzynki, z której poszedł mail
  (widać w wierszu „z adam”).
- **Maile → kafelki**: „W kolejce” żółte = dosypać adresów (starczy na < 2 dni);
  „Odbicia” czerwone = lista złej jakości, zatrzymać i sprawdzić źródło.
- Odpowiedzi „nie” system wypisuje sam; nietypowe („zadzwońcie w styczniu”) trafiają
  jako odpowiedź do Rozmów — tam ustawić „Później”.

## 6. Pliki

| Plik | Co |
|---|---|
| `supabase/migration-006-maile.sql` | tabele `crm_mail_queue`, `crm_mail_events`, `crm_mail_settings` |
| `lib/crm/mail/copy.ts` | treści 3 kroków (test pilnuje: <120 słów, bez linku w #1) |
| `lib/crm/mail/plan.ts` | limity, rozgrzewka, okno godzin, podział partii, wybór skrzynki |
| `lib/crm/mail/inbox.ts` | klasyfikacja odpowiedzi / „nie” / odbić / autoodpowiedzi |
| `lib/crm/mail/run.ts` | silnik: skrzynki → wysyłka → zapis; awans odpowiedzi do CRM |
| `lib/mail/accounts.ts`, `smtp.ts`, `imap.ts`, `unsubscribe.ts` | skrzynki, SMTP (nodemailer), IMAP (imapflow), linki wypisania (HMAC) |
| `app/api/cron/maile/route.ts` | endpoint crona (Bearer `CRON_SECRET`) |
| `app/api/mail/wypisz/route.ts` | publiczna strona „nie chcę więcej” |
| `lib/crm/mail-actions.ts` | akcje ekranu Maile |
| `components/maile/*` | ekran |
| `scripts/apify-gmaps-leady.ts`, `znajdz-maile.ts`, `import-maile.ts` | zbieranie i import adresów |
| `tests/mail.test.ts` | 20 testów treści, planu, klasyfikacji, parsera |


## Audyt 2026-11-27 (przed wznowieniem wysyłki)

Stan: wysyłka WSTRZYMANA od 23.11 (`paused=true`), cron chodzi co 15 min i czyta skrzynki. Wysłano naprawdę 17 maili 23.11
(13:00–14:00 UTC) ze scanova.support@gmail.com, tematy z nazwą lokalu, 1 autoodpowiedź, 0 odpowiedzi. Produkcja: MAIL_DRY_RUN wyłączony
(w dzienniku nie ma „NA SUCHO”). Kolejka: 1424 oczekuje → po czyszczeniu 1415 (9 wstrzymanych).

Co było źle i co naprawiono (commit z 27.11):
- **Karta po branży była zawodna**: nisze z Bazy są przypisane „na oko” (piekarnia jako kebab, Thai jako sushi, trattoria jako pizzeria,
  pączkarnia jako restauracja). Teraz `offerCard(niche, name)` patrzy NAJPIERW na nazwę (pizz/burger/kebab/sushi/cukiern/kaw…),
  a nisze wloska / kebab-street food / sushi-azja bez słowa w nazwie dostają neutralną kartę restauracji.
- **„Delivery Status Notification (Delay)” liczyło się jako odbicie** → Liberty Cafe i Mangia dostały status „odbił” po samym opóźnieniu
  (potem i tak przyszły Failure). Teraz opóźnienie = wpis w dzienniku, status bez zmian.
- **Prywatna skrzynka absolusq@gmail.com (onlyFollowups)**: każdy newsletter/Twitch lądował z tematem w `crm_mail_events` (471 wpisów).
  Teraz obce maile z prywatnej skrzynki zapisują się bez nadawcy i tematu („obcy mail, pominięty”).
- Oferta: „piszemy / pokażemy” (liczba mnoga jak w podpisie „Pozdrawiamy”).
- Dane: 39 nazw poprawionych (WIELKIE LITERY, małe litery, miasto w nazwie, „Re”→„Klub Re”, „Si”→„Restauracja Si”, „3P”→„Kawiarnia 3P”),
  1 adres z „\” na końcu, 9 wierszy `wstrzymany` (adresy z Sentry, twoj@email.pl, jankowalski@mail.pl, info@mail.com, literówka .comr.pl,
  2 nazwy-slogany >40 znaków, „grky”). Odbicia bez dopasowania (Gmail nie podaje adresu w temacie) zostają w dzienniku jako „nieznany”.
- `scripts/test-mail.ts` ma `--nisza=` i `--miasto=`; 27.11 poszły 3 testy na kondracki.bartosz@gmail.com (pizzeria, kawiarnia, follow-up).

Nadal do decyzji Adama: 576 z 1441 adresów to ogólne info@/kontakt@ (normalne dla lokali), ~30 to prywatne Gmaile właścicieli
(np. rafal.grabowski00@) — piszemy tylko na adresy opublikowane przez lokal. Liczba lokali w danych o wynikach nadal niepodana.
Wznowienie: `npx tsx scripts/ustaw-maile.ts --start` (rozgrzewka liczy od 22.11, więc limit dzienny będzie już wyższy: 20 + 10/dzień, max 150).
