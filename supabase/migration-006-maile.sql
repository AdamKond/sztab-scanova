-- ============================================================================
-- SZTAB — Migracja 006: Maile (automatyczna zimna wysyłka do lokali).
-- Uruchom PO migracji 005.
--
-- Po co osobna tabela zamiast crm_leads: masowa kolejka mailowa (setki
-- adresów dziennie) zalałaby Rozmowy. Tu żyje tylko stan wysyłki per adres;
-- kto ODPOWIE, awansuje do crm_leads (source 'email') i dalej idzie
-- normalnym pipeline'em — dokładnie jak w Bazie DM (crm_dm_blitz).
--
-- Jeden wiersz = jeden adres e-mail (unikalny). Wiersz trzyma też "czarną
-- listę": odbicie, skarga, wypisanie — żeby ponowny import tego samego
-- adresu NIGDY nie wysłał drugiego maila.
-- ============================================================================

create table if not exists crm_mail_queue (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  -- domena adresu (bez www.) — limit "jeden lokal dziennie", ochrona przed
  -- wysłaniem 5 maili do jednej sieci w godzinę.
  domain text not null,
  name text not null check (char_length(name) between 1 and 160),
  city text,
  -- nisza z Bazy (pizza, kawiarnia, sushi/azja, restauracja…) — ustawia
  -- parametr kalkulatora w linku i segmentuje statystyki.
  niche text not null default 'restauracja',
  www text,
  instagram text,
  phone text,
  -- skąd adres: 'strona' (ze strony lokalu), 'gmaps' (Apify Google Maps),
  -- 'csv' (research), 'reczne' (wpisane w Sztabie)
  source text not null default 'csv',
  campaign text not null default 'mail-2026-11',

  -- Etap wysyłki. Zmieniają go WYŁĄCZNIE cron (wysyłka, skrzynka) i akcje
  -- w Sztabie. Wartości:
  --   oczekuje      — w kolejce, jeszcze nic nie poszło
  --   wyslany       — mail #1 poszedł, czekamy
  --   followup      — follow-up poszedł, czekamy
  --   zamkniety     — sekwencja skończona bez odpowiedzi (koniec, nie piszemy więcej)
  --   odpowiedzial  — odpowiedź (awans do crm_leads przez lead_id)
  --   odbil         — bounce (adres nie istnieje) — czarna lista
  --   skarga        — oznaczył jako spam — czarna lista
  --   wypisany      — kliknął "nie piszcie" / odpisał "nie" — czarna lista
  --   wstrzymany    — ręcznie zatrzymany w Sztabie
  --   blad          — wysyłka się nie udała (treść w last_error), cron spróbuje ponownie
  status text not null default 'oczekuje' check (
    status in ('oczekuje','wyslany','followup','zamkniety','odpowiedzial',
               'odbil','skarga','wypisany','wstrzymany','blad')
  ),

  -- Który krok sekwencji poszedł ostatnio (0 = nic, 1 = mail #1, 2 = follow-up, 3 = ostatni).
  step int not null default 0 check (step between 0 and 3),
  subject text,
  -- Skrzynka, z której poszedł mail #1 — follow-upy idą z TEJ SAMEJ skrzynki
  -- (wątek w jednej skrzynce, odpowiedź trafia tam, gdzie pierwszy mail).
  mailbox text,
  -- RFC Message-ID maila #1 — follow-up idzie z In-Reply-To/References,
  -- więc w skrzynce odbiorcy skleja się w jeden wątek.
  message_id text,
  sent_at timestamptz,
  step2_at timestamptz,
  step3_at timestamptz,
  last_step_at timestamptz,
  replied_at timestamptz,
  reply_excerpt text,
  bounced_at timestamptz,
  unsubscribed_at timestamptz,
  last_error text,
  -- liczba nieudanych prób wysyłki — po 3 wiersz zostaje w 'blad' na stałe
  attempts int not null default 0,
  -- notatka o lokalu z researchu (nie trafia do maila)
  note text,
  lead_id uuid references crm_leads(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_crm_mail_queue_status on crm_mail_queue(status, last_step_at);
create index if not exists idx_crm_mail_queue_domain on crm_mail_queue(domain);
create index if not exists idx_crm_mail_queue_campaign on crm_mail_queue(campaign);

drop trigger if exists trg_crm_mail_queue_updated on crm_mail_queue;
create trigger trg_crm_mail_queue_updated
before update on crm_mail_queue
for each row execute function crm_touch_updated_at();

alter table crm_mail_queue enable row level security;
revoke all on crm_mail_queue from anon, authenticated;

-- ----------------------------------------------------------------------------
-- Dziennik zdarzeń: każda wysyłka, odbicie, odpowiedź, wypisanie. Źródło
-- prawdy dla statystyk dziennych (ile poszło dziś z której skrzynki) —
-- cron liczy limit dzienny z tej tabeli, nie z pamięci procesu.
-- ----------------------------------------------------------------------------
create table if not exists crm_mail_events (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid references crm_mail_queue(id) on delete cascade,
  email text not null,
  -- 'wyslano' | 'blad' | 'odbicie' | 'odpowiedz' | 'wypisanie' | 'skarga' | 'cron' | 'test'
  kind text not null,
  step int,
  mailbox text,
  message_id text,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists idx_crm_mail_events_time on crm_mail_events(created_at desc);
create index if not exists idx_crm_mail_events_kind_time on crm_mail_events(kind, created_at desc);

alter table crm_mail_events enable row level security;
revoke all on crm_mail_events from anon, authenticated;

-- ----------------------------------------------------------------------------
-- Ustawienia wysyłki — singleton (id = 1). Zmieniane z ekranu Maile.
-- Sekrety (hasła skrzynek) NIE żyją w bazie — są w zmiennych środowiskowych.
-- ----------------------------------------------------------------------------
create table if not exists crm_mail_settings (
  id int primary key check (id = 1),
  -- globalny wyłącznik: true = cron nic nie wysyła (skrzynki nadal czyta)
  paused boolean not null default true,
  -- cel dzienny wszystkich skrzynek razem (mail #1 + follow-upy)
  daily_limit int not null default 150 check (daily_limit between 0 and 1000),
  -- rozgrzewka: od tej daty limit rośnie od warmup_start_limit o warmup_step
  -- dziennie aż do daily_limit; null = bez rozgrzewki
  warmup_start date,
  warmup_start_limit int not null default 20 check (warmup_start_limit between 1 and 1000),
  warmup_step int not null default 10 check (warmup_step between 1 and 200),
  -- po ilu dniach ciszy follow-up (krok 2) i ostatni mail (krok 3)
  followup_after_days int not null default 3 check (followup_after_days between 1 and 30),
  last_after_days int not null default 7 check (last_after_days between 1 and 60),
  -- okno wysyłki w czasie Warszawy; cron poza oknem nic nie wysyła
  send_from_hour int not null default 8 check (send_from_hour between 0 and 23),
  send_to_hour int not null default 16 check (send_to_hour between 1 and 24),
  weekdays_only boolean not null default true,
  -- wariant maila #1: 'pytanie' (krótkie pytanie o zgodę na szczegóły — bezpieczniej
  -- wg PKE i lepsze odpowiedzi) albo 'oferta' (pełny wariant C z linkiem)
  variant text not null default 'pytanie' check (variant in ('pytanie','oferta')),
  updated_at timestamptz not null default now()
);
insert into crm_mail_settings (id) values (1) on conflict (id) do nothing;

drop trigger if exists trg_crm_mail_settings_updated on crm_mail_settings;
create trigger trg_crm_mail_settings_updated
before update on crm_mail_settings
for each row execute function crm_touch_updated_at();

alter table crm_mail_settings enable row level security;
revoke all on crm_mail_settings from anon, authenticated;
