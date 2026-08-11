-- ============================================================================
-- SZTAB — CRM sprzedaży i marketingu SCANOVY. Migracja 001: rdzeń.
-- Uruchom RAZ w nowym, OSOBNYM projekcie Supabase (eu-central-1)
-- przez SQL Editor -> Run. Szczegóły: supabase/README.md.
--
-- Model bezpieczeństwa: RLS włączone, ZERO polityk + revoke all.
-- Dane czyta i mutuje wyłącznie kod serwerowy z service role,
-- za allowlistą STAFF_EMAILS / STAFF_USER_IDS. Anon i authenticated
-- nie mają żadnego dostępu — to celowe ("pas i szelki").
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Leady / firmy
-- ----------------------------------------------------------------------------
create table if not exists crm_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 160),
  -- normalized_name ustawia zawsze kod serwerowy (trim, lowercase, pojedyncze
  -- spacje, bez końcowej interpunkcji) — służy do wykrywania duplikatów.
  normalized_name text not null,
  category text,
  city text,
  district text,
  address text,
  instagram text,
  phone text,
  email text,
  www text,
  google_rating numeric(2,1) check (google_rating is null or google_rating between 0 and 5),

  -- Kwalifikacja ICP: skala firmy i obecny program lojalnościowy.
  locations_count int not null default 1 check (locations_count > 0),
  estimated_daily_transactions int check (
    estimated_daily_transactions is null or estimated_daily_transactions >= 0
  ),
  current_loyalty text check (
    current_loyalty is null or current_loyalty in
      ('brak','papier','aplikacja','wallet','pos','inne')
  ),
  decision_maker_name text,
  decision_maker_role text,

  source text not null default 'teren' check (
    source in ('teren','ig_dm','telefon','email','ads_meta','ads_google',
               'polecenie','partner','inbound','content','inne')
  ),
  source_detail text,
  campaign text,
  referred_by uuid references crm_leads(id) on delete set null,

  status text not null default 'nowy' check (
    status in ('nowy','proba_kontaktu','kontakt_zdecydentem','analiza_potrzeb',
               'demo_umowione','demo_wykonane','oferta','pilot_umowiony',
               'pilot_aktywny','platny_klient','followup_pozniej','utracony',
               'zdyskwalifikowany','churn')
  ),
  priority text not null default 'B' check (priority in ('A','B','C','D')),
  qualification_note text,
  owner text,

  next_action text,
  next_action_at timestamptz,
  -- last_activity_at utrzymuje trigger na crm_activities — nie kod aplikacji,
  -- żeby żadna ścieżka zapisu nie mogła o tym zapomnieć (grzech starego Sztabu).
  last_activity_at timestamptz,

  -- Pilot i płatność. Pilot NIE jest płatnym klientem.
  pilot_started_at timestamptz,
  pilot_ends_at timestamptz,
  paid_at timestamptz,
  plan text,
  monthly_revenue numeric(10,2) check (monthly_revenue is null or monthly_revenue >= 0),
  churned_at timestamptz,
  lost_reason text,
  disqualification_reason text,

  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indeks duplikatów celowo NIE jest unikalny: dwie różne firmy mogą mieć
-- tę samą nazwę w jednym mieście — import pokazuje niepewne dopasowania
-- użytkownikowi zamiast scalać automatycznie.
create index if not exists idx_crm_leads_normalized_city
  on crm_leads(normalized_name, coalesce(city, ''));
create index if not exists idx_crm_leads_status on crm_leads(status);
create index if not exists idx_crm_leads_priority on crm_leads(priority);
create index if not exists idx_crm_leads_next_action on crm_leads(next_action_at);
create index if not exists idx_crm_leads_owner on crm_leads(owner);
create index if not exists idx_crm_leads_source on crm_leads(source);
-- Domyślne sortowanie listy leadów — bez tego pełny skan przy każdym wejściu.
create index if not exists idx_crm_leads_updated on crm_leads(updated_at desc);

-- ----------------------------------------------------------------------------
-- Historia etapów — źródło prawdy dla konwersji i czasu w etapie.
-- Wypełniana triggerem, więc powstaje też przy ręcznym SQL.
-- ----------------------------------------------------------------------------
create table if not exists crm_stage_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references crm_leads(id) on delete cascade,
  from_status text,
  to_status text not null,
  -- changed_by uzupełnia server action tuż po zmianie statusu (trigger działa
  -- z service role i nie zna autora). Null = zmiana spoza aplikacji.
  changed_by text,
  changed_at timestamptz not null default now()
);
create index if not exists idx_crm_stage_history_lead_time
  on crm_stage_history(lead_id, changed_at);

-- ----------------------------------------------------------------------------
-- Aktywności sprzedażowe. lead_id nullable — szybki wpis z terenu
-- bez zakładania leada.
-- ----------------------------------------------------------------------------
create table if not exists crm_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references crm_leads(id) on delete cascade,
  type text not null check (
    type in ('wizyta','ig_dm','ig_followup','telefon','email','whatsapp',
             'demo','spotkanie','oferta','pilot_checkin','notatka')
  ),
  outcome text check (
    outcome is null or outcome in
      ('brak_odpowiedzi','brak_decydenta','kontakt_zdecydentem','zainteresowany',
       'followup_umowiony','demo_umowione','oferta_wyslana','pilot_umowiony',
       'pilot_start','platnosc','odmowa','inne')
  ),
  note text,
  -- happened_at edytowalne — wieczorne uzupełnianie wpisów z dnia.
  happened_at timestamptz not null default now(),
  created_by text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_crm_activities_happened on crm_activities(happened_at desc);
create index if not exists idx_crm_activities_lead on crm_activities(lead_id, happened_at desc);
-- KPI "kto ile robi" liczy po autorze i dacie.
create index if not exists idx_crm_activities_author on crm_activities(created_by, happened_at desc);

-- ----------------------------------------------------------------------------
-- Zadania / follow-upy
-- ----------------------------------------------------------------------------
create table if not exists crm_tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references crm_leads(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 240),
  status text not null default 'otwarte' check (status in ('otwarte','zrobione','anulowane')),
  priority text not null default 'normalny' check (priority in ('niski','normalny','wysoki')),
  assigned_to text,
  due_at timestamptz,
  done_at timestamptz,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_crm_tasks_due on crm_tasks(status, due_at);
create index if not exists idx_crm_tasks_lead on crm_tasks(lead_id);

-- ----------------------------------------------------------------------------
-- Cele — edytowalne w UI, bez zakodowanych celów sprintu w schemacie.
-- Celowo NIE seedujemy żadnych wartości (lekcja ze starego Sztabu, gdzie
-- "6 wizyt / 20 DM" żyło w trzech miejscach naraz).
-- ----------------------------------------------------------------------------
create table if not exists sales_goals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  metric text not null check (
    metric in ('aktywnosci','kontakty_z_decydentem','demo','piloty','platni_klienci','mrr')
  ),
  target_value numeric(12,2) not null check (target_value >= 0),
  starts_on date not null,
  ends_on date not null,
  owner text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create index if not exists idx_sales_goals_active on sales_goals(active, starts_on, ends_on);

-- ----------------------------------------------------------------------------
-- Ustawienia — progi operacyjne konfigurowalne bez deployu.
-- Singleton (id = 1).
-- ----------------------------------------------------------------------------
create table if not exists crm_settings (
  id int primary key default 1 check (id = 1),
  -- Po ilu dniach bez aktywności otwarty lead uznawany jest za "stygnący".
  stale_after_days int not null default 5 check (stale_after_days between 1 and 90),
  -- Po ilu dniach w tym samym etapie lead "zalega" na ekranie Pipeline.
  stage_stuck_after_days int not null default 14 check (stage_stuck_after_days between 1 and 365),
  -- Ile dni przed końcem pilota pokazywać go jako "kończący się".
  pilot_ending_soon_days int not null default 7 check (pilot_ending_soon_days between 1 and 60),
  -- Po ilu dniach bez check-inu aktywny pilot wymaga uwagi.
  pilot_checkin_after_days int not null default 7 check (pilot_checkin_after_days between 1 and 60),
  updated_at timestamptz not null default now()
);
insert into crm_settings (id) values (1) on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Triggery utrzymujące spójność — w bazie, nie w aplikacji, żeby żadna
-- zapomniana ścieżka kodu nie mogła zepsuć sortowania ani historii.
-- ----------------------------------------------------------------------------
create or replace function crm_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_crm_leads_updated on crm_leads;
create trigger trg_crm_leads_updated
before update on crm_leads
for each row execute function crm_touch_updated_at();

drop trigger if exists trg_crm_tasks_updated on crm_tasks;
create trigger trg_crm_tasks_updated
before update on crm_tasks
for each row execute function crm_touch_updated_at();

drop trigger if exists trg_crm_settings_updated on crm_settings;
create trigger trg_crm_settings_updated
before update on crm_settings
for each row execute function crm_touch_updated_at();

create or replace function crm_track_status_change()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    insert into crm_stage_history(lead_id, from_status, to_status)
    values (new.id, null, new.status);
  elsif new.status is distinct from old.status then
    insert into crm_stage_history(lead_id, from_status, to_status)
    values (new.id, old.status, new.status);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_crm_leads_status_history on crm_leads;
create trigger trg_crm_leads_status_history
after insert or update of status on crm_leads
for each row execute function crm_track_status_change();

create or replace function crm_sync_last_activity()
returns trigger language plpgsql as $$
begin
  if new.lead_id is not null then
    update crm_leads
       set last_activity_at = greatest(
         coalesce(last_activity_at, '-infinity'::timestamptz),
         new.happened_at
       )
     where id = new.lead_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_crm_activity_last_seen on crm_activities;
create trigger trg_crm_activity_last_seen
after insert on crm_activities
for each row execute function crm_sync_last_activity();

-- ----------------------------------------------------------------------------
-- RLS: włączone, zero polityk, revoke all. Jedyna droga do danych to
-- service role w zweryfikowanym kodzie serwerowym.
-- ----------------------------------------------------------------------------
alter table crm_leads enable row level security;
alter table crm_stage_history enable row level security;
alter table crm_activities enable row level security;
alter table crm_tasks enable row level security;
alter table sales_goals enable row level security;
alter table crm_settings enable row level security;

revoke all on crm_leads, crm_stage_history, crm_activities, crm_tasks,
  sales_goals, crm_settings
  from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
