# Rolka Scanovy — montaż w HyperFrames (2026-10-14)

Trzy wersje tej samej rolki 9:16 (1080×1920) z nagrania Adama, grafiki i napisy generowane z HTML
(HyperFrames, wtyczka Claude Code). Jedno źródło scen, trzy projekty:

| Folder | Wersja | Układ |
|---|---|---|
| `rolka-scanova/` | **A · split** | góra 0–960: grafiki, dół: Adam (kadr 1080×960), napisy białe nad dolną krawędzią |
| `rolka-scanova-b/` | **B · full** | Adam na całym ekranie (kadr 9:16), grafiki jako nakładki w dolnej połowie, napisy nad nimi |
| `rolka-scanova-c/` | **C · pip** | cały ekran grafiki, napisy w pasie środkowym, Adam w kwadracie 380×380 w prawym dolnym rogu |

Foldery B i C mają dowiązania (`assets`, `compositions`) do `rolka-scanova/`, więc sceny i nagranie są w jednym miejscu.

## Pliki, które się edytuje

- `rolka-scanova/compositions/s1-huk.html … s4-cta.html` — cztery sceny (sub-kompozycje). Layout w jednostkach `cqw`,
  więc ta sama scena działa w slocie 1080×960 i jako nakładka. Zmienna `compact` = przezroczyste tło (wersja B).
  Czasy kroków w scenie (np. kiedy wjeżdża „pieczątka”) to zmienne `t2/t3/t4`, `tCard/tJutro/tFree/tBubble`,
  które `build.mjs` wylicza z transkrypcji.
- `rolka-scanova/timing.json` — nagranie (3 kadry), granice scen i słowa z czasem (napisy).
- `rolka-scanova/scripts/build.mjs` — generuje `index.html` dla A, B, C z `timing.json`. **Po każdej zmianie timing.json
  albo build.mjs: `node scripts/build.mjs`.**
- `rolka-scanova/BRIEF.md`, `design.md` — brief i zasady wyglądu.

## Nowe nagranie → gotowe filmy (krok po kroku)

```bash
cd videos/rolka-scanova
# 1. kadry z poziomego 4K (CX = gdzie w kadrze jest twarz, 0–100; dla IMG_6317 było 36 i 42)
sh scripts/przygotuj-nagranie.sh "../../docs/research-2026-10/NAGRANIE.mov" 36 42
# 2. transkrypcja (faster-whisper, model medium, po polsku) + granice scen → timing.json
python3 scripts/transkrypcja.py assets/adam-full.mp4
#    (nazwy własne sprawdzić w transkrypcja.txt: „Scanova”, „Wallet”)
# 3. trzy kompozycje
node scripts/build.mjs
# 4. kontrola i render (launcher wtyczki; L = plugin-cli.mjs z ~/.claude/plugins/cache/hyperframes/…)
node "$L" check && node "$L" render --quality looks --output ../renders/rolka-scanova.mp4
```

Podgląd w Studio (edycja na żywo, przesuwanie klipów): `node "$L" preview --background` w folderze wersji.

## Co z czego

- Zrzuty kart i powiadomienia: `rolka-scanova/assets/*.png` (z `docs/zrzuty/`, nazwa lokalu zamazana).
- Liczby w scenie 1 (357 opinii, 676 klientów) — panel klienta z 2026-10-13; nazwa klienta nie pada.
- Nagrania źródłowe (4K, poziome) leżą w `docs/research-2026-10/*.mov` i są poza gitem (`.gitignore`), tak samo
  `assets/*.mp4`, `renders/`, `snapshots/`.
