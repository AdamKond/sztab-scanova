// Teksty wiadomości: pierwszy DM per nisza, follow-up po ciszy i gotowe
// odpowiedzi na typowe reakcje. Czysty moduł bez dostępu do bazy — używa go
// serwer (kolejka na Dziś) i klient (kopiowanie do schowka).
//
// Szkielet pierwszego DM-a (ustalony z Adamem, 2026-09-21):
// hook o NICH → co robimy (cyfrowe karty lojalnościowe w telefonie) → opinie
// Google (nawet do 200 w miesiącu) → dowód (nasi klienci) → pierwszy miesiąc
// testowy za darmo dla każdej lokalizacji → pytanie o 5 minut.
// Bez linku w pierwszej wiadomości (linki od obcych kont lądują w spamie).

export const SIGNATURE = "Adam";

/** Dowód społeczny — bez miast, same nazwy. */
const PROOF_RESTAURANT = "MusiSushi i Kago Sushi";
const PROOF_CAFE = "Yōkai Matcha, MusiSushi i Kago Sushi";

/**
 * Linki wysyłane dopiero PO odpowiedzi. `film` uzupełnij, gdy nagracie
 * 2-minutowy filmik — do tego czasu gotowe odpowiedzi pokazują "[link do filmiku]".
 */
export const LINKS = {
  www: "scanova.tech",
  film: null as string | null,
};

const CAFE_NICHES = new Set(["kawiarnia", "cukiernia/lody", "boba/matcha", "vegan", "sniadania/brunch"]);

const HOOKS: Record<string, string> = {
  pizza: "Piątkowa pizza to nawyk — pytanie tylko, czy ludzie mają go u Was, czy u konkurencji.",
  burgery: "Wasi goście wracają średnio co ile? Da się to realnie skrócić.",
  "kebab/street food": "Stały klient na lunch to najtańszy klient — nie trzeba go zdobywać drugi raz.",
  kawiarnia: "Papierowe karty na kawę giną w portfelach. Telefon nie ginie.",
  "cukiernia/lody": "Sobotni klient po Wasze wypieki to rytuał — a rytuały można wzmacniać.",
  "sniadania/brunch": "Weekendowa kolejka to jedno. Pytanie, gdzie ci sami ludzie jedzą we wtorek.",
  "sushi/azja": "Ile osób było u Was raz, pochwaliło jedzenie i nigdy nie wróciło?",
  "boba/matcha": "Wasi klienci żyją w telefonach. Karta lojalnościowa też powinna.",
  vegan: "Goście lokali wege to najwierniejsza klientela — jeśli dać im powód, żeby wracać.",
  wloska: "Nowych gości przyprowadza marketing. Stałych — konkretny powód, żeby wrócić.",
  restauracja: "Nowych gości przyprowadza marketing. Stałych — konkretny powód, żeby wrócić.",
};

export const NICHES = Object.keys(HOOKS);

/** Pierwszy DM: hook, co robimy, opinie Google, dowód, darmowy miesiąc testowy, pytanie. */
export function firstDm(niche: string): string {
  const hook = HOOKS[niche] ?? HOOKS.restauracja;
  const proof = CAFE_NICHES.has(niche) ? PROOF_CAFE : PROOF_RESTAURANT;
  return (
    `Cześć! ${hook} ` +
    `Robimy cyfrowe karty lojalnościowe: gość dodaje Waszą kartę do Apple/Google Wallet ` +
    `(bez żadnej aplikacji), zbiera pieczątki za wizyty i wraca po nagrodę — a Wy widzicie, kto wraca. ` +
    `Ten sam system prosi zadowolonych gości o opinię w Google: to jeden z najskuteczniejszych ` +
    `sposobów na opinie, u naszych klientów nawet do 200 nowych w miesiącu. ` +
    `Korzystają już m.in. ${proof}. ` +
    `Dla każdej lokalizacji pierwszy miesiąc jest testowy i za darmo — sprawdzacie bez ryzyka, ` +
    `czy Wam się to opłaca. Mogę wpaść na 5 minut i pokazać na Waszym telefonie? ${SIGNATURE}`
  );
}

/** Follow-up po 3 dniach ciszy: krótko, prośba o jedno słowo, jasne wyjście. */
export function followupDm(): string {
  return (
    `Cześć, wracam na moment — wiem, że macie młyn. Jedno zdanie: cyfrowa karta lojalnościowa ` +
    `w telefonie + więcej opinii w Google, pierwszy miesiąc testowy za darmo. Odpiszcie „ok”, ` +
    `a wyślę 2-minutowy filmik, jak to działa. Jak temat nie gra, dajcie znać — nie będę spamować. ${SIGNATURE}`
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
      `Super, dzięki! Tu 2-minutowy filmik, jak to działa u naszych klientów: ${filmLink()}. ` +
      `Jeśli ma sens, wpadnę na 5 minut i pokażę na Waszym telefonie — pasuje [dzień] koło [godzina]?`,
  },
  {
    key: "info",
    label: "„Wyślij więcej info”",
    when: "Gdy proszą o szczegóły zamiast spotkania.",
    text:
      `Jasne. Gość dodaje Waszą kartę do Apple/Google Wallet (bez żadnej aplikacji), przy wizycie ` +
      `dostaje pieczątkę przez NFC albo QR, po kilku odbiera nagrodę. Wy widzicie, kto wraca, ` +
      `i możecie wysłać powiadomienie na telefon. System prosi też zadowolonych gości o opinię ` +
      `w Google — u naszych klientów nawet do 200 nowych w miesiącu. Pierwszy miesiąc testowy za darmo. ` +
      `Wszystko jest na ${LINKS.www}. Najszybciej pokazać na żywo — 5 minut, kiedy pasuje?`,
  },
  {
    key: "cena",
    label: "„Ile to kosztuje?”",
    when: "Pytanie o cenę przed spotkaniem.",
    text:
      `Pierwszy miesiąc jest testowy i za darmo, potem [cena] zł/mies. za lokalizację, bez umowy ` +
      `na czas określony — rezygnacja w każdej chwili. Ustawiamy wszystko za Was, nic nie instalujecie. ` +
      `Najlepiej pokazać na żywo, 5 minut — kiedy pasuje?`,
  },
  {
    key: "umow",
    label: "Umawiam wizytę",
    when: "Gdy zgodzili się na spotkanie.",
    text:
      `Super, to wpadnę [dzień] koło [godzina]. Zajmie dosłownie 5 minut, pokażę na Waszym ` +
      `telefonie. Do zobaczenia!`,
  },
  {
    key: "po_demo",
    label: "Po demo → miesiąc testowy",
    when: "Tego samego dnia po pokazie.",
    text:
      `Dzięki za spotkanie! Podsumowując: pierwszy miesiąc testowy za darmo, kartę przygotowujemy w ` +
      `[1–2 dni], Wy nic nie instalujecie, a po miesiącu sami zdecydujecie. Startujemy?`,
  },
  {
    key: "nie_teraz",
    label: "„Nie teraz”",
    when: "Odmowa miękka — zostawiamy furtkę.",
    text:
      `Jasne, rozumiem. Odezwę się za [miesiąc], a jakby coś się zmieniło wcześniej — jestem tu. ` +
      `Powodzenia!`,
  },
];

export function replyByKey(key: string): ReplyTemplate | undefined {
  return REPLIES.find((r) => r.key === key);
}
