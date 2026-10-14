---
workflow: general-video
flow: companion
storyboard: no
message: "Karta lojalnościowa w telefonie klienta daje restauracji setki opinii w Google i klientów, którzy sami wracają"
destination: instagram-reels
aspect: 1080x1920
language: pl
audience: właściciele restauracji, kawiarni i pizzerii w Polsce (odbiorcy zimnych DM-ów na Instagramie)
length: ~75s (długość nagrania Adama)
angle: talking-head + motion graphics
---

## Intent

Filmik wysyłany lokalowi po tym, jak odpisze na DM. Adam mówi do kamery (nagranie pionowe, do podmiany
w `assets/adam.mp4`), a wokół niego grafiki ilustrują to, co mówi: wynik klienta, karta w Wallecie,
pieczątki, nagroda, powiadomienie push, zaproszenie na spotkanie. Ma „świetnie wyglądać”, dużo motion
graphics, białe naturalne napisy. Trzy wersje tego samego nagrania:

- **A `split`** — ekran podzielony: góra = grafiki o tym, co Adam mówi, dół = Adam; napisy białe.
- **B `full`** — Adam na całym ekranie, grafiki pojawiają się wokół niego.
- **C `pip`** — Adam w małym kwadracie, cały ekran w motion grafikach.

Tekst, który Adam mówi (4 plansze, `docs/filmik-1min.md` w repo Sztabu):

1. Jeden z naszych klientów w ciągu miesiąca zdobył ponad trzysta nowych opinii w Google i zbudował bazę
   prawie siedmiuset stałych klientów, którzy sami wracają. Pokażę Ci w minutę, jak to dokładnie działa.
2. Tworzymy cyfrowe karty lojalnościowe dla lokali. Klient skanuje kod QR przy kasie i karta od razu ląduje
   w jego Apple Wallet lub Google Wallet. Bez aplikacji, bez zbędnego pobierania. Za każdą wizytę dostaje
   pieczątkę, po kilku wraca po nagrodę. A po wizycie system sam prosi go o wystawienie opinii w Google.
   Stąd te setki opinii.
3. Możesz też wysłać swoim klientom powiadomienia push na telefon, na przykład „dwadzieścia procent na
   wszystko w ten weekend”. Albo system sam przypomina o lokalu: klient jest w promieniu kilometra od lokalu
   i automatycznie dostaje powiadomienie, że dziś czeka na niego specjalna promocja.
4. Jeśli chcesz zobaczyć system ustawiony pod swoją restaurację, umówimy się na krótkie spotkanie online,
   piętnaście, dwadzieścia minut. Ustalimy Twoją kolorystykę, grafikę i nagrodę. Już jutro goście w Twoim
   lokalu będą mogli dodać Twoją kartę do swojego portfela. Pierwsze czternaście dni jest za darmo, więc nie
   ryzykujesz absolutnie niczym. Wystarczy, że odpiszesz nam na tę wiadomość, że chciałbyś poznać więcej
   szczegółów albo już umówić się na spotkanie, a wyślemy Ci link do Google Meet. I tyle!

## Assets

- assets/adam.mp4 — nagranie Adama (na razie PLACEHOLDER 76 s wygenerowany ffmpegiem; podmienić na prawdziwe).
- assets/karta-wallet.png — karta Yōkai Matcha w Wallecie (punkty, „Matcha Gratis!”).
- assets/pieczatka.png — karta Yōkai Matcha, 5 z 10 pieczątek.
- assets/nagroda.png — karta sushi 10/10, nagroda „zestaw 50% taniej” (nazwa lokalu zamazana).
- assets/push.png — prawdziwe powiadomienie push na zablokowanym ekranie.
- (czeka) assets/panel.png — zrzut panelu klienta z zamazaną nazwą; na razie grafika z kafelkami.

## Customizations

- Liczby z huku jako animowane liczniki: +357 opinii, 676 klientów (prawdziwe z panelu klienta, 2026-10-13).
- Napisy słowo po słowie z transkrypcji nagrania (białe, naturalne, bez neonów).
- Scena 2: trzy telefony (karta → pieczątka → nagroda) wjeżdżają po kolei.
- Scena 3: powiadomienie push wyskakuje jak na iPhonie, do tego mapa z promieniem 1 km.
- Scena 4: zaproszenie, „14 dni za darmo”, dymek „chcę szczegóły”.
- Czasy scen zależą od nagrania: po podmianie `adam.mp4` zrobić transkrypcję i ustawić `SCENES` w `compositions/timing.js`.

## Notes

- Nazwa lokalu-klienta (MusiSushi) NIE pada ani na ekranie, ani w napisach; zrzuty mają ją zamazane.
- Paleta Scanovy jak na tablicy: papier #fcfcfa, atrament #1c1c1c, niebieski #1d5fd1, zieleń #1f8f3e, żółta karteczka #fff4a8.
- Czcionki z bundla: Montserrat (900/700) do nagłówków, Space Mono do liczb/etykiet; napisy Montserrat 700.
- 14 dni za darmo (nie miesiąc). Bez cen w filmie.
