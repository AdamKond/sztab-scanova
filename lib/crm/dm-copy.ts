// Teksty wiadomości: pierwszy DM per nisza, follow-up po ciszy i gotowe
// odpowiedzi na typowe reakcje. Czysty moduł bez dostępu do bazy — używa go
// serwer (kolejka na Dziś) i klient (kopiowanie do schowka).
//
// Szkielet pierwszego DM-a (ustalony z Adamem, 2026-09-21):
// hook o NICH → co robimy (cyfrowe karty lojalnościowe w telefonie) → opinie
// Google (nawet do 200 w miesiącu) → dowód (nasi klienci) → pierwsze 14 dni
// testowy za darmo dla każdej lokalizacji → pytanie, czy chcą poznać szczegóły
// (nie o spotkanie — link do filmiku/strony idzie dopiero po odpowiedzi).
// Bez linku w pierwszej wiadomości (linki od obcych kont lądują w spamie).

export const SIGNATURE = "Adam";

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
  burgery: "Co ile wracają Wasi goście? Da się to skrócić.",
  "kebab/street food": "Stały klient na lunch to najtańszy klient, bo nie trzeba go zdobywać drugi raz.",
  kawiarnia: "Papierowa karta na kawę ginie w portfelu, telefon nie.",
  "cukiernia/lody": "Sobotnie zakupy u Was to dla wielu osób rytuał, a taki rytuał da się wzmocnić.",
  "sniadania/brunch": "W weekend macie kolejkę. Gdzie ci sami ludzie jedzą we wtorek?",
  "sushi/azja": "Ile osób było u Was raz, pochwaliło jedzenie i nie wróciło?",
  "boba/matcha": "Wasi klienci mają wszystko w telefonie. Karta lojalnościowa też powinna tam być.",
  vegan: "Goście lokali wege są wierni, jeśli mają powód, żeby wracać.",
  wloska: "Za nowego gościa płacicie reklamą. Stały gość potrzebuje tylko powodu, żeby wrócić.",
  restauracja: "Za nowego gościa płacicie reklamą. Stały gość potrzebuje tylko powodu, żeby wrócić.",
};

export const NICHES = Object.keys(HOOKS);

/**
 * Pierwszy DM: hook, co robimy, opinie Google, dowód, 14 dni testowych za darmo, pytanie.
 * `customHook` — zdanie o TYM lokalu (z researchu); bez niego hook per nisza.
 */
export function firstDm(niche: string, customHook?: string | null): string {
  const hook = customHook?.trim() || HOOKS[niche] || HOOKS.restauracja;
  const proof = CAFE_NICHES.has(niche) ? PROOF_CAFE : PROOF_RESTAURANT;
  return (
    `Cześć! ${hook} ` +
    `Robimy cyfrowe karty lojalnościowe: gość dodaje Waszą kartę do Apple lub Google Wallet, bez aplikacji, ` +
    `zbiera pieczątki za wizyty i wraca po nagrodę. Wy widzicie, kto wraca. ` +
    `Ten sam system prosi zadowolonych gości o opinię w Google, u naszych klientów to nawet do 200 nowych opinii w miesiącu. ` +
    `Korzystają już m.in. ${proof}. ` +
    `Pierwsze 14 dni są testowe i za darmo dla każdej lokalizacji, po nich sami decydujecie. ` +
    `Myśleliście o czymś takim? Jeśli chcecie szczegóły, dajcie znać, podeślę krótki filmik. ` +
    `Nic nie instalujecie. ${SIGNATURE}`
  );
}

/** Follow-up po 3 dniach ciszy: krótko, prośba o jedno słowo, jasne wyjście. */
export function followupDm(): string {
  return (
    `Cześć, jeszcze raz w sprawie karty lojalnościowej w telefonie gościa i opinii w Google. ` +
    `Pierwsze 14 dni testowe za darmo. Odpiszcie „ok”, a wyślę minutowy filmik, jak to działa. ` +
    `Jak temat nie gra, dajcie znać, nie będę spamować. ${SIGNATURE}`
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
    when: "Na każdą pierwszą odpowiedź (nawet samo „ok”).",
    text:
      `Dzięki za odpowiedź. Tu minutowy filmik, jak to działa u naszych klientów: ${filmLink()}. ` +
      `Jeśli ma sens, ustawiamy Wam 14 dni testowych. Zdalnie albo wpadnę na 5 minut i pokażę ` +
      `na Waszym telefonie, jak wolicie. Co Wam bardziej pasuje?`,
  },
  {
    key: "info",
    label: "„Wyślij więcej info”",
    when: "Gdy proszą o szczegóły zamiast spotkania.",
    text:
      `Jasne. Gość dodaje Waszą kartę do Apple lub Google Wallet, bez aplikacji. Przy wizycie ` +
      `dostaje pieczątkę przez NFC albo QR, po kilku odbiera nagrodę. Wy widzicie, kto wraca, ` +
      `i możecie wysłać powiadomienie na telefon. System prosi też zadowolonych gości o opinię ` +
      `w Google, u naszych klientów nawet do 200 nowych w miesiącu. Pierwsze 14 dni testowe za darmo. ` +
      `Reszta jest na ${LINKS.www}. Najszybciej pokazać na żywo, 5 minut. Kiedy pasuje?`,
  },
  {
    key: "cena",
    label: "„Ile to kosztuje?”",
    when: "Pytanie o cenę przed spotkaniem.",
    text:
      `Pierwsze 14 dni są testowe i za darmo. Potem od 250 zł miesięcznie za lokal, a pakiet ` +
      `z opiniami Google i przypomnieniami 339 zł. Bez umowy na czas określony, rezygnacja w każdej chwili, ` +
      `stojak i karty w cenie. Ustawiamy wszystko za Was w 1–3 dni, nic nie instalujecie. ` +
      `Najlepiej pokazać na żywo, 5 minut. Kiedy pasuje?`,
  },
  {
    key: "kalkulator",
    label: "„Czy to się opłaca?”",
    when: "Gdy wahają się, czy to ma sens finansowo.",
    text:
      `Policzmy na Waszych liczbach, tu jest prosty kalkulator: ${LINKS.kalkulator}. Wpisujecie gości ` +
      `dziennie, średni rachunek i marżę. Liczy tylko dodatkowe wizyty stałych gości, ostrożnie. ` +
      `Zwykle plan zwraca się po kilku dniach. A pierwsze 14 dni i tak są za darmo.`,
  },
  {
    key: "umow",
    label: "Umawiam wizytę",
    when: "Gdy zgodzili się na spotkanie.",
    text:
      `Super, to wpadnę [dzień] koło [godzina]. Zajmie 5 minut, pokażę na Waszym ` +
      `telefonie. Do zobaczenia!`,
  },
  {
    key: "po_demo",
    label: "Po demo → 14 dni testowych",
    when: "Tego samego dnia po pokazie.",
    text:
      `Dzięki za spotkanie. Podsumowując: pierwsze 14 dni testowe za darmo, kartę przygotowujemy w ` +
      `[1–2 dni], Wy nic nie instalujecie, a po 14 dniach sami decydujecie. Startujemy?`,
  },
  {
    key: "nie_teraz",
    label: "„Nie teraz”",
    when: "Odmowa miękka — zostawiamy furtkę.",
    text:
      `Jasne, rozumiem. Odezwę się za [miesiąc], a jakby coś się zmieniło wcześniej, jestem tu. ` +
      `Powodzenia!`,
  },
];

export function replyByKey(key: string): ReplyTemplate | undefined {
  return REPLIES.find((r) => r.key === key);
}
