---
name: projekt-sztab-scanova
description: "Stan projektu Sztab (CRM sprzedaży Scanovy) po przebudowie 2026-09-21 — ścieżki, deploy, co zostało do zrobienia"
metadata: 
  node_type: memory
  type: project
  originSessionId: 9bf38783-50ef-4ef5-a43a-9d32714431c1
  modified: 2026-09-27T16:46:35.073Z
---

Folder: `C:\Users\Adam\Desktop\Sztab Scanova` (repo github.com/AdamKond/sztab-scanova, gałąź main).
Obok na Pulpicie: `Serce Mamy` (repo SERCEMAMY, strona HTML) i `AI Recepcjonista` (repo ai-recepcjonista,
telefoniczny recepcjonista ElevenLabs dla stowarzyszenia Serce Mamy).

Deploy: Vercel, zespół absolusq-8712s-projects, projekt sztab-scanova → https://sztab-scanova.vercel.app
(`npx vercel --prod` z folderu; repo NIE jest połączone z Vercelem przez Git). Klucze: `npx vercel env pull .env.local`.
Supabase: osobny projekt; migracje SQL uruchamia się ręcznie w SQL Editorze (001–005). Nie robić DDL ze skryptów.

2026-09-21 przebudowa (commit 4139609): 18 ekranów → 4 (Dziś / Rozmowy / Klienci / Baza), jasny design,
krótkie DM-y per nisza w `lib/crm/dm-copy.ts`, 6 kroków rozmowy w `lib/crm/steps.ts`, kolejka 30 DM/dzień
w `lib/crm/blitz.ts`. Schemat bazy bez zmian. Dane: 262 lokale w `crm_dm_blitz`, 0 wysłanych na start;
22 leady „nowy" z sierpnia są w Rozmowach jako „Stare importy" (odpięte od Bazy, promote podpina po instagramie).

2026-09-21 wieczorem: migracja 005 uruchomiona przez Adama; pierwsze DM-y wysłane (Rykowisko, Canotto).
Webhook odpowiedzi z IG: POST /api/inbound/ig-reply {instagram, text}, token INBOUND_WEBHOOK_SECRET
(w .env.local i na Vercelu; NIE zapisywać wartości w pamięci). Do podpięcia pod ManyChat External Request
albo webhook Meta. Kopiowanie do schowka: zawsze synchroniczne (copySync) PRZED window.open.

Integracja Instagram (Meta, bez ManyChat — decyzja Adama): /api/meta/instagram (GET verify, POST webhook),
lib/meta/*. Na Vercelu jest META_VERIFY_TOKEN; brakuje META_APP_SECRET, META_IG_ACCESS_TOKEN, META_IG_USER_ID,
META_AUTO_REPLY=1, NEXT_PUBLIC_FILM_URL — Adam musi założyć aplikację w developers.facebook.com
(Instagram API with Instagram Login, uprawnienia instagram_business_basic + instagram_business_manage_messages)
i przejść App Review, żeby webhook działał dla obcych kont.

Research 2026-09-21 (5 agentów Opus): Baza 262 → 589 lokali (Lublin, lubelskie, Rzeszów/Kielce/Radom, sieci
2+ lokali), >320 z hookiem "HOOK:" w dm_text. Import: `npx tsx scripts/import-leady-baza.ts <plik|katalog> --wykonaj`
(format @handle | nazwa | miasto | nisza | obs | hook; sekcje ### pomijane). Plan dnia: docs/plan-2026-09-21.md,
film: docs/filmik-scenariusz.md. Pliki researchu z NIEPEWNYMI (~140 lokali do ręcznego sprawdzenia) były w scratchpadzie sesji.
Subagenty mają limit 200 WebSearch/sesja — przy kolejnym researchu dzielić na więcej mniejszych agentów.

Cennik Scanovy (ze źródła strony, 2026-09-22): Standard 250 zł, Pro 339 zł (opinie Google, geo-przypomnienia,
najczęściej wybierany), Max 590 zł — /mies. za lokal, bez "netto" na stronie, 30 dni za darmo, bez umowy, wdrożenie do 3 dni,
stojak i karty w cenie. Strona: repo AdamKond/scanova-tech sklonowane do `C:\Users\Adam\Desktop\Scanova Strona`,
deploy automatyczny z main na Vercelu (cleanUrls). Dodany `kalkulator.html` → https://scanova.tech/kalkulator
(parametry ?g&r&m&p&n&plan). Teksty strony żyją w scanova-shared.js (obiekt t.price, faqs).

Mechanika produktu (z repo scanova-nfc-loyalty): +1 pieczątka za opinię Google przy dołączaniu do karty, program
poleceń (+pieczątka), panelowy RewardCalculator: marża domyślnie 65%, koszt nagrody ≈40% paragonu, zdrowo 5–10% obrotu
cyklu, zwrot nagrody = koszt/(paragon×marża), avg_ticket domyślnie 25 zł. Kalkulator publiczny i tablica używają:
karta u 25% gości, ~3,3 opinii/100 wizyt (sufit 200), presety branżowe (kawiarnia 80/18/65%/10 pieczątek/4 zł itd.).
Tablica do filmiku = jedna przewijana plansza (artefakt "Tablica Scanovy" + docs/tablica-scanovy.html); ?film=1 chowa pasek.
Adam woli scroll zamiast slajdów do nagrania z ekranu.

Runda 2 (2026-09-22): Baza 589 → 706 (Radom 60, Kielce, Rzeszów, Lublin 18, zweryfikowane 28). WebSearch w sesji
wyczerpuje się szybko (200/sesja dzielone z subagentami) — agenci pracują wtedy przez WebFetch (restaurantguru.com,
lublininfo sitemap, Glovo); Instagram/Pyszne/Wolt blokują fetch. Agenci Opus czasem piszą hooki BEZ polskich znaków —
sprawdzać regexem [ąćęłńóśźż] i poprawiać (scripts/popraw-hooki.ts nadpisuje nazwę/hook po handle).
Kontakty e-mail/telefon: docs/research-2026-09/kontakty.csv (126 lokali, 60 e-mail, 89 tel.), szablony maili docs/mail-zimny.md.
~120 lokali NIEPEWNE (bez potwierdzonego IG) w docs/research-2026-09/ (runda 1 i runda-2).

Weryfikacja 2026-09-22: Instagram przekierowuje KAŻDE anonimowe wejście (także nieistniejące profile) do logowania —
istnienia handle'i nie da się sprawdzić maszynowo z tego komputera ani z subagentów; bezpiecznik = "Wyślij DM" otwiera
profil, Adam usuwa nieistniejące. E-maile/telefony da się weryfikować WebFetchem strony źródłowej (51/74 potwierdzone).
Raporty: docs/research-2026-09/weryfikacja-leadow.md, kontakty.csv ma kolumny *_status.

2026-09-27: Adam zmienia komputer. Cały kontekst przeniesiony do repo: `docs/START.md` (stan, decyzje, co dalej,
pułapki), `scripts/setup-nowy-komputer.ps1` (winget, gh/vercel login, klony, env pull, kopia pamięci),
`docs/pamiec/` (kopia tych plików pamięci). Na nowym komputerze: najpierw czytać docs/START.md.
Stan Bazy: 702 lokale po weryfikacji (duplikaty, nisze, hooki poprawione). Cena w odpowiedziach już wpisana (250/339/590).

Do zrobienia dalej (ustalone z Adamem): filmik → NEXT_PUBLIC_FILM_URL na Vercelu; wysyłka DM-ów i maili
(51 potwierdzonych adresów); Meta/bot odłożone (bez ManyChat). Bot do wysyłki DM = NIE (blokada konta IG).

**Why:** Sztab był nieużywany, bo nie mówił, co dziś zrobić; nowy koncept = jedna kolejka.
**How to apply:** nowe funkcje dokładać do 4 ekranów, nie tworzyć nowych; teksty DM edytować w dm-copy.ts.
Zob. [[user-adam-scanova]].
