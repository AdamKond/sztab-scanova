// Uproszczony model rozmowy: 6 kroków zamiast 14 statusów. Statusy w bazie
// zostają (historia, metryki, trigger) — tu tylko mapowanie na to, co widzi
// człowiek i co ma zrobić dalej.

import type { CrmLead, LeadStatus } from "./types";

export type Step =
  | "odpisal"
  | "rozmawia"
  | "wizyta"
  | "demo"
  | "pilot"
  | "klient"
  | "pozniej"
  | "nie"
  | "rezygnacja";

/** Kroki główne w kolejności lejka — pasek postępu na karcie rozmowy. */
export const MAIN_STEPS: Step[] = ["odpisal", "rozmawia", "wizyta", "demo", "pilot", "klient"];

/** Status bazy, w który wchodzi lead przy przejściu na dany krok. */
export const STEP_STATUS: Record<Step, LeadStatus> = {
  odpisal: "proba_kontaktu",
  rozmawia: "kontakt_zdecydentem",
  wizyta: "demo_umowione",
  demo: "demo_wykonane",
  pilot: "pilot_aktywny",
  klient: "platny_klient",
  pozniej: "followup_pozniej",
  nie: "utracony",
  rezygnacja: "churn",
};

export const STEP_LABELS: Record<Step, string> = {
  odpisal: "Odpisał",
  rozmawia: "Rozmawia",
  wizyta: "Wizyta umówiona",
  demo: "Po demo",
  pilot: "Pilot",
  klient: "Płaci",
  pozniej: "Później",
  nie: "Nie",
  rezygnacja: "Zrezygnował",
};

/** Kolor plakietki kroku — zielony tylko dla pieniędzy, czerwony tylko dla końca. */
export const STEP_TONES: Record<Step, "neutral" | "accent" | "success" | "danger" | "warning"> = {
  odpisal: "accent",
  rozmawia: "accent",
  wizyta: "warning",
  demo: "warning",
  pilot: "success",
  klient: "success",
  pozniej: "neutral",
  nie: "danger",
  rezygnacja: "danger",
};

/** Co zrobić na tym kroku — jedno zdanie, widoczne na Dziś i w rozmowie. */
export const STEP_HINTS: Record<Step, string> = {
  odpisal: "Odpisz i wyślij filmik — gotowa odpowiedź „Odpisał → filmik”.",
  rozmawia: "Umów wizytę na 5 minut: zaproponuj konkretny dzień i godzinę.",
  wizyta: "Wpadnij, pokaż na ich telefonie, zaproponuj pilot od razu.",
  demo: "Domknij pilot: napisz tego samego dnia („Po demo → pilot”).",
  pilot: "Check-in co tydzień. Pod koniec miesiąca: przechodzimy na płatny?",
  klient: "Płaci. Poproś o polecenie do sąsiedniego lokalu.",
  pozniej: "Wróć w ustalonym terminie z jednym zdaniem.",
  nie: "Zamknięte. Powód w notatce.",
  rezygnacja: "Klient odszedł. Zapytaj o powód — to najcenniejsza informacja.",
};

/** Każdy status bazy ma swój krok — także stare, których UI już nie pokazuje. */
const STATUS_STEP: Record<LeadStatus, Step> = {
  nowy: "odpisal",
  proba_kontaktu: "odpisal",
  kontakt_zdecydentem: "rozmawia",
  analiza_potrzeb: "rozmawia",
  demo_umowione: "wizyta",
  demo_wykonane: "demo",
  oferta: "demo",
  pilot_umowiony: "demo",
  pilot_aktywny: "pilot",
  platny_klient: "klient",
  followup_pozniej: "pozniej",
  utracony: "nie",
  zdyskwalifikowany: "nie",
  churn: "rezygnacja",
};

export function stepOf(status: LeadStatus): Step {
  return STATUS_STEP[status];
}

/** Statusy, które są aktywną rozmową (przed pilotem) albo odłożoną na później. */
export const CONVERSATION_STATUSES: LeadStatus[] = [
  "proba_kontaktu",
  "kontakt_zdecydentem",
  "analiza_potrzeb",
  "demo_umowione",
  "demo_wykonane",
  "oferta",
  "pilot_umowiony",
  "followup_pozniej",
];

export const CLIENT_STATUSES: LeadStatus[] = ["pilot_aktywny", "platny_klient"];
export const CLOSED_STATUSES: LeadStatus[] = ["utracony", "zdyskwalifikowany", "churn"];

export function isConversation(lead: Pick<CrmLead, "status">): boolean {
  return CONVERSATION_STATUSES.includes(lead.status);
}

export function isClient(lead: Pick<CrmLead, "status">): boolean {
  return CLIENT_STATUSES.includes(lead.status);
}

export function isClosed(lead: Pick<CrmLead, "status">): boolean {
  return CLOSED_STATUSES.includes(lead.status);
}

/** Następny krok główny po bieżącym (null dla ostatniego i dla kroków bocznych). */
export function nextMainStep(step: Step): Step | null {
  const i = MAIN_STEPS.indexOf(step);
  if (i === -1 || i === MAIN_STEPS.length - 1) return null;
  return MAIN_STEPS[i + 1];
}

/** Statusy, które mogą wymagać ruchu dziś: rozmowy + aktywne piloty (check-iny). */
const ACTIONABLE_STATUSES: LeadStatus[] = [...CONVERSATION_STATUSES, "pilot_aktywny"];

/**
 * Rozmowy do ruszenia dziś: aktywna rozmowa (albo pilot) bez zaplanowanej
 * PRZYSZŁEJ daty. Zaległe najpierw, potem bez daty (świeże odpowiedzi), potem dzisiejsze.
 */
export function conversationsDue(leads: CrmLead[], today: string, warsawDay: (iso: string) => string) {
  const overdue: CrmLead[] = [];
  const todayList: CrmLead[] = [];
  const undated: CrmLead[] = [];
  for (const l of leads) {
    if (!ACTIONABLE_STATUSES.includes(l.status)) continue;
    if (!l.next_action_at) {
      // "Później" bez daty to odłożona rozmowa — nie wraca sama na Dziś.
      if (l.status !== "followup_pozniej") undated.push(l);
      continue;
    }
    const day = warsawDay(l.next_action_at);
    if (day < today) overdue.push(l);
    else if (day === today) todayList.push(l);
  }
  const byDate = (a: CrmLead, b: CrmLead) => (a.next_action_at ?? "").localeCompare(b.next_action_at ?? "");
  overdue.sort(byDate);
  todayList.sort(byDate);
  undated.sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""));
  return { overdue, today: todayList, undated, all: [...overdue, ...undated, ...todayList] };
}
