// Teksty wiadomości: pierwszy DM per nisza, follow-up po ciszy i gotowe
// odpowiedzi na typowe reakcje. Czysty moduł bez dostępu do bazy — używa go
// serwer (kolejka na Dziś) i klient (kopiowanie do schowka).
//
// Szkielet pierwszego DM-a (ustalony z Adamem, 2026-10-20):
// hook = ponad 300 nowych opinii w Google co miesiąc (najmocniejsza liczba idzie
// na początek) → zdanie o NICH (hook niszy albo z researchu) → co robimy (cyfrowe
// karty lojalnościowe w telefonie) → dowód (nasi klienci) → pierwsze 14 dni
// testowe za darmo dla każdej lokalizacji → pytanie i słowo kluczowe (KARTA),
// które uruchamia ManyChata. Słowo jest w nawiasie, żeby lead widział, co wpisać.
// Bez linku w pierwszej wiadomości (linki od obcych kont lądują w spamie).

export const SIGNATURE = "Adam";

/** Słowo kluczowe, które lead odpisuje, żeby dostać filmik (wyzwalacz w ManyChacie). */
export const KEYWORD = "KARTA";

/** Dowód społeczny — bez miast, same nazwy. */
const PROOF_RESTAURANT = "MusiSushi i Kago Sushi";
const PROOF_CAFE = "Yōkai Matcha, MusiSushi i Kago Sushi";

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

const CAFE_NICHES = new Set(["kawiarnia", "cukiernia/lody", "boba/matcha", "vegan", "sniadania/brunch"]);

const HOOKS: Record<string, string> = {
  pizza: "Piątkowa pizza to nawyk. Pytanie, czy ludzie mają go u Was, czy u konkurencji.",
  burgery: "Co ile wracają Wasi goście? Da się ten czas skrócić.",
  "kebab/street food": "Stały klient na lunch to najtańszy klient, bo nie trzeba go zdobywać drugi raz.",
  kawiarnia: "Papierowa karta na kawę ginie w portfelu, a telefon nie.",
  "cukiernia/lody": "Sobotnie zakupy u Was to dla wielu osób rytuał, a taki rytuał da się wzmocnić.",
  "sniadania/brunch": "W weekend macie kolejkę. Gdzie ci sami ludzie jedzą we wtorek?",
  "sushi/azja": "Ile osób było u Was raz, pochwaliło jedzenie i nie wróciło?",
  "boba/matcha": "Wasi klienci mają wszystko w telefonie. Karta lojalnościowa też powinna tam być.",
  vegan: "Goście lokali wege są wierni, jeśli mają powód, żeby wracać.",
  wloska: "Za nowego gościa płacicie reklamą. Stałemu wystarczy dać powód, żeby wrócił.",
  restauracja: "Za nowego gościa płacicie reklamą. Stałemu wystarczy dać powód, żeby wrócił.",
};

export const NICHES = Object.keys(HOOKS);

/**
 * Pierwszy DM: hook z opiniami, zdanie o nich, co robimy, dowód, 14 dni
 * testowych za darmo, pytanie i słowo kluczowe.
 * `customHook` — zdanie o TYM lokalu (z researchu); bez niego hook per nisza.
 */
export function firstDm(niche: string, customHook?: string | null): string {
  const hook = customHook?.trim() || HOOKS[niche] || HOOKS.restauracja;
  const proof = CAFE_NICHES.has(niche) ? PROOF_CAFE : PROOF_RESTAURANT;
  return (
    `Cześć! Jedna z sieci, z którymi pracujemy, zbiera ponad 300 nowych opinii w Google co miesiąc. ` +
    `${hook} ` +
    `Robimy cyfrowe karty lojalnościowe: gość dodaje Waszą kartę do Apple lub Google Wallet, bez aplikacji, ` +
    `zbiera pieczątki za wizyty i wraca po nagrodę. Wy widzicie, kto wraca, a system sam prosi zadowolonych ` +
    `gości o opinię w Google. Stąd te 300. ` +
    `Korzystają już m.in. ${proof}. ` +
    `Pierwsze 14 dni są testowe i za darmo dla każdej lokalizacji, potem sami decydujecie. ` +
    `Myśleliście o czymś takim? Jeśli chcecie szczegóły, odpiszcie jednym słowem (${KEYWORD}), a podeślę krótki filmik. ` +
    `Nic nie instalujecie. ${SIGNATURE}`
  );
}

/** Follow-up po 3 dniach ciszy: krótko, prośba o jedno słowo, jasne wyjście. */
export function followupDm(): string {
  return (
    `Cześć, jeszcze raz krótko: u jednej z naszych sieci system zbiera ponad 300 nowych opinii w Google co miesiąc, ` +
    `a goście wracają po pieczątki w karcie, którą mają w telefonie. Pierwsze 14 dni są testowe i za darmo. ` +
    `Odpiszcie jednym słowem (${KEYWORD}), a wyślę minutowy filmik, jak to działa. ` +
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
    when: `Na każdą pierwszą odpowiedź (${KEYWORD} wysyła ManyChat sam; ręcznie, gdy ktoś odpisze inaczej).`,
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
      `Jasne. Gość dodaje Waszą kartę do Apple lub Google Wallet, bez aplikacji. Przy wizycie ` +
      `dostaje pieczątkę przez NFC albo QR, a po kilku odbiera nagrodę. Wy widzicie, kto wraca, ` +
      `i możecie wysłać powiadomienie na jego telefon. System prosi też zadowolonych gości o opinię ` +
      `w Google: u jednej z naszych sieci to ponad 300 nowych opinii co miesiąc. Pierwsze 14 dni są testowe i za darmo. ` +
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
