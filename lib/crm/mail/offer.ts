// Wariant „oferta”: mail ofertowy Adama (HTML + tekst) z 2026-11-21.
// Czysty moduł. Podstawia: podpis (imię nadawcy), adresy mailto (skrzynka,
// z której idzie mail — żeby odpowiedzi wracały tam, gdzie czyta je cron),
// i dokleja stopkę z wypisaniem (wymóg prawny + nagłówek List-Unsubscribe).
//
// Decyzja Adama 2026-11-22: to TEN mail idzie jako pierwszy. Follow-upy
// zostają tekstowe i krótkie (forma „Państwo”, jak w ofercie).

import { OFFER_HTML, OFFER_TEXT } from "./templates/oferta";
import { shortName, type MailContext } from "./copy";

const ORIGINAL_NAME = "Oliwier Kępa";
const ORIGINAL_MAILBOX = "scanova.support@gmail.com";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Temat maila ofertowego — rzeczowy, z nazwą lokalu. */
export function offerSubject(name: string): string {
  return `Karta lojalnościowa dla ${shortName(name)}: pierwsze 14 dni za darmo`;
}

export function offerHtml(ctx: MailContext): string {
  const sender = escapeHtml(ctx.senderName);
  const mailbox = ctx.senderEmail;
  let html = OFFER_HTML.split(ORIGINAL_NAME).join(sender);
  // mailto w przycisku i w stopce → skrzynka nadawcza
  html = html.split(`mailto:${ORIGINAL_MAILBOX}`).join(`mailto:${mailbox}`);
  html = html.split(`>${ORIGINAL_MAILBOX}<`).join(`>${mailbox}<`);
  // Stopka z wypisaniem — doklejona na końcu ostatniej komórki (szary tekst jak reszta stopki).
  const footer =
    `<div style="margin-top:14px;font-size:11.5px;line-height:17px;color:rgb(147,160,184)">` +
    `Jeśli nie chcą Państwo więcej wiadomości od nas, wystarczy odpisać „nie” albo ` +
    `<a href="${escapeHtml(ctx.unsubscribeUrl)}" style="color:rgb(147,160,184)">kliknąć tutaj</a>.</div>`;
  const closing = "</td></tr></tbody></table></td></tr></tbody></table></div>";
  if (html.endsWith(closing)) {
    html = html.slice(0, -closing.length) + footer + closing;
  } else {
    html += footer;
  }
  return html;
}

export function offerText(ctx: MailContext): string {
  let text = OFFER_TEXT.split(ORIGINAL_NAME).join(ctx.senderName);
  text = text.split(ORIGINAL_MAILBOX).join(ctx.senderEmail);
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
