# Filmik — tekst do nagrania (wersja 2026-10-13, po uwagach Adama)

Ekran = `docs/tablica-scanovy.html`, 7 plansz w kolejności poniżej. `F` = tryb filmowy, `N` = notatki
„co mówisz” (podążają za przewijaniem). Prawdziwe liczby do planszy 4 podajesz w adresie:
`tablica-scanovy.html?film=1&x=350&y=200&z=100` (x = opinie, y = powroty, z = po powiadomieniu).
Bez nich plansza pokazuje wersję bezpieczną. Całość ok. 1:35.

Mówisz „klient”, nie „gość”. Mówisz do jednej osoby („Ty”). Nie czytaj słowo w słowo.

---

## 1 · 0:00–0:10 — HUK (Ty do kamery)
> Czy wiesz, że Twoja restauracja w trzydzieści dni może zdobyć ponad sto opinii w Google,
> zwiększyć obrót i zbudować bazę klientów, którzy sami wracają? Tak, i pokażę Ci to w minutę.

## 2 · 0:10–0:25 — CO TO JEST (ekran: trzy zrzuty z telefonu: karta, pieczątka, nagroda)
> Tworzymy cyfrowe karty lojalnościowe dla lokali. Klient przychodzi, skanuje kod przy kasie
> i karta jest w jego Wallecie. Bez aplikacji, nic nie pobiera. Potem za każdą wizytę dostaje
> pieczątkę i po kilku wraca po nagrodę.

## 3 · 0:25–0:40 — TWÓJ KANAŁ (ekran: powiadomienie na telefonie)
> Masz też bezpośredni kontakt ze swoimi klientami. Wysyłasz im powiadomienia push na telefon,
> na przykład „dziś druga pizza za pół ceny”. Albo system sam przypomina o lokalu, gdy klient
> jest w promieniu dwóch kilometrów od niego. W Polsce na razie mało restauracji ma takie
> rozwiązanie, ale z miesiąca na miesiąc przybywa ich więcej.

## 4 · 0:40–0:55 — LICZBY (ekran: panel „Kto wraca”)
> Liczby z naszych lokali, MusiSushi i Kago Sushi, z trzydziestu dni: [X] nowych opinii w Google,
> [Y] klientów wróciło po kolejną pieczątkę, [Z] przyszło po jednym powiadomieniu. Wszystko to
> widzisz w panelu.

Tylko prawdziwe liczby z panelu. Bez nich wersja bezpieczna:
> U naszych klientów przybywa do dwustu opinii miesięcznie, a klienci z kartą wracają o jedną
> czwartą częściej. Wszystko widzisz w panelu.

## 5 · 0:55–1:10 — ILE TO DAJE (ekran: kalkulator, pizzeria, 40 klientów, 45 zł)
> Policzmy. Czterdziestu klientów dziennie, rachunek czterdzieści pięć złotych, co czwarty z kartą
> wraca częściej. Żeby plan był za darmo, wystarczą dwie dodatkowe wizyty dziennie. A w skali roku
> zostaje w lokalu około piętnastu tysięcy złotych. I to bez liczenia nowych klientów z opinii.

Kalkulator pokazuje przy tych liczbach: +1 244 zł miesięcznie, +14 922 zł rocznie. Kliknij branżę
rozmówcy przed nagraniem, jeśli nagrywasz pod konkretny lokal.

## 6 · 1:10–1:20 — JAK TO WYGLĄDA (ekran: oś czasu)
> Pierwszego dnia ustawiamy kartę w Twoich kolorach i przywozimy stojak. W pierwszym tygodniu są
> pierwsze karty i opinie, w drugim pierwsze powroty po nagrodę. Po czternastu dniach patrzysz
> w panel i decydujesz. Bez umowy, nic nie instalujesz.

## 7 · 1:20–1:35 — CO DALEJ (Ty do kamery)
> Jeśli chcesz zobaczyć cały system, umówmy się na krótkie spotkanie online, piętnaście, dwadzieścia
> minut. Pokażę Ci, jak działa, jak klienci dodają karty, i ustawimy go pod Twoją restaurację, pod
> Twoje kolory. Pierwsze czternaście dni jest za darmo, więc nic nie ryzykujesz. Wystarczy, że
> odpiszesz na tę wiadomość, a wyślę Ci link do spotkania na Google Meet. Adam, Scanova. Do zobaczenia.

---

## Przed nagraniem

1. Zrzuty z telefonu do `docs/zrzuty/` (nazwy w `docs/zrzuty/README.md`): `karta-wallet.png`,
   `pieczatka.png`, `nagroda.png`, `push.png`, `panel.png`. Tablica sama podmieni rysunki.
2. Trzy prawdziwe liczby z panelu MusiSushi lub Kago z ostatnich 30 dni → do adresu `?x=&y=&z=`.
3. `F`, nagrywasz jednym ciągiem (Loom albo nagrywanie ekranu + kamerka).
4. Link do filmu → Vercel `NEXT_PUBLIC_FILM_URL`; ManyChat i przyciski w Sztabie wysyłają go same.

## UWAGA: 14 dni czy 30 dni

W filmiku jest „pierwsze 14 dni za darmo” (tak podyktował Adam 2026-10-13). Strona scanova.tech, DM-y
w Sztabie, maile i gotowe odpowiedzi mówią „pierwszy miesiąc / 30 dni za darmo”. Trzeba wybrać jedno
i ujednolicić, inaczej lokal usłyszy w filmie co innego niż przeczytał w DM-ie.
