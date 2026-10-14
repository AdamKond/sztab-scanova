# Filmik — tekst do nagrania (wersja 2026-10-13 wieczór: start od wyniku klienta)

Ekran = `docs/tablica-scanovy.html`, 4 plansze w kolejności poniżej (po przeglądzie spójności z DM-ami, 2026-10-14). `F` = tryb filmowy, `N` = notatki
„co mówisz” (podążają za przewijaniem). Plansza 4 ma na stałe prawdziwe liczby z panelu MusiSushi (2026-10-13); nowsze podasz w adresie
`?x=opinie&y=klienci&z=wydatki`. Całość ok. 1:35.

Mówisz „klient”, nie „gość”. Mówisz do jednej osoby („Ty”). Nie czytaj słowo w słowo.

---

## 1 · 0:00–0:15 — HUK (Ty do kamery, potem kafle i zrzut panelu)
> Jeden z naszych klientów, sieć restauracji, w ciągu miesiąca zdobył ponad trzysta nowych opinii w Google i zbudował bazę prawie siedmiuset stałych klientów, którzy sami wracają. Pokażę Ci w minutę, jak to działa.

## 2 · 0:15–0:35 — CO TO JEST (ekran: karta, pieczątka, nagroda)
> Tworzymy cyfrowe karty lojalnościowe dla lokali. Klient skanuje kod QR przy kasie i karta od razu ląduje w jego portfelu. Bez aplikacji, nic nie pobiera. Za każdą wizytę dostaje pieczątkę, po kilku wraca po nagrodę. A po wizycie system prosi go o opinię w Google, za opinię jest dodatkowa pieczątka. Stąd te setki opinii.

## 3 · 0:35–0:50 — POWIADOMIENIA (ekran: powiadomienie na telefonie)
> Możesz też wysyłać swoim klientom powiadomienia push na telefon, na przykład „dwadzieścia procent na wszystko w ten weekend”. Albo system sam przypomina o lokalu: klient jest w promieniu kilometra i automatycznie dostaje powiadomienie, że dziś masz dla niego promocję.

## 4 · 0:50–1:10 — CO DALEJ (Ty do kamery)
> Jeśli chcesz zobaczyć system ustawiony pod Twoją restaurację, umówmy się na krótkie spotkanie online, piętnaście, dwadzieścia minut. Ustawimy Twoją kolorystykę, Twoje grafiki i Twoją nagrodę.
> Pierwsze czternaście dni jest za darmo, więc nie ryzykujesz niczym. Wystarczy, że odpiszesz na tę wiadomość, że chcesz się umówić, a wyślemy Ci link do spotkania na Google Meet. Adam, Scanova. Do zobaczenia.

Prompter z tym tekstem: `docs/prompter.html`. Kalkulator zdjęty z filmu (2026-10-14), zostaje na scanova.tech/kalkulator
i w gotowej odpowiedzi „Czy to się opłaca?”.

---

## Przed nagraniem

1. Zrzuty z telefonu do `docs/zrzuty/` (nazwy w `docs/zrzuty/README.md`): `karta-wallet.png`,
   `pieczatka.png`, `nagroda.png`, `push.png`, `panel.png`. Tablica sama podmieni rysunki.
2. Zrzut panelu MusiSushi (ten, z którego są liczby) → `docs/zrzuty/panel.png`.
3. `F`, nagrywasz jednym ciągiem (Loom albo nagrywanie ekranu + kamerka).
4. Link do filmu → Vercel `NEXT_PUBLIC_FILM_URL`; ManyChat i przyciski w Sztabie wysyłają go same.

## UWAGA: 14 dni czy 30 dni

W filmiku jest „pierwsze 14 dni za darmo” (tak podyktował Adam 2026-10-13). Strona scanova.tech, DM-y
w Sztabie, maile i gotowe odpowiedzi mówią „pierwszy miesiąc / 30 dni za darmo”. Trzeba wybrać jedno
i ujednolicić, inaczej lokal usłyszy w filmie co innego niż przeczytał w DM-ie.

## Do zrobienia później

- **Druga tablica** (Adam, 2026-10-13: „później zrobimy jeszcze drugą tablicę, przypomnij mi”). Cel do ustalenia.
