# ManyChat → Sztab: plan podłączenia (2026-10-12)

Cel: gdy lokal odpisze na DM, ManyChat sam wysyła mu filmik i link do spotkania, a Sztab
dostaje sygnał „odpowiedział” i przenosi lokal z Bazy do Rozmów. Adam nie musi pilnować skrzynki.

Co już jest po naszej stronie (gotowe od września, sprawdzone 2026-10-12):
- webhook `POST https://sztab-scanova.vercel.app/api/inbound/ig-reply`
  body `{"instagram": "nazwa_profilu", "text": "treść odpowiedzi"}`,
  nagłówek `x-inbound-token: <INBOUND_WEBHOOK_SECRET>` (token wygenerowany na nowo 2026-10-12, jest na Vercelu
  jako zmienna „sensitive” i w `.env.local` na Macu; z Vercela nie da się go odczytać, więc jedyna kopia do
  wklejenia w ManyChacie to `.env.local`);
- robi dokładnie to, co klik „Odpowiedział?”: lokal → Rozmowy, krok „Odpisał”, treść w aktywnościach,
  kolejne wiadomości dopisują się do tej samej rozmowy; handle spoza Bazy → `{"ok":false,"unknown":true}`;
- test z terminala: `sh scripts/test-ig-reply.sh <handle>`.

**Filmik jest (2026-10-15):** rolka C (`videos/renders/rolka-scanova-c-final.mp4`). ManyChat nie wysyła plików wideo, więc
link z DM-a prowadzi na podstronę **https://scanova.tech/film** (WDROŻONA 2026-10-15; repo `scanova-tech`, `main`, plik `film.html`,
wideo `assets/media/rolka-dm.mp4`). Na stronie: filmik w ramce telefonu, 3 liczby, prawdziwe ekrany, 3 korzyści, 4 kroki,
sekcja „Umów się” (modal-lejek, zgłoszenie mailem przez formsubmit), FAQ.
Wdrożone; `NEXT_PUBLIC_FILM_URL=https://scanova.tech/film` ustawione na Vercelu Sztabu (przyciski „Odpisał → filmik” mają link).
Opcjonalnie (żeby klient sam wybierał godzinę): link do Harmonogramu spotkań Google. Jak go zrobić (Adam, 5 minut, na koncie Google Scanovy):
1. calendar.google.com → lewy górny „+ Utwórz” → „Harmonogram spotkań” (Appointment schedule).
2. Nazwa: „Scanova · spotkanie 15 min”, długość 15 min, dostępność np. pn–pt 10–18, bufor 15 min, „Google Meet” włączone.
3. Zapisz → „Udostępnij” → skopiuj link do strony rezerwacji (calendar.app.google/…). Ten link wkleić w film.html zamiast MEET_URL.
   Klient wybiera termin, obaj dostają zaproszenie z linkiem do Meet, bez Calendly i bez płacenia.

---

## Kolejność

| # | Krok | Kto | Czas |
|---|---|---|---|
| 1 | Nagrać filmik (tekst: `docs/filmik-1min.md`, tablica: `docs/tablica-scanovy.html`), wrzucić na YouTube (niepubliczny) albo Loom | Adam | 30 min |
| 2 | Link do spotkania: Google Calendar → „Harmonogram spotkań” (darmowe) albo Calendly | Adam | 10 min |
| 3 | Konto IG firmowe (typ „Firma”) połączone ze stroną na Facebooku | Adam | 10 min |
| 4 | Konto ManyChat, plan **Pro** (External Request jest tylko w Pro, ok. 15 USD/mies. przy małej liczbie kontaktów) | Adam | 10 min |
| 5 | Flow w ManyChacie wg instrukcji niżej | Adam + ja (dyktuję krok po kroku) | 20 min |
| 6 | Test: Oliwier pisze z prywatnego konta do konta firmowego → dostaje filmik, Sztab pokazuje rozmowę | obaj | 5 min |
| 7 | `NEXT_PUBLIC_FILM_URL` na Vercelu, żeby przyciski w Sztabie też miały link | ja | 2 min |

Kroki 1–2 są niezależne od ManyChata i blokują resztę. Kroki 3–4 można zrobić dziś.

---

## Krok 3: konto Instagram

1. Instagram → Ustawienia → Konto → „Przełącz na konto profesjonalne” → **Firma** (nie Twórca).
2. Ustawienia → Centrum kont → połącz ze stroną na Facebooku (jeśli nie ma strony: utwórz „Scanova”).
3. Instagram → Ustawienia → Wiadomości → „Zezwalaj na dostęp do wiadomości” = włączone
   (bez tego ManyChat nie zobaczy DM-ów).

## Krok 4: ManyChat

1. https://manychat.com → Sign up with Facebook (tym samym kontem, do którego należy strona).
2. Wybierz kanał **Instagram** → zaloguj → wybierz konto firmowe Scanovy → zaakceptuj uprawnienia.
3. Settings → Billing → **Pro**.

## Krok 5: flow „Odpowiedź na zimny DM”

Automation → New Automation → nazwa „Odpowiedź na zimny DM”.

**Wyzwalacz (Trigger):** „Instagram → User sends a message” → **Keyword** = `OFERTA` (dopasowanie „zawiera”,
bez rozróżniania wielkości liter; ManyChat bez słowa kluczowego nie wysyła automatycznych odpowiedzi na zimne DM-y).
Pierwszy DM i follow-up ze Sztabu kończą się prośbą „odpiszcie OFERTA”, więc lead sam uruchamia flow.
Kto odpisze inaczej („ok”, „chcę szczegóły”), ląduje w Live Chat; Adam wysyła wtedy ten sam tekst
przyciskiem „Odpisał → filmik” ze Sztabu.

**Krok A, Action → External Request (nasz Sztab):**
- Request type: `POST`
- URL: `https://sztab-scanova.vercel.app/api/inbound/ig-reply`
- Headers: `Content-Type: application/json` oraz `x-inbound-token: <token z .env.local, INBOUND_WEBHOOK_SECRET>`
- Body (raw JSON), zmienne wstawiasz z listy pól systemowych ManyChata:
  ```json
  {"instagram": "{{ig_username}}", "text": "{{last_text_input}}"}
  ```
  (nazwy pól w ManyChacie: „Instagram Username” i „Last Text Input”; jeśli lista pokazuje inne
  nazwy, wybierz te dwa po opisie, treść w nawiasach wstawi się sama).
- Kliknij „Test request”. Odpowiedź `{"ok":true,...}` = Sztab przyjął; `{"ok":false,"unknown":true}` =
  konta nie ma w Bazie (dla testu z konta Oliwiera to poprawny wynik).

**Krok B, Send Message (Instagram):** (wersja z 2026-10-15, strona /film ma już własne umawianie spotkań,
więc w DM-ie jest jeden link)
```
Dzięki za odpowiedź. Wszystkie szczegóły są tu: https://scanova.tech/film
Minutowy filmik, prawdziwe liczby z jednej z naszych restauracji i cennik.
Na dole jest przycisk „Umów spotkanie”: 15 minut online, ustawimy system pod Wasz lokal.
Pierwsze 14 dni za darmo. Adam
```
Tekst jest ten sam, co przycisk „Odpisał → filmik” w Sztabie (`lib/crm/dm-copy.ts`). Zgłoszenie ze strony
przychodzi mailem na scanova.support@gmail.com; Adam odsyła zaproszenie Google Meet z kalendarza.

**Krok C (opcjonalnie):** Condition → jeśli wiadomość zawiera „cena”, „ile kosztuje” → wyślij tekst
z przycisku „Ile to kosztuje?” ze Sztabu. Reszta zostaje dla Adama (Sztab → Rozmowy).

## Krok 6: test

1. Oliwier (prywatne konto IG) pisze do konta Scanovy: „ok, chętnie zobaczę”.
2. Ma dostać wiadomość z kroku B w ciągu kilku sekund.
3. ManyChat → Live Chat: widać kontakt i log External Request (status 404 = handle spoza Bazy, poprawne).
4. Żeby zobaczyć pełną ścieżkę w Sztabie: dopisać konto Oliwiera do Bazy jednym wierszem
   (`npx tsx scripts/import-leady-baza.ts plik.txt --wykonaj`) i powtórzyć. Po teście usunąć z Rozmów.

---

## Pułapki

- ManyChat odpowiada też na wiadomości **od ludzi spoza kampanii** (znajomi, klienci Scanovy). Default reply
  wysyła im filmik. Rozwiązanie: w kroku A sprawdzać odpowiedź Sztabu i wysyłać filmik tylko przy
  `ok: true` (Condition na polu odpowiedzi External Request, ManyChat pozwala zmapować `ok` do pola kontaktu).
  Na start prościej: zostawić default reply i pogodzić się, że znajomy dostanie filmik.
- Cold DM (pierwsza wiadomość do lokalu) nadal ręcznie ze Sztabu. ManyChat ani API Mety nie pozwalają
  pisać pierwszym do obcych kont; to nie zmienia się po podłączeniu.
- Meta blokuje konta za hurtowe DM-y: limit 30–40 pierwszych wiadomości dziennie zostaje.
- Token webhooka: nie wklejać do czatu ani do dokumentów. Jeśli wycieknie, zmienić na Vercelu
  (`npx vercel env rm INBOUND_WEBHOOK_SECRET production` + `add`) i w ManyChacie.
- Alternatywa bez abonamentu: własny bot na API Mety (`app/api/meta/instagram`, kod gotowy), ale wymaga
  aplikacji w developers.facebook.com i App Review (tygodnie). ManyChat omija to, bo ma własną aplikację Mety.

## Po uruchomieniu

- `docs/START.md`: zmienić notatkę „bez ManyChat” na opis tego flow.
- Sztab: przy lokalach z ManyChata w aktywności jest `Odpowiedź na IG: ...` z autorem `instagram@inbound`,
  krok „Odpisał”, akcja „Odpisać i wysłać filmik”. Skoro filmik poszedł automatem, Adam w Sztabie od razu
  przechodzi do kroku „Spotkanie”.
