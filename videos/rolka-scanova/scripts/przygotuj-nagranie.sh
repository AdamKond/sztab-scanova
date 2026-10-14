#!/bin/sh
# Z poziomego 4K (3840x2160) robi trzy pionowe kadry pod trzy wersje rolki:
#   assets/adam-split.mp4  1080x960   (dół wersji A, szerszy kadr)
#   assets/adam-full.mp4   1080x1920  (wersja B, ciasny kadr 9:16)
#   assets/adam-pip.mp4    1080x1080  (wersja C, kwadrat na twarz)
# Użycie: sh scripts/przygotuj-nagranie.sh "<plik.mov>" [CX dla full/pip, domyślnie 50] [CX dla split, domyślnie = pierwszy]
#   CX = gdzie w poziomym kadrze jest twarz (0 = lewa krawędź, 100 = prawa); 6317 → 36 / 42
set -e
SRC="$1"; CX="${2:-50}"; CXS="${3:-$CX}"
[ -f "$SRC" ] || { echo "brak pliku: $SRC"; exit 1; }
cd "$(dirname "$0")/.."
# kadr: skaluje tak, żeby wysokość = docelowa, potem wycina szerokość wokół środka CX
crop() { # $1 szer, $2 wys, $3 wyjście, $4 CX
  ffmpeg -y -v error -i "$SRC" -vf "scale=-2:$2,crop=$1:$2:(iw-$1)*$4/100:0" -r 30 -c:v libx264 -preset fast -crf 19 -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart "$3"
  echo "ok $3"
}
crop 1080 960  assets/adam-split.mp4 "$CXS"
crop 1080 1920 assets/adam-full.mp4 "$CX"
crop 1080 1080 assets/adam-pip.mp4 "$CX"
