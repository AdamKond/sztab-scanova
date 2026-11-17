# Listy adresów do zimnych maili — listopad 2026

Wszystkie pliki `*-maile.csv` i `osm-*.csv` mają nagłówek `email,nazwa,miasto,nisza,www,uwaga`
i wchodzą do kolejki Maili jedną komendą (dry-run bez `--wykonaj`):

```
npx tsx scripts/import-maile.ts docs/research-2026-11 --zrodlo=strona --wykonaj --kampania=mail-2026-11
```

(katalog = wszystkie `.csv` w nim; pliki `*-bez-maila.csv` nie mają kolumny email, więc import je pomija).

| Plik | Skąd | Co |
|---|---|---|
| `kontakty-2026-09-maile.csv` | strony lokali z researchu wrześniowego (`docs/research-2026-09/kontakty.csv`) | adresy znalezione skryptem `znajdz-maile.ts` |
| `osm-<miasto>.csv` | OpenStreetMap | lokale z e-mailem wpisanym w OSM |
| `osm-<miasto>-bez-maila.csv` | OpenStreetMap | lokale ze stroną, bez e-maila → `znajdz-maile.ts` |
| `osm-<miasto>-bez-maila-maile.csv` | strony tych lokali | adresy znalezione na stronach |
| `osm-<miasto>.overpass.json` | surowa odpowiedź Overpass | do ponownego przeliczenia bez pytania serwera (`--z-pliku=`) |
| `rg-<miasto>.csv` | Restaurant Guru | lokale ze stroną (gdy serwis nie blokuje) |
| `apify-input-lublin.json` | — | gotowe wejście do Apify Google Maps (gdy wróci kredyt) |

Zasada: piszemy tylko na adresy, które lokal sam opublikował (strona, mapa). Skrypty odrzucają
adresy portali (pyszne, glovo…), techniczne (noreply, rodo…) i pliki złapane regexem.
