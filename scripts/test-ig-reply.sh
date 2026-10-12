#!/bin/sh
# Test webhooka odpowiedzi z Instagrama (ManyChat -> Sztab).
# Użycie: sh scripts/test-ig-reply.sh <handle_z_bazy> ["treść odpowiedzi"]
# Token bierze z .env.local (INBOUND_WEBHOOK_SECRET). Handle spoza Bazy -> {"ok":false,"unknown":true}.
# UWAGA: handle z Bazy naprawdę awansuje lokal do Rozmów (tak jak klik "Odpowiedział?").
set -e
cd "$(dirname "$0")/.."
TOKEN=$(grep '^INBOUND_WEBHOOK_SECRET=' .env.local | cut -d= -f2- | tr -d '"')
[ -n "$TOKEN" ] || { echo "Brak INBOUND_WEBHOOK_SECRET w .env.local (npx vercel env pull .env.local)"; exit 1; }
HANDLE="${1:-profil_testowy_nie_istnieje}"; TEXT="${2:-test z terminala}"
URL="${SZTAB_URL:-https://sztab-scanova.vercel.app}/api/inbound/ig-reply"
curl -s -X POST "$URL" -H "content-type: application/json" -H "x-inbound-token: $TOKEN" \
  -d "{\"instagram\":\"$HANDLE\",\"text\":\"$TEXT\"}"; echo
