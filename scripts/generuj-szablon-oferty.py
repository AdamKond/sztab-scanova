#!/usr/bin/env python3
# Generuje lib/crm/mail/templates/oferta.ts z oferta.html + oferta.txt (patrz komentarz w .ts).
import json, pathlib
d = pathlib.Path(__file__).resolve().parent.parent / "lib/crm/mail/templates"
html = (d / "oferta.html").read_text(encoding="utf-8").strip()
txt = (d / "oferta.txt").read_text(encoding="utf-8").strip()
(d / "oferta.ts").write_text(
    "// WYGENEROWANE z lib/crm/mail/templates/oferta.html i oferta.txt (mail ofertowy Adama,\n"
    "// wysłany 2026-11-21 z Gmaila jako \"kolejnh mail wersja\"). Nie edytować ręcznie —\n"
    "// poprawki robić w .html/.txt i uruchomić: python3 scripts/generuj-szablon-oferty.py\n"
    "// Wstawiany jako string, żeby trafił do bundla serwerowego bez czytania plików w runtime.\n\n"
    f"export const OFFER_HTML = {json.dumps(html, ensure_ascii=False)};\n\n"
    f"export const OFFER_TEXT = {json.dumps(txt, ensure_ascii=False)};\n",
    encoding="utf-8",
)
print("OK:", d / "oferta.ts")
