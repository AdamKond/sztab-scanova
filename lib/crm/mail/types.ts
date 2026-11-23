// Typy modułu Maile — lustro supabase/migration-006-maile.sql.
// Czysty moduł (bez "server-only"), żeby UI i testy mogły go importować.

export type MailStatus =
  | "oczekuje"
  | "wyslany"
  | "followup"
  | "zamkniety"
  | "odpowiedzial"
  | "odbil"
  | "skarga"
  | "wypisany"
  | "wstrzymany"
  | "blad";

export const MAIL_STATUSES: MailStatus[] = [
  "oczekuje",
  "wyslany",
  "followup",
  "zamkniety",
  "odpowiedzial",
  "odbil",
  "skarga",
  "wypisany",
  "wstrzymany",
  "blad",
];

export const MAIL_STATUS_LABELS: Record<MailStatus, string> = {
  oczekuje: "W kolejce",
  wyslany: "Wysłany, czeka",
  followup: "Po follow-upie",
  zamkniety: "Bez odpowiedzi",
  odpowiedzial: "Odpowiedział",
  odbil: "Odbił",
  skarga: "Spam (skarga)",
  wypisany: "Nie chce",
  wstrzymany: "Wstrzymany",
  blad: "Błąd wysyłki",
};

/** Statusy, z których nigdy więcej nic nie wysyłamy (czarna lista + zamknięte). */
export const MAIL_FINAL_STATUSES: MailStatus[] = [
  "zamkniety",
  "odpowiedzial",
  "odbil",
  "skarga",
  "wypisany",
];

export type MailVariant = "pytanie" | "oferta";

export type MailSource = "strona" | "gmaps" | "csv" | "reczne";

export interface CrmMailRow {
  id: string;
  email: string;
  domain: string;
  name: string;
  city: string | null;
  niche: string;
  www: string | null;
  instagram: string | null;
  phone: string | null;
  source: string;
  campaign: string;
  status: MailStatus;
  step: number;
  subject: string | null;
  mailbox: string | null;
  message_id: string | null;
  sent_at: string | null;
  step2_at: string | null;
  step3_at: string | null;
  last_step_at: string | null;
  replied_at: string | null;
  reply_excerpt: string | null;
  bounced_at: string | null;
  unsubscribed_at: string | null;
  last_error: string | null;
  attempts: number;
  note: string | null;
  lead_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmMailSettings {
  id: 1;
  paused: boolean;
  daily_limit: number;
  warmup_start: string | null;
  warmup_start_limit: number;
  warmup_step: number;
  followup_after_days: number;
  last_after_days: number;
  send_from_hour: number;
  send_to_hour: number;
  weekdays_only: boolean;
  variant: MailVariant;
  updated_at: string;
}

export type MailEventKind =
  | "wyslano"
  | "blad"
  | "odbicie"
  | "odpowiedz"
  | "autoodpowiedz"
  | "wypisanie"
  | "skarga"
  | "cron"
  | "test";

export interface CrmMailEvent {
  id: string;
  queue_id: string | null;
  email: string;
  kind: MailEventKind | string;
  step: number | null;
  mailbox: string | null;
  message_id: string | null;
  detail: string | null;
  created_at: string;
}

/** Skrzynka nadawcza (konfiguracja z env MAIL_ACCOUNTS — bez haseł w tym typie). */
export interface MailboxInfo {
  email: string;
  name: string;
  dailyCap: number;
  /** true = skrzynka tylko kończy rozpoczęte wątki (kroki 2 i 3), nowych maili #1 z niej nie wysyłamy. */
  onlyFollowups?: boolean;
}
