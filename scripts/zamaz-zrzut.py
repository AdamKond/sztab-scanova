#!/usr/bin/env python3
"""Zamazuje fragmenty zrzutu ekranu (nazwy lokalu, imiona, numery kart) przed wrzuceniem na tablicę.

Użycie:
  python3 scripts/zamaz-zrzut.py wejscie.png wyjscie.png x1,y1,x2,y2 [x1,y1,x2,y2 ...] [--blur]
Współrzędne w pikselach oryginału (lewy-górny, prawy-dolny). Domyślnie pole zalewa się kolorem tła
spod lewego-górnego rogu pola (wygląda jak puste miejsce); z --blur zamiast tego rozmywa.
"""
import sys
from PIL import Image, ImageFilter

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    blur = "--blur" in sys.argv
    if len(args) < 3:
        print(__doc__); sys.exit(1)
    src, dst, boxes = args[0], args[1], args[2:]
    im = Image.open(src).convert("RGB")
    for b in boxes:
        x1, y1, x2, y2 = [int(v) for v in b.split(",")]
        if blur:
            region = im.crop((x1, y1, x2, y2)).filter(ImageFilter.GaussianBlur(14))
            im.paste(region, (x1, y1))
        else:
            bg = im.getpixel((x1 + 2, y1 + 2))
            im.paste(bg, (x1, y1, x2, y2))
    im.save(dst)
    print(f"zapisano {dst}, {len(boxes)} pól")

if __name__ == "__main__":
    main()
