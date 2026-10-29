# Zimny mail do lokalu — szablony (aktualizacja 2026-10-29)

Zasady: krótko (właściciel czyta na telefonie między zamówieniami), jedna obietnica,
jeden link, jedno pytanie. Od 2026-10-21 zaczynamy od opinii w Google (tak jak zimny DM,
`COLD_DM` w `lib/crm/dm-copy.ts`) i prosimy o odpisanie słowem **„KARTA”** — jedno słowo
kluczowe we wszystkich kanałach. Temat bez „oferty” i „współpracy” — to trafia do kosza.
Wysyłać z Waszego imiennego adresu, nie z „kontakt@”. Maks. 30–40 dziennie, ręcznie
albo z prostego narzędzia (Gmail + szablon). Follow-up po 4 dniach, potem koniec.
Pisać wyłącznie na firmowe adresy opublikowane przez lokal (RODO / PKE).

## Wariant C — ze stroną scanova.tech/restauracje (od 2026-10-29, domyślny do masowej wysyłki)

Zamiast długiego maila: krótki tekst i jeden przycisk na stronę, która „jest mailem” —
film 76 s, jak to działa, liczby z panelu restauracji, podgląd karty w barwach lokalu,
„jak zaczynamy” (3 dni), kalkulator, cennik, umawianie spotkania. Strona to `restauracje.html`
w repo strony (kopia `/film` pod zimnego odbiorcę z maila: powitanie, odpowiedź słowem „KARTA”
zamiast Instagrama, FAQ „dlaczego piszecie”).

**Link personalizujemy parametrami:** `https://scanova.tech/restauracje?l=Nazwa%20lokalu&b=pizzeria`
- `l` = nazwa lokalu (powitanie „Dzień dobry, Nazwa!”, karta w podglądzie, formularze wypełnione),
- `b` = `kawiarnia` · `pizzeria` · `burgery` · `sushi` · `cukiernia` · `kebab` (ustawia kalkulator),
- `t` = `restauracja` · `klub` · `beauty` · `male` (ustawia cennik; domyślnie restauracja).

**Wersja HTML do wklejenia w Gmaila:** `mail-restauracje.html` w repo strony
(https://scanova.tech/mail-restauracje → Cmd+A, Cmd+C, wkleić; podmienić [NAZWA LOKALU], link i [telefon]).

**Temat:** Nawet 200 nowych opinii w Google miesięcznie

Dzień dobry,

zbieramy restauracjom nawet 200 nowych opinii w Google miesięcznie.

Robimy cyfrowe karty lojalnościowe: gość dodaje kartę [NAZWA LOKALU] do Apple lub Google Wallet,
bez żadnej aplikacji, zbiera pieczątki za wizyty i wraca po nagrodę. Wy widzicie, kto wraca,
a system sam prosi zadowolonych gości o opinię w Google. Korzystają już z tego m.in. MusiSushi i Kago Sushi.

Jak to działa, ile dało jednej z restauracji i ile kosztuje, jest na jednej stronie, razem
z minutowym filmem: https://scanova.tech/restauracje?l=[Nazwa]&b=[branża]

Pierwsze 14 dni są za darmo, dla każdej lokalizacji, bez umowy na czas określony.
Ustawiamy wszystko w 1–3 dni, Wy nic nie instalujecie.

Chcecie poznać szczegóły? Odpiszcie jednym słowem „KARTA”, a podeślę więcej informacji.
Mogę też wpaść na 5 minut i pokazać wszystko na Waszym telefonie.

Pozdrawiam,
Adam Kondracki
SCANOVA · Lublin · [telefon]

## Wariant A — obietnica (poprzedni domyślny, bez strony)

**Temat:** Nawet 200 nowych opinii w Google miesięcznie

Dzień dobry,

zbieramy restauracjom nawet 200 nowych opinii w Google miesięcznie.

Robimy cyfrowe karty lojalnościowe: gość dodaje Waszą kartę do Apple lub Google Wallet,
bez aplikacji, zbiera pieczątki za wizyty i wraca po nagrodę. Wy widzicie, kto wraca,
a system sam prosi zadowolonych gości o opinię w Google. Korzystają już z tego m.in. MusiSushi i Kago Sushi.

Dla każdej lokalizacji pierwsze 14 dni są testowe i za darmo, bez umowy na czas
określony. Policzyłem to na liczbach podobnego lokalu: scanova.tech/kalkulator?b=[branża]

Chcecie poznać szczegóły? Odpiszcie jednym słowem „KARTA”, a podeślę więcej informacji
i minutowy filmik. Mogę też wpaść na 5 minut i pokazać na Waszym telefonie.

Pozdrawiam,
Adam Kondracki
SCANOVA · Lublin · [telefon]

## Wariant B — liczby (dla lokali z dużym ruchem)

**Temat:** Nawet 200 opinii w Google i 2 dodatkowe wizyty dziennie

Dzień dobry,

u jednej z naszych sieci system zbiera nawet 200 nowych opinii w Google miesięcznie.

Działa przez kartę lojalnościową w telefonie gościa, w Apple lub Google Wallet, bez aplikacji.
Goście z kartą wracają o ok. 25% częściej, a system przy okazji prosi zadowolonych o opinię.
Żeby program sam się finansował, wystarczą u Was 2 dodatkowe wizyty dziennie.
Policzyłem to tutaj: scanova.tech/kalkulator?b=[branża]

Pierwsze 14 dni za darmo, ustawiamy wszystko w 1–3 dni, Wy nic nie instalujecie.

Chcecie zobaczyć, ilu gości u Was wraca? Odpiszcie jednym słowem „KARTA”, a wyślę minutowy filmik.

Pozdrawiam,
Adam Kondracki
SCANOVA · Lublin · [telefon]

## Follow-up po 4 dniach (odpowiedź na własny mail)

**Temat:** Re: [poprzedni temat]

Dzień dobry,

jeszcze raz krótko: nasz system zbiera restauracjom nawet 200 nowych opinii w Google
miesięcznie, a goście wracają po pieczątki w karcie, którą mają w telefonie. Pierwsze
14 dni są testowe i za darmo. Jeśli temat nie gra, dajcie znać, nie będę pisać więcej.
Jeśli gra, odpiszcie jednym słowem „KARTA”, a wyślę minutowy filmik.

Pozdrawiam,
Adam

## Po odpowiedzi

Te same gotowe odpowiedzi co w Sztabie (rozmowa → „Gotowe odpowiedzi”): filmik,
„ile kosztuje” (od 250 zł, z opiniami 339 zł), „czy to się opłaca” (kalkulator),
umawiam wizytę, po demo → 14 dni testowych.

## Parametry linku do kalkulatora

`scanova.tech/kalkulator?b=kawiarnia` · `pizzeria` · `burgery` · `sushi` · `cukiernia` · `kebab`
Z własnymi liczbami lokalu: `?g=gości/dzień&r=rachunek&m=marża&plan=339`.
