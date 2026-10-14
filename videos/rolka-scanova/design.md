# Design · rolka Scanovy (9:16)

**Koncept (jedno zdanie):** tablica Scanovy ożywa obok Adama — papierowo-czysty, jasny layout z jednym
niebieskim akcentem, w którym prawdziwe ekrany z telefonu i liczby z panelu „wjeżdżają” dokładnie wtedy,
gdy Adam o nich mówi.

**Paleta (jak tablica):** papier `#fcfcfa`, atrament `#1c1c1c`, atrament miękki `#5d5d62`, niebieski `#1d5fd1`,
zieleń `#1f8f3e`, czerwień `#d2262e`, karteczka `#fff4a8`, chłodne tło pod telefon `#eef1f7`.
Wersja B (Adam na całym ekranie) używa tych samych elementów na przezroczystym tle z lekkim białym
„szkłem” (`rgba(252,252,250,.92)`) pod kartami, żeby tekst czytał się na nagraniu.

**Typografia (bundlowane):** nagłówki i liczby **Montserrat 900** (tracking −0.03em), etykiety i małe
liczby **Space Mono 700** (register „dane”), napisy **Montserrat 700** białe z miękkim cieniem.
Rozmiary pod telefon: nagłówek ≥ 7 cqw slotu, etykieta ≥ 3 cqw, napisy 52 px na 1080.

**Ogniskowa per scena:** 1 licznik `+357` → 2 telefon z kartą → 3 powiadomienie → 4 karteczka „14 dni za darmo”.
Krawędzie: etykieta sceny lewy-górny róg, logo `scanova.tech` tylko w scenie 4.

**Ruch:** wejścia `power3.out` 0.5–0.7 s, liczniki `power2.out` 1.6 s, wyjścia krótkie 0.3 s. Jeden element
na raz, pauza 0.4 s między elementami, żeby nadążał za głosem. Bez nieskończonych pętli.
