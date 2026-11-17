// Treści zimnych maili: 3-krokowa sekwencja + wariant "oferta".
// Czysty moduł — bez bazy, bez env (wszystko wchodzi parametrami), testowalny.
//
// Strategia (najlepsze praktyki cold outreach 2025/26, zastosowane 2026-11-17):
// - czysty tekst, bez HTML-owych szablonów, obrazków i pikseli śledzących
//   (to one wpychają do spamu; otwarcia i tak nic nie mówią),
// - mail #1 poniżej 90 słów, jedna myśl, jedno pytanie ("czy podesłać film?"),
//   a nie "umówmy spotkanie" — pytanie o zainteresowanie daje 2–3× więcej
//   odpowiedzi niż prośba o termin,
// - ZERO linków w mailu #1 (link od obcego nadawcy = filtr spamu i brak zaufania);
//   link dopiero w ostatnim mailu i w odpowiedzi,
// - temat krótki, małymi literami, z nazwą lokalu — ma wyglądać jak mail od
//   człowieka, nie newsletter; rotujemy 3 tematy, żeby filtry nie widziały
//   setek identycznych nagłówków,
// - sekwencja 3 kroków w JEDNYM wątku (follow-up jako "Re:", In-Reply-To),
//   dzień 0 → +3 → +7, potem koniec; odpowiedź zatrzymuje sekwencję,
// - jasne wyjście w każdym mailu (odpisz „nie” albo link do wypisania) —
//   wymóg prawny i mniej skarg o spam,
// - dowód społeczny lokalny (MusiSushi, Kago Sushi) i "jesteśmy z Lublina"
//   tylko dla lokali z okolicy (tam możemy wpaść osobiście).

import { KEYWORD } from "../dm-copy";

export const PROOF = "MusiSushi i Kago Sushi";

/** Nisza z Bazy → parametr `b` kalkulatora na stronie /restauracje. */
export function nicheToCalc(niche: string | null | undefined): string | null {
  switch ((niche ?? "").toLowerCase()) {
    case "pizza":
    case "wloska":
      return "pizzeria";
    case "burgery":
      return "burgery";
    case "kebab/street food":
      return "kebab";
    case "kawiarnia":
    case "boba/matcha":
    case "sniadania/brunch":
      return "kawiarnia";
    case "cukiernia/lody":
      return "cukiernia";
    case "sushi/azja":
      return "sushi";
    default:
      return null;
  }
}

/** Link na stronę "zamiast maila" z nazwą lokalu i branżą. */
export function landingLink(name: string, niche: string | null | undefined): string {
  const params = new URLSearchParams();
  params.set("l", name);
  const b = nicheToCalc(niche);
  if (b) params.set("b", b);
  return `https://scanova.tech/restauracje?${params.toString()}`;
}

/** Miasta, do których Adam realnie dojedzie "na 5 minut". */
const NEARBY = ["lublin", "świdnik", "swidnik", "lubartów", "lubartow", "łęczna", "leczna", "nałęczów", "naleczow", "puławy", "pulawy"];

export function isNearby(city: string | null | undefined): boolean {
  if (!city) return false;
  return NEARBY.includes(city.trim().toLowerCase());
}

/** Nazwa lokalu do tematu: bez "Restauracja"/"Pizzeria" z przodu, żeby temat był krótki. */
export function shortName(name: string): string {
  const stripped = name
    .replace(/^(restauracja|pizzeria|kawiarnia|bar|bistro|cukiernia|lodziarnia|piekarnia)\s+/i, "")
    .trim();
  const base = stripped.length >= 3 ? stripped : name.trim();
  return base.length > 40 ? `${base.slice(0, 38).trim()}…` : base;
}

/**
 * Tematy maila #1 — rotacja po stabilnym indeksie (np. z id wiersza), żeby ten
 * sam lokal przy ponownej próbie dostał ten sam temat.
 */
export const SUBJECTS: ((name: string) => string)[] = [
  (n) => `pytanie o ${n}`,
  (n) => `${n} i opinie w Google`,
  (n) => `krótkie pytanie, ${n}`,
];

export function pickSubject(name: string, seed: string): string {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return SUBJECTS[h % SUBJECTS.length](shortName(name));
}

export interface MailContext {
  name: string;
  city: string | null;
  niche: string | null;
  /** Podpis: imię i nazwisko nadawcy. */
  senderName: string;
  /** Telefon w podpisie (opcjonalnie). */
  phone: string | null;
  /** Pełny URL do wypisania się (unikalny per adres). */
  unsubscribeUrl: string;
}

const SIGNATURE = (ctx: MailContext) =>
  [ctx.senderName, "Scanova · Lublin", ctx.phone].filter(Boolean).join("\n");

const FOOTER = (ctx: MailContext) =>
  `Jeśli nie chcecie więcej wiadomości ode mnie, odpiszcie „nie” albo kliknijcie: ${ctx.unsubscribeUrl}`;

/** Mail #1, wariant "pytanie" (domyślny): pytamy, czy podesłać film. Bez linku. */
export function firstMailAsk(ctx: MailContext): string {
  const near = isNearby(ctx.city);
  return [
    "Dzień dobry,",
    `${near ? "piszę z Lublina, " : ""}prowadzę Scanovę. Robimy restauracjom cyfrowe karty lojalnościowe: ` +
      `gość dodaje kartę ${ctx.name} do Apple lub Google Wallet, bez żadnej aplikacji, i zbiera pieczątki za wizyty. ` +
      `Efekt uboczny jest taki, że system sam prosi zadowolonych gości o opinię w Google, ` +
      `u naszych restauracji to nawet 200 nowych opinii miesięcznie. Korzystają z tego m.in. ${PROOF}.`,
    `Czy mogę podesłać minutowy film, jak wyglądałoby to u Was? Wystarczy odpisać jednym słowem „${KEYWORD}”.`,
    `Pozdrawiam\n${SIGNATURE(ctx)}`,
    FOOTER(ctx),
  ].join("\n\n");
}

/** Mail #1, wariant "oferta": pełny tekst z linkiem (wariant C z docs/mail-zimny.md). */
export function firstMailOffer(ctx: MailContext): string {
  const near = isNearby(ctx.city);
  return [
    "Dzień dobry,",
    "zbieramy restauracjom nawet 200 nowych opinii w Google miesięcznie.",
    `Robimy cyfrowe karty lojalnościowe: gość dodaje kartę ${ctx.name} do Apple lub Google Wallet, ` +
      `bez żadnej aplikacji, zbiera pieczątki za wizyty i wraca po nagrodę. Wy widzicie, kto wraca, ` +
      `a system sam prosi zadowolonych gości o opinię w Google. Korzystają już z tego m.in. ${PROOF}.`,
    `Jak to działa, ile dało jednej z restauracji i ile kosztuje, jest na jednej stronie, razem z minutowym filmem: ` +
      landingLink(ctx.name, ctx.niche),
    "Pierwsze 14 dni są za darmo, dla każdej lokalizacji, bez umowy na czas określony. " +
      "Ustawiamy wszystko w 1–3 dni, Wy nic nie instalujecie.",
    `Chcecie poznać szczegóły? Odpiszcie jednym słowem „${KEYWORD}”, a podeślę więcej informacji.` +
      (near ? " Mogę też wpaść na 5 minut i pokazać wszystko na Waszym telefonie." : ""),
    `Pozdrawiam\n${SIGNATURE(ctx)}`,
    FOOTER(ctx),
  ].join("\n\n");
}

/** Krok 2 (po 3 dniach ciszy, w tym samym wątku): krótkie podbicie, nadal bez linku. */
export function followupMail(ctx: MailContext): string {
  return [
    "Dzień dobry,",
    "podbijam, bo wiem, jak wygląda skrzynka w gastronomii. Jedno zdanie: karta w telefonie gościa, " +
      "pieczątki za wizyty, a system sam zbiera Wam opinie w Google. Pierwsze 14 dni są za darmo.",
    `Podesłać minutowy film? Wystarczy odpisać „${KEYWORD}”.`,
    `Pozdrawiam\n${ctx.senderName}`,
    FOOTER(ctx),
  ].join("\n\n");
}

/** Krok 3 (po 7 dniach, ostatni): jasne zamknięcie + jedyny link w sekwencji. */
export function lastMail(ctx: MailContext): string {
  return [
    "Dzień dobry,",
    "to ostatnia wiadomość ode mnie. Jeśli temat stałych gości i opinii w Google nie jest teraz na stole, " +
      "rozumiem i nie będę więcej pisać.",
    `Gdyby kiedyś był: wszystko, z minutowym filmem i cennikiem, jest tu: ${landingLink(ctx.name, ctx.niche)}`,
    `Powodzenia\n${ctx.senderName}`,
    FOOTER(ctx),
  ].join("\n\n");
}

export interface RenderedMail {
  subject: string;
  text: string;
}

/**
 * Treść dla danego kroku sekwencji. Krok 2 i 3 idą jako "Re:" tematu maila #1
 * (ten sam wątek w skrzynce odbiorcy).
 */
export function renderMail(
  step: 1 | 2 | 3,
  variant: "pytanie" | "oferta",
  ctx: MailContext,
  firstSubject: string,
): RenderedMail {
  if (step === 1) {
    return {
      subject: firstSubject,
      text: variant === "oferta" ? firstMailOffer(ctx) : firstMailAsk(ctx),
    };
  }
  const re = firstSubject.toLowerCase().startsWith("re:") ? firstSubject : `Re: ${firstSubject}`;
  return { subject: re, text: step === 2 ? followupMail(ctx) : lastMail(ctx) };
}

/** Liczba słów — test pilnuje, żeby mail #1 nie urósł ponad 120 słów (bez stopki). */
export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
