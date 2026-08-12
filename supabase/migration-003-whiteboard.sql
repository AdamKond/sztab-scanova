-- ============================================================================
-- SZTAB — Migracja 003: Whiteboard (tablica strategii).
-- Uruchom PO migracjach 001 i 002.
--
-- Po co osobna tabela zamiast pliku w repo: strategia zmienia się w trakcie
-- pracy i mają ją edytować obie osoby z telefonu, bez deployu.
-- ============================================================================

create table if not exists crm_notes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  content_md text not null default '',
  -- Kolejność ustalana ręcznie: najważniejsze rzeczy mają być na górze,
  -- a "najważniejsze" zmienia się częściej niż treść.
  sort_order int not null default 0,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_crm_notes_order on crm_notes(sort_order, created_at);

drop trigger if exists trg_crm_notes_updated on crm_notes;
create trigger trg_crm_notes_updated
before update on crm_notes
for each row execute function crm_touch_updated_at();

alter table crm_notes enable row level security;
revoke all on crm_notes from anon, authenticated;

-- ----------------------------------------------------------------------------
-- Zasiew: strategia, od której zaczynaliśmy. Wchodzi tylko do pustej tabeli,
-- więc ponowne uruchomienie migracji nie nadpisze tego, co dopiszecie.
-- ----------------------------------------------------------------------------
insert into crm_notes (title, content_md, sort_order)
select * from (values
  (
    'Po co jest SZTAB',
    E'System operacyjny sprzedaży dla dwóch osób: Adam i Oliwier.\n\nMa codziennie odpowiadać na pytania:\n\n1. Z kim trzeba skontaktować się dzisiaj?\n2. Które firmy są najlepszym dopasowaniem do ICP?\n3. Na którym etapie tracimy potencjalnych klientów?\n4. Ile demo zamienia się w piloty, a ile pilotów w płatne abonamenty?\n5. Ile MRR pozyskaliśmy i z jakiego kanału?\n6. Jak długo trwa sprzedaż od pierwszego kontaktu do płatności?\n7. Które leady stygną i nie mają następnego kroku?\n8. Które kanały dają płatnych klientów, a nie tylko tanie formularze?\n\nSystem premiuje rozmowy z decydentami, uruchomione piloty i płatnych klientów — nie samą liczbę aktywności.',
    10
  ),
  (
    'ICP — kogo szukamy',
    E'Niezależne, lokalne firmy z wysoką częstotliwością powrotów:\n\n- kawiarnie, piekarnie, cukiernie\n- sushi, lunchownie, fast casual, pizzerie\n- lokalne sieci gastro 2–8 punktów\n- później małe sieci beauty i barber\n\n**Najwyższy priorytet (leady A)** — firmy, które:\n\n- mają min. 2 lokalizacje albo duży ruch w jednym punkcie\n- robią ok. 100+ transakcji dziennie łącznie\n- naturalnie zobaczą powrót klienta w 7–30 dni\n- mają dostępnego właściciela lub decydenta\n- dbają o Instagram i opinie Google\n- nie mają dobrego programu albo są na papierze\n- są gotowe zaangażować personel w proponowanie programu',
    20
  ),
  (
    'Czego NIE robimy',
    E'- nie wysyłamy automatycznie Instagram DM\n- nie logujemy się do prywatnych kont społecznościowych\n- nie scrapujemy Instagrama ani Google Maps\n- nie udajemy integracji z Meta/Google Ads\n- nie wysyłamy kampanii do klientów końcowych lokali\n- nie łączymy się z produkcyjną bazą SCANOVY\n- nie zastępujemy księgowości ani fakturowania\n\nPilot to nie płatny klient. CPL to nie koszt pozyskania klienta.',
    30
  ),
  (
    'Notatki bieżące',
    E'Miejsce na to, co akurat ustalacie: hipotezy, wnioski z rozmów, pomysły na eksperymenty.\n\nMożecie tu trzymać cokolwiek — tablica jest Wasza.',
    40
  )
) as seed(title, content_md, sort_order)
where not exists (select 1 from crm_notes);
