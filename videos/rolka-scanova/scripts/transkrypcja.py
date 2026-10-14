#!/usr/bin/env python3
"""Transkrypcja nagrania Adama (faster-whisper, słowa z czasem) + automatyczne granice 4 plansz.

Użycie:  python3 scripts/transkrypcja.py assets/adam.mp4 [--model small|medium|large-v3]
Wynik:   timing.json (pole captions = lista słów {w,s,e}; scenes[].start/end dopasowane do pierwszych
         słów każdej planszy), transkrypcja.txt do sprawdzenia oczami.
Pierwsze uruchomienie pobiera model (small ~460 MB, medium ~1.5 GB).
"""
import json, re, subprocess, sys, unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MODEL = "medium"
for i, a in enumerate(sys.argv):
    if a == "--model" and i + 1 < len(sys.argv):
        MODEL = sys.argv[i + 1]
src = next((a for a in sys.argv[1:] if not a.startswith("--") and a != MODEL), "assets/adam.mp4")

# Pierwsze słowa każdej planszy (po nich ustawiamy start sceny).
SCENE_HEADS = [
    ("s1-huk", "jeden z naszych klientów"),
    ("s2-karta", "tworzymy cyfrowe karty"),
    ("s3-push", "możesz też wysłać"),
    ("s4-cta", "jeśli chcesz zobaczyć"),
]

def norm(s):
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9 ]+", " ", s.replace("ł", "l")).strip()

def main():
    from faster_whisper import WhisperModel
    dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(ROOT / src)]).decode().strip())
    model = WhisperModel(MODEL, device="cpu", compute_type="int8")
    segments, info = model.transcribe(str(ROOT / src), language="pl", word_timestamps=True, vad_filter=True, beam_size=5)
    words = []
    for seg in segments:
        for w in seg.words or []:
            t = w.word.strip()
            if t:
                words.append({"w": t, "s": round(w.start, 2), "e": round(w.end, 2)})
    text = " ".join(x["w"] for x in words)
    (ROOT / "transkrypcja.txt").write_text(text + "\n", encoding="utf8")
    print(f"słów: {len(words)}, długość: {dur:.1f}s")
    print(text[:300] + ("…" if len(text) > 300 else ""))

    # granice scen: pierwsze wystąpienie frazy (po normalizacji) w ciągu słów
    normwords = [norm(x["w"]) for x in words]
    joined = " ".join(normwords)
    starts = []
    for sid, head in SCENE_HEADS:
        h = norm(head)
        idx = joined.find(h)
        if idx < 0:
            print(f"UWAGA: nie znalazłem początku planszy {sid} („{head}”) — ustaw ręcznie w timing.json")
            starts.append(None); continue
        wi = joined[:idx].count(" ") if idx > 0 else 0
        starts.append(words[wi]["s"])
    timing = json.loads((ROOT / "timing.json").read_text(encoding="utf8"))
    timing["video"]["src"] = src
    timing["video"]["duration"] = round(dur, 2)
    timing["captions"] = words
    for i, sc in enumerate(timing["scenes"]):
        if starts[i] is not None:
            sc["start"] = round(max(0.0, starts[i] - 0.15), 2) if i else 0.0
    for i, sc in enumerate(timing["scenes"]):
        sc["end"] = timing["scenes"][i + 1]["start"] if i + 1 < len(timing["scenes"]) else round(dur, 2)
    (ROOT / "timing.json").write_text(json.dumps(timing, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    print("sceny:", [(s["id"], s["start"], s["end"]) for s in timing["scenes"]])
    print("zapisano timing.json i transkrypcja.txt → teraz: node scripts/build.mjs")

if __name__ == "__main__":
    main()
