#!/usr/bin/env bash
# Wgrywa zmienne środowiskowe SZTAB-u z .env.local do projektu na Vercelu.
#
# Po co: klikanie sześciu zmiennych w dashboardzie to sześć okazji na literówkę.
# Skrypt bierze wartości z pliku, który i tak masz lokalnie, i wysyła je do
# wszystkich środowisk (production, preview, development).
#
# Użycie:
#   1) uzupełnij .env.local wg supabase/README.md
#   2) bash scripts/vercel-env.sh
#   3) npx vercel deploy --prod   (żeby nowy build zobaczył zmienne)

set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env.local ]; then
  echo "Brak .env.local — skopiuj .env.example i uzupełnij (patrz supabase/README.md)." >&2
  exit 1
fi

# Biała lista: świadomie NIE wysyłamy wszystkiego z .env.local
# (jest tam m.in. VERCEL_OIDC_TOKEN, który Vercel zarządza sam).
VARS=(
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_URL
  SUPABASE_SERVICE_KEY
  STAFF_EMAILS
  STAFF_USER_IDS
  ANTHROPIC_API_KEY
  SZTAB_AI_MODEL
  INBOUND_WEBHOOK_SECRET
)

for NAME in "${VARS[@]}"; do
  # Wartość bierzemy z pliku, nie ze środowiska powłoki — mniej niespodzianek.
  VALUE=$(grep -E "^${NAME}=" .env.local | head -1 | cut -d= -f2- || true)
  if [ -z "$VALUE" ]; then
    echo "· pomijam ${NAME} (pusta w .env.local)"
    continue
  fi
  for ENVNAME in production preview development; do
    # Nadpisanie istniejącej zmiennej: najpierw usuwamy (błąd ignorujemy,
    # bo przy pierwszym wgraniu nie ma czego usuwać).
    npx --yes vercel@latest env rm "$NAME" "$ENVNAME" --yes >/dev/null 2>&1 || true
    printf '%s' "$VALUE" | npx --yes vercel@latest env add "$NAME" "$ENVNAME" >/dev/null
  done
  echo "✓ ${NAME}"
done

echo
echo "Gotowe. Teraz wypuść nowy build, żeby zmienne zadziałały:"
echo "  npx vercel deploy --prod"
