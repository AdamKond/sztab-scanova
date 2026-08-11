// Stałe domeny: kolejność lejka, grupowania statusów i polskie etykiety.
// JEDYNE źródło prawdy dla list wartości — UI i walidacja importują stąd,
// żeby dodanie etapu nie wymagało zmian w pięciu plikach (grzech starego Sztabu).

import type {
  ActivityOutcome,
  ActivityType,
  CurrentLoyalty,
  GoalMetric,
  LeadPriority,
  LeadSource,
  LeadStatus,
  TaskPriority,
  TaskStatus,
} from "./types";

// Kolejność etapów lejka od pierwszego kontaktu do płatności.
// Konwersje liczymy z crm_stage_history ("lead wszedł w etap"), nie z bieżącego
// statusu — dzięki temu utracony po demo nadal liczy się jako wykonane demo.
export const FUNNEL_ORDER: LeadStatus[] = [
  "nowy",
  "proba_kontaktu",
  "kontakt_zdecydentem",
  "analiza_potrzeb",
  "demo_umowione",
  "demo_wykonane",
  "oferta",
  "pilot_umowiony",
  "pilot_aktywny",
  "platny_klient",
];

// Statusy "otwarte" — lead jest w grze i wymaga następnego kroku.
export const OPEN_STATUSES: LeadStatus[] = [
  "nowy",
  "proba_kontaktu",
  "kontakt_zdecydentem",
  "analiza_potrzeb",
  "demo_umowione",
  "demo_wykonane",
  "oferta",
  "pilot_umowiony",
  "pilot_aktywny",
  "followup_pozniej",
];

// Status wygranej. Pilot NIE jest wygraną i nie podbija celu płatnych klientów.
export const WON_STATUS: LeadStatus = "platny_klient";

// Statusy końcowe (lead poza grą). followup_pozniej celowo NIE jest końcowy —
// to odłożona rozmowa, nie porażka.
export const TERMINAL_STATUSES: LeadStatus[] = ["utracony", "zdyskwalifikowany", "churn"];

export const ALL_STATUSES: LeadStatus[] = [
  ...FUNNEL_ORDER,
  "followup_pozniej",
  ...TERMINAL_STATUSES,
];

export const STATUS_LABELS: Record<LeadStatus, string> = {
  nowy: "Nowy",
  proba_kontaktu: "Próba kontaktu",
  kontakt_zdecydentem: "Kontakt z decydentem",
  analiza_potrzeb: "Analiza potrzeb",
  demo_umowione: "Demo umówione",
  demo_wykonane: "Demo wykonane",
  oferta: "Oferta",
  pilot_umowiony: "Pilot umówiony",
  pilot_aktywny: "Pilot aktywny",
  platny_klient: "Płatny klient",
  followup_pozniej: "Follow-up później",
  utracony: "Utracony",
  zdyskwalifikowany: "Zdyskwalifikowany",
  churn: "Churn",
};

// Ton wizualny statusu dla StatusBadge. Zielony wyłącznie dla płatności,
// czerwony wyłącznie dla utraty/ryzyka — zgodnie z zasadami designu.
export const STATUS_TONES: Record<
  LeadStatus,
  "neutral" | "blue" | "green" | "red" | "amber" | "violet" | "slate"
> = {
  nowy: "neutral",
  proba_kontaktu: "slate",
  kontakt_zdecydentem: "blue",
  analiza_potrzeb: "blue",
  demo_umowione: "violet",
  demo_wykonane: "violet",
  oferta: "amber",
  pilot_umowiony: "amber",
  pilot_aktywny: "amber",
  platny_klient: "green",
  followup_pozniej: "slate",
  utracony: "red",
  zdyskwalifikowany: "slate",
  churn: "red",
};

export const PRIORITIES: LeadPriority[] = ["A", "B", "C", "D"];

export const PRIORITY_LABELS: Record<LeadPriority, string> = {
  A: "A — idealne dopasowanie",
  B: "B — dobre dopasowanie",
  C: "C — może kiedyś",
  D: "D — słabe dopasowanie",
};

export const SOURCES: LeadSource[] = [
  "teren",
  "ig_dm",
  "telefon",
  "email",
  "ads_meta",
  "ads_google",
  "polecenie",
  "partner",
  "inbound",
  "content",
  "inne",
];

export const SOURCE_LABELS: Record<LeadSource, string> = {
  teren: "Teren",
  ig_dm: "Instagram DM",
  telefon: "Telefon",
  email: "E-mail",
  ads_meta: "Meta Ads",
  ads_google: "Google Ads",
  polecenie: "Polecenie",
  partner: "Partner",
  inbound: "Inbound",
  content: "Content",
  inne: "Inne",
};

export const ACTIVITY_TYPES: ActivityType[] = [
  "wizyta",
  "ig_dm",
  "ig_followup",
  "telefon",
  "email",
  "whatsapp",
  "demo",
  "spotkanie",
  "oferta",
  "pilot_checkin",
  "notatka",
];

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  wizyta: "Wizyta",
  ig_dm: "IG DM",
  ig_followup: "IG follow-up",
  telefon: "Telefon",
  email: "E-mail",
  whatsapp: "WhatsApp",
  demo: "Demo",
  spotkanie: "Spotkanie",
  oferta: "Oferta",
  pilot_checkin: "Check-in pilota",
  notatka: "Notatka",
};

export const OUTCOMES: ActivityOutcome[] = [
  "brak_odpowiedzi",
  "brak_decydenta",
  "kontakt_zdecydentem",
  "zainteresowany",
  "followup_umowiony",
  "demo_umowione",
  "oferta_wyslana",
  "pilot_umowiony",
  "pilot_start",
  "platnosc",
  "odmowa",
  "inne",
];

export const OUTCOME_LABELS: Record<ActivityOutcome, string> = {
  brak_odpowiedzi: "Brak odpowiedzi",
  brak_decydenta: "Brak decydenta",
  kontakt_zdecydentem: "Kontakt z decydentem",
  zainteresowany: "Zainteresowany",
  followup_umowiony: "Follow-up umówiony",
  demo_umowione: "Demo umówione",
  oferta_wyslana: "Oferta wysłana",
  pilot_umowiony: "Pilot umówiony",
  pilot_start: "Start pilota",
  platnosc: "Płatność",
  odmowa: "Odmowa",
  inne: "Inne",
};

export const TASK_STATUSES: TaskStatus[] = ["otwarte", "zrobione", "anulowane"];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  otwarte: "Otwarte",
  zrobione: "Zrobione",
  anulowane: "Anulowane",
};

export const TASK_PRIORITIES: TaskPriority[] = ["niski", "normalny", "wysoki"];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  niski: "Niski",
  normalny: "Normalny",
  wysoki: "Wysoki",
};

export const GOAL_METRICS: GoalMetric[] = [
  "aktywnosci",
  "kontakty_z_decydentem",
  "demo",
  "piloty",
  "platni_klienci",
  "mrr",
];

export const GOAL_METRIC_LABELS: Record<GoalMetric, string> = {
  aktywnosci: "Aktywności",
  kontakty_z_decydentem: "Kontakty z decydentem",
  demo: "Demo wykonane",
  piloty: "Piloty uruchomione",
  platni_klienci: "Płatni klienci",
  mrr: "MRR (zł)",
};

export const CURRENT_LOYALTY_OPTIONS: CurrentLoyalty[] = [
  "brak",
  "papier",
  "aplikacja",
  "wallet",
  "pos",
  "inne",
];

export const CURRENT_LOYALTY_LABELS: Record<CurrentLoyalty, string> = {
  brak: "Brak programu",
  papier: "Papierowe pieczątki",
  aplikacja: "Aplikacja",
  wallet: "Wallet",
  pos: "Program w POS",
  inne: "Inne",
};

// Podpowiedzi kategorii wg ICP (kolumna w DB celowo nieograniczona —
// import może przynieść nowe branże bez zmiany schematu).
export const CATEGORY_SUGGESTIONS: string[] = [
  "kawiarnia",
  "piekarnia",
  "cukiernia",
  "sushi",
  "lunch",
  "fast casual",
  "pizzeria",
  "burger",
  "kebab",
  "restauracja",
  "beauty",
  "barber",
  "inne",
];
