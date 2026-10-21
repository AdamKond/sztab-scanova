// Teksty wiadomości: jeden wspólny zimny DM, follow-up po ciszy i gotowe
// odpowiedzi na typowe reakcje. Czysty moduł bez dostępu do bazy — używa go
// serwer (kolejka na Dziś) i klient (kopiowanie do schowka).
//
// Decyzja Adama z 2026-10-21: KONIEC z personalizacją pierwszego DM-a. Wszyscy
// dostają ten sam tekst (łatwiej wysyłać masowo, nie trzeba researchu pod hook).
// Szkielet: hook = opinie w Google (nawet 200 miesięcznie) → co robimy (cyfrowa
// karta w Apple/Google Wallet, pieczątki za wizyty) → kto wraca i skąd opinie
// → dowód (nasi klienci) → 14 dni testowych za darmo dla każdej lokalizacji →
// pytanie i słowo kluczowe „KARTA” w cudzysłowie, bo to ono uruchamia ManyChata.
// Bez linku w pierwszej wiadomości (linki od obcych kont lądują w spamie).

export const SIGNATURE = "Adam";

/** Słowo kluczowe, które lead odpisuje, żeby dostać szczegóły (wyzwalacz w ManyChacie). */
export const KEYWORD = "KARTA";

/** Dowód społeczny — bez miast, same nazwy. */
const PROOF = "MusiSushi i Kago Sushi";

/**
 * Linki wysyłane dopiero PO odpowiedzi. Filmik ustawia się zmienną
 * NEXT_PUBLIC_FILM_URL (Vercel → Environment Variables) — bez niej gotowe
 * odpowiedzi pokazują "[link do filmiku]", a bot na IG NIE odpisuje sam.
 */
export const LINKS = {
  www: "scanova.tech",
  kalkulator: "scanova.tech/kalkulator",
  film: (process.env.NEXT_PUBLIC_FILM_URL?.trim() || null) as string | null,
};

/**
 * Nisze w Bazie. Od 2026-10-21 nie zmieniają treści DM-a (wszyscy mają ten sam
 * tekst) — służą tylko do segmentacji: filtry w Bazie, sekcje w kolejce na Dziś.
 */
export const NICHES = [
  "pizza",
  "burgery",
  "kebab/street food",
  "kawiarnia",
  "cukiernia/lody",
  "sniadania/brunch",
  "sushi/azja",
  "boba/matcha",
  "vegan",
  "wloska",
  "restauracja",
];

/** Jeden zimny DM dla wszystkich lokali. Hook = opinie w Google. */
export const COLD_DM =
  `Cześć. Zbieramy restauracjom nawet 200 nowych opinii w Google miesięcznie. ` +
  `Robimy cyfrowe karty lojalnościowe: gość dodaje Waszą kartę do Apple lub Google Wallet, ` +
  `bez żadnej aplikacji, i zbiera pieczątki za wizyty. ` +
  `Wy widzicie, kto do Was wraca, a system sam prosi zadowolonych gości o opinię w Google. ` +
  `Korzystają już z tego m.in. ${PROOF}. ` +
  `Dla każdej lokalizacji pierwsze 14 dni są testowe i za darmo, więc sprawdzicie bez ryzyka, czy Wam się to opłaca. ` +
  `Chcecie poznać szczegóły? Odpiszcie jednym słowem „${KEYWORD}”, a podeślę więcej informacji. ${SIGNATURE}`;

/**
 * Pierwszy DM. Argumenty zostały dla zgodności z Bazą (nisza, hook z researchu),
 * ale treść jest jedna dla wszystkich — patrz COLD_DM.
 */
export function firstDm(_niche?: string, _customHook?: string | null): string {
  return COLD_DM;
}

/** Follow-up po 3 dniach ciszy: ta sama obietnica, prośba o jedno słowo, jasne wyjście. */
export function followupDm(): string {
  return (
    `Cześć, jeszcze raz krótko: nasz system zbiera restauracjom nawet 200 nowych opinii w Google miesięcznie, ` +
    `a goście wracają po pieczątki w karcie, którą mają w telefonie. Pierwsze 14 dni są testowe i za darmo. ` +
    `Odpiszcie jednym słowem „${KEYWORD}”, a podeślę więcej informacji. ` +
    `Jeśli temat nie gra, dajcie znać, nie będę spamować. ${SIGNATURE}`
  );
}

export type ReplyTemplate = {
  key: string;
  /** Etykieta na przycisku. */
  label: string;
  /** Kiedy użyć — jedna linia pod przyciskiem. */
  when: string;
  text: string;
};

const filmLink = () => LINKS.film ?? "[link do filmiku]";

/**
 * Gotowe odpowiedzi w rozmowie. Fragmenty w nawiasach kwadratowych podmieniasz
 * przed wysłaniem — celowo nie zgadujemy dnia, godziny ani ceny.
 */
export const REPLIES: ReplyTemplate[] = [
  {
    key: "film",
    label: "Odpisał → filmik",
    when: `Na każdą pierwszą odpowiedź (słowo ${KEYWORD} obsługuje ManyChat sam; ręcznie, gdy ktoś odpisze inaczej).`,
    text:
      `Dzięki za odpowiedź. Wszystkie szczegóły są tu: ${filmLink()}. ` +
      `Znajdziecie tam minutowy filmik, prawdziwe liczby z jednej z naszych restauracji i cennik. ` +
      `Na dole jest przycisk „Umów spotkanie”: 15 minut online, ustawimy system pod Wasz lokal. ` +
      `Pierwsze 14 dni za darmo. ${SIGNATURE}`,
  },
  {
    key: "info",
    label: "„Wyślij więcej info”",
    when: "Gdy proszą o szczegóły zamiast spotkania.",
    text:
      `Jasne. Najważniejsze: system sam prosi zadowolonych gości o opinię w Google, u jednej z naszych ` +
      `sieci to nawet 200 nowych opinii miesięcznie. A działa to tak: gość dodaje Waszą kartę do Apple ` +
      `lub Google Wallet, bez aplikacji. Przy wizycie dostaje pieczątkę przez NFC albo QR, a po kilku ` +
      `odbiera nagrodę. Wy widzicie, kto wraca, i możecie wysłać powiadomienie na jego telefon. ` +
      `Pierwsze 14 dni są testowe i za darmo. ` +
      `Reszta jest na ${LINKS.www}. Najszybciej pokazać to na spotkaniu online (15 minut) albo wpadnę do Was na 5 minut. Co wolicie?`,
  },
  {
    key: "cena",
    label: "„Ile to kosztuje?”",
    when: "Pytanie o cenę przed spotkaniem.",
    text:
      `Pierwsze 14 dni są testowe i za darmo. Potem od 250 zł miesięcznie za lokal, a pakiet ` +
      `z opiniami Google i przypomnieniami 339 zł. Bez umowy na czas określony, rezygnacja w każdej chwili, ` +
      `stojak i karty w cenie. Ustawiamy wszystko za Was w 1–3 dni, Wy nic nie instalujecie. ` +
      `Najlepiej pokazać na żywo, 5 minut. Kiedy pasuje?`,
  },
  {
    key: "kalkulator",
    label: "„Czy to się opłaca?”",
    when: "Gdy wahają się, czy to ma sens finansowo.",
    text:
      `Policzmy to na Waszych liczbach, tu jest prosty kalkulator: ${LINKS.kalkulator}. Wpisujecie gości ` +
      `dziennie, średni rachunek i marżę. Liczy ostrożnie, bo bierze tylko dodatkowe wizyty stałych gości. ` +
      `Zwykle plan zwraca się po kilku dniach. A pierwsze 14 dni i tak są za darmo.`,
  },
  {
    key: "umow",
    label: "Umawiam wizytę",
    when: "Gdy zgodzili się na spotkanie.",
    text:
      `Super, to wpadnę [dzień] koło [godzina]. Zajmie 5 minut, pokażę wszystko na Waszym ` +
      `telefonie. Do zobaczenia!`,
  },
  {
    key: "po_demo",
    label: "Po demo → 14 dni testowych",
    when: "Tego samego dnia po pokazie.",
    text:
      `Dzięki za spotkanie. Podsumowując: pierwsze 14 dni są testowe i za darmo, kartę przygotowujemy w ciągu ` +
      `[1–2] dni, Wy nic nie instalujecie, a po 14 dniach sami decydujecie. Startujemy?`,
  },
  {
    key: "nie_teraz",
    label: "„Nie teraz”",
    when: "Odmowa miękka — zostawiamy furtkę.",
    text:
      `Jasne, rozumiem. Odezwę się za [miesiąc], a jeśli coś się zmieni wcześniej, jestem tu. ` +
      `Powodzenia!`,
  },
];

export function replyByKey(key: string): ReplyTemplate | undefined {
  return REPLIES.find((r) => r.key === key);
}
