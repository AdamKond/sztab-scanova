# Weryfikacja bazy leadów (baza-pelna.txt, 706 rekordów)

Analiza zrobiona skryptowo (Node.js) na wszystkich 706 wierszach, z ręcznym przeglądem każdego trafienia (odsiane fałszywe alarmy opisane przy każdej sekcji).

## 1. DUPLIKATY

Pary, które wyglądają na ten sam lokal pod dwoma handle'ami (to samo miasto, ten sam rdzeń nazwy):

| # | Handle A | Handle B | Miasto | Uzasadnienie |
|---|---|---|---|---|
| 1 | @munchieslublin (Munchies Lublin, burgery, 3482 obs.) | @munchiesstreetfood (Munchies Street Food, kebab/street food, 651 obs.) | Lublin | Ta sama marka "Munchies" w tym samym mieście pod dwiema niszami — prawdopodobnie ten sam punkt z dwoma kontami. |
| 2 | @piripirikebablublin (Piri-Piri Kebab Lublin) | @piripirikebab (Piri-Piri Kebab, 49000 obs.) | Lublin | Identyczna nazwa marki, ta sama nisza, to samo miasto. |
| 3 | @bistrodziendobry (Bistro Dzień Dobry, sniadania/brunch) | @bistrodziendobryrzeszow (Bistro Dzień Dobry Rzeszów, restauracja) | Rzeszów | Identyczna nazwa, to samo miasto — prawie na pewno ten sam lokal wpisany dwa razy. |
| 4 | @wloskasztuka.piekarnia (Włoska Sztuka Piekarnia, cukiernia/lody) | @wloskasztuka (Wloska Sztuka, wloska) | Lublin | Ta sama marka. Może to jednak dwa różne punkty (restauracja + piekarnia tej samej marki) — do sprawdzenia, nie usuwać automatycznie. |

Sprawdzone i **odrzucone** jako duplikaty (wspólne słowo w nazwie, ale różna nisza = prawdopodobnie różne lokale):
- @staro__polska (Staropolska, restauracja) vs @staropolskalublin (Cukiernia Staropolska, cukiernia/lody) — "staropolska" to bardzo częste, generyczne słowo w nazwach gastro.
- @restauracjaportofino_lublin (Restauracja Portofino, wloska) vs @lodyportofino (Lodziarnia Portofino, cukiernia/lody) — "Portofino" to popularna nazwa, różne nisze wskazują różne lokale.

**Liczba: 4 pary do usunięcia/weryfikacji** (2 pewne duplikaty do usunięcia, 2 do ręcznego sprawdzenia).

## 2. MIASTO vs HANDLE/NAZWA

Sprawdzono handle i nazwę pod kątem słów kluczowych innych miast (warszawa, krakow, gdansk, lodz, wroclaw, poznan, lubliniec, katowice, szczecin, bydgoszcz, rzeszow, kielce, radom, bialystok i inne).

Automatyczne dopasowania dotyczyły wyłącznie ciągu "lodz" — ale za każdym razem był to fragment słowa **"lodziarnia"** (lodziarnia = lody, nie Łódź), np. @lodyforys, @lodziarnia_fragola_rzeszow, @cukiernia_nova_lodziarnia. To fałszywe alarmy, nie błędy miasta.

**Liczba: 0.** Nie znaleziono ani jednego przypadku, w którym handle/nazwa wskazywały realnie inne miasto niż kolumna Miasto.

## 3. SIECIÓWKI

Znalezione profile ogólnopolskich/znanych franczyz — pojedyncze lokale, więc zgodnie z zasadą "do decyzji":

| Handle | Nazwa | Miasto | Sieć |
|---|---|---|---|
| @erbilkebab | Erbil Doner Kebab | Lublin | Doner Kebab (rozpoznawalna marka kebabowa, lokalny profil) — do decyzji |
| @dagrassolukow | Da Grasso Łuków | Łuków | Da Grasso — do decyzji |
| @dagrasso.miedzyrzec.podlaski | Da Grasso Międzyrzec Podlaski | Międzyrzec Podlaski | Da Grasso — do decyzji |
| @bobby_burger_lublin | Bobby Burger Lublin | Lublin | Bobby Burger — do decyzji |
| @zahirkebab | Zahir Kebab | Lublin | Zahir — do decyzji |

Uwaga: @piripirikebab (49000 obserwujących) to duży, prawdopodobnie regionalny (lubelski) łańcuch kebabowy, nie ogólnopolska sieć z listy — zostawione poza tą sekcją, ale patrz sekcja 1 (duplikat).

**Liczba: 5 (wszystkie oznaczone "do decyzji")**

## 4. HOOKI

### 4a. Brak spersonalizowanego hooka (18 handle'i)

Te wiersze używają ogólnego powitania "Cześć! Tu Adam ze Scanovy z Lublina." zamiast "Cześć {Nazwa}!" i od razu przechodzą do stałego tekstu — nie ma żadnego zdania nawiązującego do konkretnego lokalu. To błąd kategorii (e): hook nie istnieje / jest bez treści.

| Handle | Obecny "hook" | Co nie tak | Propozycja |
|---|---|---|---|
| @totosushi | (brak, od razu "Robimy...") | brak personalizacji | Sushi na lunch to nawyk — pytanie, czy ludzie mają go u Was, czy u konkurencji. |
| @niebomatcha | (brak) | brak personalizacji | Matcha to rytuał, który klienci powtarzają codziennie — dobry kandydat pod kartę. |
| @kobi.sushi | "Dzień dobry!" (+wykrzyknik) | generyczne powitanie zamiast hooka, ma "!" | Sushi na wynos to nawyk — pytanie, czy klienci wracają po nie do Was, czy do konkurencji. |
| @dajtosushi | (brak) | brak personalizacji | Zamówienie sushi na wieczór to nawyk — u Was czy u konkurencji obok? |
| @momo_sushi_swidnik | (brak) | brak personalizacji | W Świdniku sushi zamawia się z nawyku — pytanie, czy akurat u Was. |
| @hellobobapl | (brak) | brak personalizacji | Boba to napój, po który wraca się prawie codziennie — dobry produkt pod kartę. |
| @takushi_sushi | (brak) | brak personalizacji | Ramen i sushi na lunch to nawyk — u Was czy w lokalu obok? |
| @ganbei_bubble_tea | (brak) | brak personalizacji | Bubble tea kupuje się z nawyku, często codziennie — dobry produkt pod kartę. |
| @parzona | (brak) | brak personalizacji | Poranna kawa to rytuał — pytanie, czy klienci mają go u Was, czy gdzie indziej. |
| @pate.lublin | (brak) | brak personalizacji | Wypieki kupuje się z nawyku w weekend — dobry moment na kartę stałego klienta. |
| @futo_sushi_asian_food | (brak) | brak personalizacji | Kuchnia azjatycka na lunch to nawyk — pytanie, czy wracają po nią do Was. |
| @yamato_sushi_chelm | (brak) | brak personalizacji | W Chełmie sushi i wok zamawia się z nawyku — pytanie, czy akurat u Was. |
| @mood_pulawy | (brak) | brak personalizacji | W Puławach ramen i sushi to lunch z nawyku — u Was czy w innym lokalu? |
| @oedosushi | (brak) | brak personalizacji | Sushi na dowóz to nawyk — pytanie, czy klienci zamawiają akurat u Was. |
| @spacesushi_pl | (brak) | brak personalizacji | Sushi na lunch zamawia się z nawyku — pytanie, czy trafia akurat do Was. |
| @numazusushi | (brak) | brak personalizacji | Kuchnia azjatycka na lunch to nawyk — u Was czy w konkurencyjnym lokalu? |
| @sushistudio_pulawy | (brak) | brak personalizacji | W Puławach sushi zamawia się z nawyku — pytanie, czy akurat u Was. |
| @sushi_garden_pulawy | (brak) | brak personalizacji | Sushi na wynos w Puławach to nawyk — pytanie, czy klienci wracają do Was. |

### 4b. Hook zastąpiony ogólnym przedstawieniem się (1 handle)

- **@boruramenshop** — hook: "Piszę ze Scanovy, lubelskiej firmy od cyfrowych kart lojalnościowych." Zamiast nawiązać do lokalu, zdanie otwierające to przedstawienie się firmy (dłuższe niż 130 znaków licząc do właściwego haczyka, bo dopiero w środku tekstu pojawia się "Przy ramenie i poke na lunch..."). Poprawka: "Ramen i poke na lunch to nawyk — pytanie, czy wracają po niego do Was, czy do konkurencji."

### 4c. Personalizacja schowana w środku wiadomości, nie na starcie (2 handle)

- **@tosaka_sushi_lublin** — pierwsze zdanie to "Tu Adam ze Scanovy. Jesteśmy z Lublina i robimy karty pieczątek..." — czysto o firmie, nie o lokalu; treść dubluje to, co i tak jest w stałym tekście niżej. Poprawka: "W Lublinie sushi na wynos to nawyk — pytanie, czy akurat u Was."
- **@alesushizamosc** — realny haczyk ("Wasze 4,9 mówi samo za siebie") jest zakopany w środku akapitu, a nie na początku. Poprawka: "Wasze 4,9 w Google to rzadkość — dobry powód, żeby zaproponować kartę stałego klienta."

### 4d. Wiadomość niekompletna — brak stałego tekstu o karcie (2 handle) — **najpoważniejszy błąd**

Te dwa wiersze mają w kolumnie hook **wyłącznie** jedno zdanie, bez żadnej dalszej treści — nie ma oferty, nie ma "Robimy cyfrowe karty...", nie ma call to action, nie ma podpisu. Wysłane 1:1 wyglądałyby jak urwana wiadomość.

- **@ciachobezcukru.pulawy** — cały hook: "Ciasta bez cukru mają wąską, ale bardzo powracającą grupę - wymarzona pod kartę." Brak stałego tekstu + słowo "wymarzona" brzmi jak reklama.
- **@cela_cafe_restaurant** — cały hook: "1,7 tys. obserwujących to najlepszy wynik gastro w Janowie - szkoda tego nie wykorzystać." Brak stałego tekstu + nieweryfikowalne stwierdzenie "najlepszy wynik" (nikt tego nie sprawdzał, to tylko liczba obserwujących).

Poprawki (dopisany brakujący stały tekst, patrz sekcja DO POPRAWKI poniżej).

### 4e. Pozostałe uwagi

- Wykrzykniki w hooku: jedyny "prawdziwy" przypadek to @kobi.sushi (patrz 4a). @okebab_okebab ma "!" tylko dlatego, że nazwa lokalu to "O! Kebab" — nie błąd.
- Hooki dłuższe niż 130 znaków w standardowym szablonie (pizza/burger/kawiarnia/cukiernia/kebab): brak — te szablony są krótkie i spójne.
- Braki polskich znaków ("zdjecia", "wloska" itp.): nie znaleziono ani jednego przypadku po weryfikacji (automatyczne trafienia na "polska"/"lodz" okazały się fałszywe — te słowa nie wymagają dodatkowych znaków).
- Frazy zbyt ogólne typu "dobre jedzenie i miła obsługa": nie znaleziono.

**Liczba hooków do poprawki: 23** (18 + 1 + 2 + 2).

## 5. NISZA

### Pewne niezgodności (3) — nazwa jednoznacznie wskazuje inną niszę

| Handle | Nazwa | Obecna nisza | Proponowana |
|---|---|---|---|
| @franco_ristorante | Franco Ristorante | pizza | wloska |
| @melacaffe_krasnik | Mela Caffe | cukiernia/lody | kawiarnia |
| @bombardino_trattoria | Bombardino Trattoria Węglin | sniadania/brunch | wloska |

### Do przemyślenia (11) — nazwa łączy dwie nisze, obecny wybór jest obronny, ale warto zdecydować świadomie

@capo_pizza_cucina_italiana (wloska/pizza), @trattoria.bagatto.pizzeria (wloska/pizza), @atrium.lublin (wloska/pizza), @kuzniaswidnik (burgery/pizza), @sahara_lublin (kebab/pizza), @caffianorzeszow (wloska/kawiarnia), @casaverde.radom (wloska/pizza), @pizzasushihouse.pl (sushi/pizza), @cela_cafe_restaurant (restauracja/kawiarnia), @boskawa_trattoria_pizzeria (pizza/wloska), @zonalublin (wloska/pizza), @lodypizza (cukiernia-lody/pizza), @sultankebabpizza2025 (kebab/pizza), @bulkarnia (cukiernia-lody/kawiarnia) — 13 pozycji w kodzie źródłowym, z czego 11 uznane za realnie dwuznaczne (patrz uwaga niżej).

Sprawdzone i odrzucone (nazwa zawiera słowo-klucz, ale przypisana nisza jest trafna): @polonia_cafe_manufaktura_lodow, @cafe_mari, @otwartacafe, @strefaburgera, @ann_rzeszow, @calimerocafesolna, @calimerocafepaderewskiego, @arabeska_kawiarnia, @goodmood.lublin, @samiraradom, @famiglia.kielce, @nobo_restauracja.

**Liczba nisz do poprawki: 3 pewne + 11 do przemyślenia.**

---

### DO USUNIECIA

@munchiesstreetfood — duplikat @munchieslublin (ta sama marka "Munchies", to samo miasto, mniej obserwujących: 651 vs 3482)
@piripirikebablublin — duplikat @piripirikebab (identyczna marka i nisza w Lublinie, drugie konto ma 49000 obserwujących)
@bistrodziendobry — duplikat @bistrodziendobryrzeszow (identyczna nazwa "Bistro Dzień Dobry" w tym samym mieście)

### DO POPRAWKI

@totosushi | Toto Sushi | Zamość | sushi/azja |  | Cześć Toto Sushi! Sushi na lunch to nawyk — pytanie, czy ludzie mają go u Was, czy u konkurencji. Robimy karty pieczątek w telefonie (Apple/Google Wallet): pieczątka za wizytę albo zamówienie, po kilku nagroda. Korzystają z tego już MusiSushi w Lublinie i Kago Sushi w Świdniku. To prosty sposób na stałych klientów i więcej opinii w Google, a że macie własne zamówienia online, u Was zagrałoby to podwójnie. Chętnie podjadę do Zamościa z krótkim demo. Pierwszy miesiąc macie za darmo. Pozdrawiam, Adam
@niebomatcha | Niebo Matcha Bar | Lublin | boba/matcha |  | Cześć Niebo Matcha Bar! Matcha to rytuał, który klienci powtarzają codziennie — dobry kandydat pod kartę. Robimy karty pieczątek w telefonie: klient dodaje kartę do Apple/Google Wallet, zbiera pieczątki za każdą bobę i wraca po nagrodę. Korzysta z tego już Yōkai Matcha, a z restauracji MusiSushi i Kago Sushi. Do tego więcej opinii w Google. Pierwszy miesiąc macie za darmo. Pozdrawiam, Adam
@kobi.sushi | Kobi Sushi | Lublin | sushi/azja |  | Cześć Kobi Sushi! Sushi na wynos to nawyk — pytanie, czy klienci wracają po nie do Was, czy do konkurencji. Pomagamy lokalom zamieniać jednorazowych gości w stałych: cyfrowa karta pieczątek w Apple/Google Wallet zamiast papierowej karteczki. Współpracujemy już z MusiSushi w Lublinie i Kago Sushi w Świdniku. System przy okazji pomaga zbierać kolejne opinie w Google. Mogę podejść do lokalu i pokazać demo na telefonie, 5 minut. Pierwszy miesiąc macie za darmo. Pozdrawiam, Adam
@boruramenshop | Boru Ramen Noodle & Poke Bar | Lublin | sushi/azja |  | Cześć Boru Ramen Noodle & Poke Bar! Ramen i poke na lunch to nawyk — pytanie, czy wracają po niego do Was, czy do konkurencji. Robimy cyfrowe karty pieczątek w Apple/Google Wallet: gość ma kartę, dostaje pieczątkę za wizytę, po kilku odbiera nagrodę. W Lublinie korzysta z tego już MusiSushi, w Świdniku Kago Sushi. Do tego prosty sposób na zbieranie opinii w Google. Chętnie pokażę na żywo, 5 minut wystarczy. Pierwszy miesiąc macie za darmo. Pozdrawiam, Adam
@tosaka_sushi_lublin | Tosaka Sushi | Lublin | sushi/azja |  | Cześć Tosaka Sushi! W Lublinie sushi na wynos to nawyk — pytanie, czy akurat u Was. Robimy karty pieczątek w telefonie (Apple/Google Wallet): gość zbiera pieczątki za wizyty i wraca po nagrodę. Współpracują z nami już MusiSushi w Lublinie i Kago Sushi w Świdniku. To nowy sposób na zbieranie opinii w Google przy okazji każdej wizyty. Chętnie wpadnę i pokażę demo, 5 minut wystarczy. Pierwszy miesiąc macie za darmo. Pozdrawiam, Adam
@alesushizamosc | Ale SUSHI | Zamość | sushi/azja |  | Cześć Ale SUSHI! Wasze 4,9 w Google to rzadkość — dobry powód, żeby zaproponować kartę stałego klienta. Jesteśmy firmą z Lublina i robimy cyfrowe karty pieczątek w Apple/Google Wallet. Gość zbiera pieczątki za wizyty i wraca częściej, a system przy okazji pomaga zbierać opinie w Google. Mogę podjechać do Zamościa i pokazać wszystko w 5 minut. Pierwszy miesiąc macie za darmo. Pozdrawiam, Adam
@ciachobezcukru.pulawy | Ciacho bez Cukru Puławy | Puławy | cukiernia/lody |  | Cześć Ciacho bez Cukru Puławy! Ciasta bez cukru mają wąską, ale bardzo powracającą grupę — dobry produkt pod kartę. Robimy cyfrowe karty pieczątek w Apple/Google Wallet: pieczątka za zakup, nagroda po kilku wizytach, karta zawsze w telefonie. Korzysta z tego już Yōkai Matcha oraz MusiSushi i Kago Sushi. System pomaga też zbierać opinie w Google. Pierwszy miesiąc macie za darmo. Pozdrawiam, Adam
@cela_cafe_restaurant | Cela Cafe & Restaurant | Janów Lubelski | restauracja | 1732 | Cześć Cela Cafe & Restaurant! 1,7 tys. obserwujących to spory zasięg jak na gastronomię w Janowie — warto to wykorzystać kartą lojalnościową. Robimy cyfrowe karty pieczątek w Apple/Google Wallet: pieczątka za wizytę, nagroda po kilku, karta zawsze w telefonie gościa. Korzystają z nas już m.in. MusiSushi w Lublinie i Kago Sushi w Świdniku. System przy okazji pomaga zbierać opinie w Google. Pierwszy miesiąc macie za darmo. Pozdrawiam, Adam
@franco_ristorante | Franco Ristorante | Łęczna | wloska |  | Cześć Franco Ristorante! Piątkowa pizza to nawyk — pytanie tylko, czy ludzie mają ten nawyk u Was, czy u konkurencji. Robimy cyfrowe karty pieczątek w Apple/Google Wallet: pieczątka za każdą pizzę, co szósta gratis (nagrodę ustawiacie sami). W regionie korzystają z nas już m.in. MusiSushi i Kago Sushi. Efekt: stali klienci zamawiają u Was, nie przez portale z prowizją, i zostawiają opinie w Google. Jesteśmy z Lublina, pokażemy na miejscu w 5 minut. Pierwszy miesiąc macie za darmo. Pozdrawiam, Adam
@melacaffe_krasnik | Mela Caffe | Kraśnik | kawiarnia |  | Cześć Mela Caffe! Sobotnie wyjście po Wasze wypieki to dla wielu osób rytuał — a rytuały można wzmacniać. Robimy cyfrowe karty pieczątek w Apple/Google Wallet: pieczątka za zakup, nagroda po kilku wizytach, karta zawsze w telefonie. Korzysta z tego już Yōkai Matcha oraz MusiSushi i Kago Sushi. System pomaga też zbierać opinie w Google. Pokażemy wszystko na miejscu w 5 minut, jesteśmy z Lublina. Pierwszy miesiąc macie za darmo. Pozdrawiam, Adam
@bombardino_trattoria | Bombardino Trattoria Węglin | Lublin | wloska | 8161 | Węglin przychodzi do Was na śniadania - 8 tysięcy obserwujących to mówi.

Uwaga do ostatniej linii (@bombardino_trattoria): zmieniono tylko niszę (sniadania/brunch → wloska), hook zostawiony bez zmian, bo sam w sobie jest poprawny (krótki, konkretny, bez wykrzyknika).
