-- ============================================================================
-- SZTAB — Migracja 002: Etapy 2–4 (outbound, partnerzy, inbound, content,
-- reklamy, odprawy AI). Uruchom PO migration-001-core.sql.
--
-- Model bezpieczeństwa identyczny jak w 001: RLS włączone, zero polityk,
-- revoke all — dostęp wyłącznie przez service role za allowlistą.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Partnerzy — polecający z prowizją. Leady wskazują partnera przez partner_id.
-- ----------------------------------------------------------------------------
create table if not exists crm_partners (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 160),
  contact_name text,
  phone text,
  email text,
  instagram text,
  -- Ustalenia prowizyjne jako tekst ("10% MRR przez 6 mies."), nie liczby —
  -- na tym etapie każda umowa jest inna i sztywny model by kłamał.
  commission_note text,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table crm_leads add column if not exists partner_id uuid references crm_partners(id) on delete set null;
create index if not exists idx_crm_leads_partner on crm_leads(partner_id);

-- ----------------------------------------------------------------------------
-- Szablony wiadomości — sekwencja ręcznych kroków (DM → follow-up → telefon →
-- wizyta). ŻADNEJ automatycznej wysyłki: szablon się kopiuje, człowiek wysyła.
-- ----------------------------------------------------------------------------
create table if not exists crm_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 160),
  channel text not null default 'ig_dm' check (
    channel in ('ig_dm','email','telefon','wizyta','inne')
  ),
  -- Krok sekwencji: 1 = pierwszy kontakt, 2 = follow-up, 3 = telefon, ...
  step int not null default 1 check (step between 1 and 9),
  body text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Content — pipeline materiałów. Wyniki (views/leady/demo) wpisywane ręcznie;
-- żadnego scrapowania ani udawanych integracji.
-- ----------------------------------------------------------------------------
create table if not exists crm_content (
  id uuid primary key default gen_random_uuid(),
  channel text not null default 'reels' check (
    channel in ('tiktok','reels','shorts','linkedin','fb_grupy','youtube','inne')
  ),
  format text not null default 'rolka' check (
    format in ('rolka','post','story','longform')
  ),
  hook text,
  script_md text,
  status text not null default 'pomysl' check (
    status in ('pomysl','zaakceptowane','do_nagrania','nagrane','opublikowane','archiwum')
  ),
  planned_date date,
  published_date date,
  url text,
  views int check (views is null or views >= 0),
  comments int check (comments is null or comments >= 0),
  saves int check (saves is null or saves >= 0),
  -- Efekt biznesowy materiału, wpisywany ręcznie po fakcie.
  inquiries int check (inquiries is null or inquiries >= 0),
  leads int check (leads is null or leads >= 0),
  demos int check (demos is null or demos >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_crm_content_status on crm_content(status);
create index if not exists idx_crm_content_planned on crm_content(planned_date);

-- ----------------------------------------------------------------------------
-- Dziennik reklam — ręczny, per dzień + platforma + kampania.
-- CTR/CPC/CPL/koszt demo/CAC liczy kod. CPL to NIE koszt pozyskania klienta —
-- pilnuje tego warstwa metryk, nie baza.
-- ----------------------------------------------------------------------------
create table if not exists crm_ads_log (
  id uuid primary key default gen_random_uuid(),
  log_date date not null,
  platform text not null check (platform in ('meta','google')),
  campaign text not null default '',
  spend numeric(10,2) not null default 0 check (spend >= 0),
  impressions int check (impressions is null or impressions >= 0),
  clicks int check (clicks is null or clicks >= 0),
  raw_leads int not null default 0 check (raw_leads >= 0),
  qualified_leads int not null default 0 check (qualified_leads >= 0),
  demos int not null default 0 check (demos >= 0),
  pilots int not null default 0 check (pilots >= 0),
  paid_customers int not null default 0 check (paid_customers >= 0),
  notes text,
  created_at timestamptz not null default now(),
  unique (log_date, platform, campaign)
);
create index if not exists idx_crm_ads_log_date on crm_ads_log(log_date desc);

-- ----------------------------------------------------------------------------
-- Odprawy AI — zapis wygenerowanych odpraw (audyt + brak ponownego płacenia
-- za ten sam dzień). Odprawa to sugestia AI, nie fakt — UI musi to oznaczać.
-- ----------------------------------------------------------------------------
create table if not exists crm_briefings (
  id uuid primary key default gen_random_uuid(),
  briefing_date date not null unique,
  content_md text not null,
  created_by text not null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Triggery updated_at (funkcja crm_touch_updated_at istnieje z migracji 001).
-- ----------------------------------------------------------------------------
drop trigger if exists trg_crm_partners_updated on crm_partners;
create trigger trg_crm_partners_updated
before update on crm_partners
for each row execute function crm_touch_updated_at();

drop trigger if exists trg_crm_templates_updated on crm_templates;
create trigger trg_crm_templates_updated
before update on crm_templates
for each row execute function crm_touch_updated_at();

drop trigger if exists trg_crm_content_updated on crm_content;
create trigger trg_crm_content_updated
before update on crm_content
for each row execute function crm_touch_updated_at();

-- ----------------------------------------------------------------------------
-- RLS + revoke — jak w 001.
-- ----------------------------------------------------------------------------
alter table crm_partners enable row level security;
alter table crm_templates enable row level security;
alter table crm_content enable row level security;
alter table crm_ads_log enable row level security;
alter table crm_briefings enable row level security;

revoke all on crm_partners, crm_templates, crm_content, crm_ads_log, crm_briefings
  from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
