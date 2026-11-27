// Wariant „oferta”: mail ofertowy Adama (HTML + tekst) z 2026-11-21.
// Czysty moduł. Podpis zostaje DOKŁADNIE taki, jak napisał Adam („Pozdrawiamy,
// Oliwier Kępa i Adam Kondracki”). Podstawiamy tylko adresy mailto (skrzynka,
// z której idzie mail — żeby odpowiedzi wracały tam, gdzie czyta je cron)
// i doklejamy stopkę z wypisaniem (wymóg prawny + nagłówek List-Unsubscribe).
//
// Decyzja Adama 2026-11-22: to TEN mail idzie jako pierwszy. Follow-upy
// zostają tekstowe i krótkie (forma „Państwo”, jak w ofercie).

import { OFFER_HTML, OFFER_TEXT } from "./templates/oferta";
import { shortName, type MailContext } from "./copy";

const ORIGINAL_MAILBOX = "scanova.support@gmail.com";

// Karta w mailu dobrana do branży lokalu (obrazki: repo scanova-tech, assets/cards/mail/,
// generator nowe-sekcje/karty-mail.html). Szablon ma kartę "restauracja"; podmieniamy
// src, alt i podpis pod obrazkiem.
const CARD_BASE = "https://scanova.tech/assets/cards/mail/";
const TEMPLATE_CARD_SRC = "https://scanova.tech/assets/cards/karta-scanova.png";
const TEMPLATE_CARD_ALT = "Karta lojalnościowa Scanova w Apple Wallet: 7 z 10 pieczątek i kod QR do skanowania przy kasie";
const TEMPLATE_CARD_CAPTION =
  "Tak wygląda karta w Apple Wallet lub Google Wallet. Pieczątka nabita przy kasie pojawia się na niej od razu.";

export interface OfferCard {
  /** Nazwa pliku bez rozszerzenia w assets/cards/mail/. */
  file: string;
  /** Dopełniacz do zdania „karta Państwa …”. */
  genitive: string;
  reward: string;
}

const CARDS: Record<string, OfferCard> = {
  pizzeria: { file: "pizzeria", genitive: "pizzerii", reward: "co 7. pizza gratis" },
  burgery: { file: "burgery", genitive: "burgerowni", reward: "9. burger gratis" },
  kebab: { file: "kebab", genitive: "lokalu", reward: "11. kebab gratis" },
  kawiarnia: { file: "kawiarnia", genitive: "kawiarni", reward: "11. kawa gratis" },
  cukiernia: { file: "cukiernia", genitive: "cukierni", reward: "9. deser gratis" },
  sushi: { file: "sushi", genitive: "sushi baru", reward: "zestaw gratis po 8 wizytach" },
  restauracja: { file: "restauracja", genitive: "restauracji", reward: "deser gratis na 10. wizytę" },
};

/**
 * Karta po NAZWIE lokalu (najpewniejsze: „Pizzeria K2”, „Good Burger”, „Kipo Sushi”),
 * dopiero potem po niszy z Bazy. Nisze „wloska”, „kebab/street food” i „sushi/azja”
 * bez słowa w nazwie dostają neutralną kartę restauracji — trattoria to nie pizzeria,
 * bar mleczny to nie kebab, a tajska to nie sushi bar (audyt 2026-11-27).
 */
export function offerCard(niche: string | null | undefined, name?: string | null): OfferCard {
  const n = (name ?? "").toLowerCase();
  if (/pizz/.test(n)) return CARDS.pizzeria;
  if (/burger|burgir|buły/.test(n)) return CARDS.burgery;
  if (/kebab|kebap|d[öo]ner/.test(n)) return CARDS.kebab;
  if (/sushi|sashimi/.test(n)) return CARDS.sushi;
  if (/cukiern|lodziarn|\blody\b|lood|gelato|p[ąa]czk|ciast|cake|deser|wafl|waffle/.test(n)) return CARDS.cukiernia;
  if (/kawiarn|kawk|caf[eé]|caff[eè]|coffee|herbaciarn|bubble|boba|matcha|kawa\b/.test(n)) return CARDS.kawiarnia;
  switch ((niche ?? "").toLowerCase()) {
    case "pizza":
      return CARDS.pizzeria;
    case "burgery":
      return CARDS.burgery;
    case "kawiarnia":
    case "boba/matcha":
    case "sniadania/brunch":
      return CARDS.kawiarnia;
    case "cukiernia/lody":
      return CARDS.cukiernia;
    default:
      return CARDS.restauracja;
  }
}

function cardCaption(card: OfferCard): string {
  return (
    `Tak może wyglądać karta Państwa ${card.genitive} w Apple Wallet lub Google Wallet, ` +
    `na przykład z nagrodą „${card.reward}”. Kolory, logo i nagrodę ustalamy razem. ` +
    `Pieczątka nabita przy kasie pojawia się na karcie od razu.`
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Temat maila ofertowego — rzeczowy, z nazwą lokalu. */
export function offerSubject(name: string): string {
  return `Karta lojalnościowa dla ${shortName(name)}: pierwsze 14 dni za darmo`;
}

export function offerHtml(ctx: MailContext): string {
  const mailbox = ctx.senderEmail;
  // mailto w przycisku i w stopce → skrzynka nadawcza
  const card = offerCard(ctx.niche, ctx.name);
  let html = OFFER_HTML.split(`mailto:${ORIGINAL_MAILBOX}`).join(`mailto:${mailbox}`);
  html = html
    .split(TEMPLATE_CARD_SRC).join(`${CARD_BASE}karta-${card.file}.png`)
    .split(TEMPLATE_CARD_ALT).join(escapeHtml(`Przykładowa karta lojalnościowa ${card.genitive} w Apple Wallet, nagroda: ${card.reward}`))
    .split(TEMPLATE_CARD_CAPTION).join(escapeHtml(cardCaption(card)));
  html = html.split(`>${ORIGINAL_MAILBOX}<`).join(`>${mailbox}<`);
  // Stopka z wypisaniem — doklejona na końcu ostatniej komórki (szary tekst jak reszta stopki).
  const footer =
    `<div style="margin-top:14px;font-size:11.5px;line-height:17px;color:rgb(147,160,184)">` +
    `Jeśli nie chcą Państwo więcej wiadomości od nas, wystarczy odpisać „nie” albo ` +
    `<a href="${escapeHtml(ctx.unsubscribeUrl)}" style="color:rgb(147,160,184)">kliknąć tutaj</a>.</div>`;
  // Wstawiamy do ostatniej komórki tabeli (stopka), żeby zostało w tym samym szarym bloku.
  const idx = html.lastIndexOf("</td>");
  return idx >= 0 ? html.slice(0, idx) + footer + html.slice(idx) : html + footer;
}

export function offerText(ctx: MailContext): string {
  const card = offerCard(ctx.niche, ctx.name);
  let text = OFFER_TEXT.split(ORIGINAL_MAILBOX).join(ctx.senderEmail);
  text = text.split("14 dni za darmo · 99 zł netto / mies. · 0 aplikacji").join(
    `14 dni za darmo · 99 zł netto / mies. · 0 aplikacji\n\nPrzykładowa karta ${card.genitive} (nagroda: ${card.reward}): ${CARD_BASE}karta-${card.file}.png`,
  );
  // Linijki "[image: …]" z konwersji Gmaila nic nie mówią w tekście.
  text = text
    .split("\n")
    .filter((l) => !/^\s*\[image:/.test(l))
    .join("\n");
  return `${text}\n\nJeśli nie chcą Państwo więcej wiadomości od nas, wystarczy odpisać „nie” albo kliknąć: ${ctx.unsubscribeUrl}`;
}

const OFFER_FOOTER = (ctx: MailContext) =>
  `Jeśli nie chcą Państwo więcej wiadomości od nas, wystarczy odpisać „nie” albo kliknąć: ${ctx.unsubscribeUrl}`;

/** Krok 2 dla wariantu oferta (po 3 dniach, ten sam wątek). */
export function offerFollowup(ctx: MailContext): string {
  return [
    "Dzień dobry,",
    `wracam do mojej wiadomości o karcie lojalnościowej w telefonie klienta dla ${ctx.name}. ` +
      "Krótko: klienci zbierają pieczątki w Apple lub Google Wallet, bez aplikacji, a system sam prosi ich o opinię w Google. " +
      "Pierwsze 14 dni są za darmo, potem 99 zł netto miesięcznie, bez umowy na czas określony.",
    "Znajdą Państwo w tym tygodniu 10 minut na krótką rozmowę telefoniczną? Wystarczy odpisać, jaki dzień i godzina pasują.",
    `Pozdrawiam\n${ctx.senderName}\nScanova sp. z o.o.`,
    OFFER_FOOTER(ctx),
  ].join("\n\n");
}

/** Krok 3 dla wariantu oferta (po 7 dniach, ostatni). */
export function offerLast(ctx: MailContext): string {
  return [
    "Dzień dobry,",
    "to ostatnia wiadomość ode mnie w tej sprawie. Jeśli temat stałych klientów i opinii w Google nie jest teraz " +
      "dla Państwa na stole, rozumiem i nie będę więcej pisać.",
    "Gdyby kiedyś był: pełna oferta i cennik są na https://scanova.tech/oferta, a 14 dni testowych czeka w każdej chwili.",
    `Powodzenia\n${ctx.senderName}\nScanova sp. z o.o.`,
    OFFER_FOOTER(ctx),
  ].join("\n\n");
}
