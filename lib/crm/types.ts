// Typy domeny CRM — lustro schematu supabase/migration-001-core.sql.
// Daty przechodzą przez PostgREST jako stringi ISO; pola `date` jako YYYY-MM-DD.

export type LeadStatus =
  | "nowy"
  | "proba_kontaktu"
  | "kontakt_zdecydentem"
  | "analiza_potrzeb"
  | "demo_umowione"
  | "demo_wykonane"
  | "oferta"
  | "pilot_umowiony"
  | "pilot_aktywny"
  | "platny_klient"
  | "followup_pozniej"
  | "utracony"
  | "zdyskwalifikowany"
  | "churn";

export type LeadPriority = "A" | "B" | "C" | "D";

export type LeadSource =
  | "teren"
  | "ig_dm"
  | "telefon"
  | "email"
  | "ads_meta"
  | "ads_google"
  | "polecenie"
  | "partner"
  | "inbound"
  | "content"
  | "inne";

export type CurrentLoyalty = "brak" | "papier" | "aplikacja" | "wallet" | "pos" | "inne";

export type ActivityType =
  | "wizyta"
  | "ig_dm"
  | "ig_followup"
  | "telefon"
  | "email"
  | "whatsapp"
  | "demo"
  | "spotkanie"
  | "oferta"
  | "pilot_checkin"
  | "notatka";

export type ActivityOutcome =
  | "brak_odpowiedzi"
  | "brak_decydenta"
  | "kontakt_zdecydentem"
  | "zainteresowany"
  | "followup_umowiony"
  | "demo_umowione"
  | "oferta_wyslana"
  | "pilot_umowiony"
  | "pilot_start"
  | "platnosc"
  | "odmowa"
  | "inne";

export type TaskStatus = "otwarte" | "zrobione" | "anulowane";
export type TaskPriority = "niski" | "normalny" | "wysoki";

export type GoalMetric =
  | "aktywnosci"
  | "kontakty_z_decydentem"
  | "demo"
  | "piloty"
  | "platni_klienci"
  | "mrr";

export interface CrmLead {
  id: string;
  name: string;
  normalized_name: string;
  category: string | null;
  city: string | null;
  district: string | null;
  address: string | null;
  instagram: string | null;
  phone: string | null;
  email: string | null;
  www: string | null;
  google_rating: number | null;

  locations_count: number;
  estimated_daily_transactions: number | null;
  current_loyalty: CurrentLoyalty | null;
  decision_maker_name: string | null;
  decision_maker_role: string | null;

  source: LeadSource;
  source_detail: string | null;
  campaign: string | null;
  referred_by: string | null;
  /** Partner polecający (Etap 2). Brak kolumny przed migracją 002 = undefined. */
  partner_id?: string | null;

  status: LeadStatus;
  priority: LeadPriority;
  qualification_note: string | null;
  owner: string | null;

  next_action: string | null;
  next_action_at: string | null;
  last_activity_at: string | null;

  pilot_started_at: string | null;
  pilot_ends_at: string | null;
  paid_at: string | null;
  plan: string | null;
  // numeric(10,2) — PostgREST zwraca jako string; parsujemy na granicy w queries.ts.
  monthly_revenue: number | null;
  churned_at: string | null;
  lost_reason: string | null;
  disqualification_reason: string | null;

  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmStageHistory {
  id: string;
  lead_id: string;
  from_status: LeadStatus | null;
  to_status: LeadStatus;
  changed_by: string | null;
  changed_at: string;
}

export interface CrmActivity {
  id: string;
  lead_id: string | null;
  type: ActivityType;
  outcome: ActivityOutcome | null;
  note: string | null;
  happened_at: string;
  created_by: string;
  created_at: string;
}

export interface CrmTask {
  id: string;
  lead_id: string | null;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_to: string | null;
  due_at: string | null;
  done_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SalesGoal {
  id: string;
  name: string;
  metric: GoalMetric;
  target_value: number;
  starts_on: string; // YYYY-MM-DD
  ends_on: string; // YYYY-MM-DD
  owner: string | null;
  active: boolean;
  created_at: string;
}

// ----------------------------------------------------------------------------
// Etapy 2–4: partnerzy, szablony, content, reklamy, odprawy AI
// ----------------------------------------------------------------------------

export interface CrmPartner {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  instagram: string | null;
  commission_note: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type TemplateChannel = "ig_dm" | "email" | "telefon" | "wizyta" | "inne";

export interface CrmTemplate {
  id: string;
  name: string;
  channel: TemplateChannel;
  /** Krok sekwencji ręcznej: 1 = pierwszy kontakt, 2 = follow-up, ... */
  step: number;
  body: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type ContentChannel =
  | "tiktok"
  | "reels"
  | "shorts"
  | "linkedin"
  | "fb_grupy"
  | "youtube"
  | "inne";

export type ContentFormat = "rolka" | "post" | "story" | "longform";

export type ContentStatus =
  | "pomysl"
  | "zaakceptowane"
  | "do_nagrania"
  | "nagrane"
  | "opublikowane"
  | "archiwum";

export interface CrmContent {
  id: string;
  channel: ContentChannel;
  format: ContentFormat;
  hook: string | null;
  script_md: string | null;
  status: ContentStatus;
  planned_date: string | null; // YYYY-MM-DD
  published_date: string | null; // YYYY-MM-DD
  url: string | null;
  views: number | null;
  comments: number | null;
  saves: number | null;
  inquiries: number | null;
  leads: number | null;
  demos: number | null;
  created_at: string;
  updated_at: string;
}

export type AdsPlatform = "meta" | "google";

export interface CrmAdsLog {
  id: string;
  log_date: string; // YYYY-MM-DD
  platform: AdsPlatform;
  campaign: string;
  // numeric — PostgREST zwraca jako string; parsujemy na granicy w queries.
  spend: number;
  impressions: number | null;
  clicks: number | null;
  raw_leads: number;
  qualified_leads: number;
  demos: number;
  pilots: number;
  paid_customers: number;
  notes: string | null;
  created_at: string;
}

export interface CrmBriefing {
  id: string;
  briefing_date: string; // YYYY-MM-DD
  content_md: string;
  created_by: string;
  created_at: string;
}

export interface CrmSettings {
  id: 1;
  stale_after_days: number;
  stage_stuck_after_days: number;
  pilot_ending_soon_days: number;
  pilot_checkin_after_days: number;
  updated_at: string;
}
