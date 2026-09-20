-- ============================================================================
-- SZTAB — Migracja 005: Lejek DM — follow-up dla lokali bez odpowiedzi.
-- Uruchom PO migracji 004.
--
-- Lejek kampanii: DM #1 (ręcznie) → po 3 dniach bez odpowiedzi follow-up
-- (ręcznie, z kolejki "Follow-up" na ekranie Wysyłka DM) → odpowiedź awansuje
-- lokal do crm_leads i dalej idzie normalnym pipeline'em (filmik → spotkanie).
-- Etap wiersza wyliczamy z timestampów — nie ma osobnej kolumny statusu,
-- więc nie może się rozjechać z rzeczywistością.
-- ============================================================================

alter table crm_dm_blitz
  add column if not exists followup_sent_at timestamptz,
  add column if not exists followup_sent_by text;
